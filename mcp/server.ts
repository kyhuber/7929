#!/usr/bin/env node
/**
 * 7929 MCP server — the house maintenance app as a set of tools an assistant
 * can call. See mcp/README.md for how to register it.
 *
 * Design notes worth knowing if you're reading this to learn MCP:
 *
 *  - Due-ness is never recomputed here. Every read imports the same
 *    src/lib/dueness.ts the app renders from, so the two can't disagree.
 *  - Every write goes through src/lib/mutations.ts for the same reason —
 *    in particular, completing a task must write both a `completions` row and
 *    `tasks.last_completed_at`, or the history-based tuning below stops
 *    matching reality.
 *  - Tools return prose, not JSON. A model acts more reliably on "3d overdue"
 *    than on a timestamp it has to do arithmetic against.
 *  - Failed lookups return the candidate list rather than guessing.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { classifyForToday, dueInfo } from "../src/lib/dueness";
import { CATEGORIES, type Task } from "../src/lib/types";
import * as db from "../src/lib/mutations";
import { analyzeIntervals } from "./analysis";
import { getDb } from "./db";
import {
  formatHistory,
  formatProjects,
  formatTaskDetail,
  formatToday,
} from "./format";
import { resolveTask } from "./lookup";

// ---------------------------------------------------------------- helpers

const text = (s: string) => ({ content: [{ type: "text" as const, text: s }] });
const failure = (s: string) => ({ ...text(s), isError: true });

/** The PRD is the project root marker, so the server works from any cwd
 *  inside the project rather than only from the root. */
function projectRoot(): string {
  let dir = resolve(process.cwd());
  for (;;) {
    if (existsSync(join(dir, "7929-prd.md"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(
        "Couldn't locate the project root (no 7929-prd.md found above the " +
          "working directory). Launch the server with cwd set to the repo."
      );
    }
    dir = parent;
  }
}

/** Load every task once per call. The table is a few dozen rows — paging or
 *  server-side filtering would be premature. */
async function loadTasks(): Promise<Task[]> {
  return db.fetchTasks(getDb());
}

async function withTask(
  query: string,
  fn: (task: Task, tasks: Task[]) => Promise<ReturnType<typeof text>>
) {
  const tasks = await loadTasks();
  const found = resolveTask(tasks, query);
  if (!found.ok) return failure(found.message);
  return fn(found.task, tasks);
}

const server = new McpServer({ name: "7929-home", version: "1.0.0" });

// ------------------------------------------------------------------ reads

server.registerTool(
  "list_today",
  {
    title: "Today",
    description:
      "What needs doing right now: overdue tasks first, then due today, then " +
      "the next three days. Snoozed and out-of-season tasks are excluded. " +
      "Pass max_minutes to answer 'I have 20 minutes, what can I do?'.",
    inputSchema: {
      max_minutes: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Only tasks estimated at or under this many minutes."),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ max_minutes }) => {
    const tasks = await loadTasks();
    return text(formatToday(classifyForToday(tasks, new Date()), max_minutes));
  }
);

server.registerTool(
  "list_projects",
  {
    title: "Project backlog",
    description:
      "The one-off project backlog, grouped Next / Soon / Someday. These are " +
      "not on a cadence — they sit until done.",
    inputSchema: {
      priority: z.enum(["next", "soon", "someday"]).optional(),
      max_minutes: z.number().int().positive().optional(),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ priority, max_minutes }) => {
    const tasks = await loadTasks();
    const projects = tasks.filter(
      (t) =>
        t.kind === "project" &&
        t.status === "active" &&
        (!priority || t.priority === priority) &&
        (max_minutes == null ||
          (t.est_minutes != null && t.est_minutes <= max_minutes))
    );
    return text(formatProjects(projects));
  }
);

server.registerTool(
  "task_detail",
  {
    title: "Task detail",
    description:
      "Everything about one task: cadence, next due date, steps, materials, " +
      "and its recent completions. Accepts a task name or id.",
    inputSchema: {
      task: z.string().describe("Task name (e.g. 'Bathroom clean') or id."),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ task: query }) =>
    withTask(query, async (task) => {
      const history = await db.fetchCompletions(getDb(), task.id, 10);
      return text(formatTaskDetail(task, dueInfo(task, new Date()), history));
    })
);

server.registerTool(
  "completion_history",
  {
    title: "Cadence check",
    description:
      "Compare a recurring task's configured cadence against how often it has " +
      "actually been done, and suggest an interval that matches reality. This " +
      "is the analysis the app itself doesn't offer — use it when asked " +
      "whether an interval is set right.",
    inputSchema: {
      task: z.string().describe("Task name or id."),
      limit: z
        .number()
        .int()
        .positive()
        .max(200)
        .optional()
        .describe("How many completions to consider (default 50)."),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ task: query, limit }) =>
    withTask(query, async (task) => {
      const history = await db.fetchCompletions(getDb(), task.id, limit ?? 50);
      const stats = analyzeIntervals(
        history.map((c) => c.completed_at),
        task.base_interval_days
      );
      return text(formatHistory(task, stats, history));
    })
);

// ----------------------------------------------------------------- writes

server.registerTool(
  "complete_task",
  {
    title: "Complete a task",
    description:
      "Mark a task done now. Writes a completion record and restarts the " +
      "interval from today (PRD §6: intervals slide forward from actual " +
      "completion, never from the theoretical due date). Projects drop off " +
      "the backlog. Optional notes are kept with the completion.",
    inputSchema: {
      task: z.string().describe("Task name or id."),
      notes: z
        .string()
        .optional()
        .describe("Observation to keep with this completion, e.g. 'grout looking dingy'."),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  async ({ task: query, notes }) =>
    withTask(query, async (task) => {
      const { completedAt } = await db.completeTask(getDb(), task, { notes });
      const next =
        task.kind === "project"
          ? "Removed from the backlog."
          : (() => {
              const after = { ...task, last_completed_at: completedAt, snooze_until: null };
              const due = dueInfo(after, new Date());
              return due ? `Next due ${due.dueDate.toISOString().slice(0, 10)}.` : "";
            })();
      return text(`Completed "${task.name}". ${next}`.trim());
    })
);

server.registerTool(
  "add_project",
  {
    title: "Add a project",
    description:
      "Add a one-off project to the backlog. Only the name is required — the " +
      "point is capturing it in seconds; everything else can be edited later " +
      "in the app.",
    inputSchema: {
      name: z.string().min(1).describe("Short name, e.g. 'Caulk back door frame'."),
      est_minutes: z.number().int().positive().optional(),
      priority: z.enum(["next", "soon", "someday"]).optional().describe("Defaults to soon."),
      category: z.enum(CATEGORIES as [string, ...string[]]).optional().describe("Defaults to admin."),
      location: z.string().optional(),
      materials: z.string().optional(),
      notes: z.string().optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  async (args) => {
    const created = await db.createTask(
      getDb(),
      db.projectDefaults(args as Parameters<typeof db.projectDefaults>[0])
    );
    return text(
      `Added "${created.name}" to the backlog (${created.priority}${
        created.est_minutes != null ? `, ${created.est_minutes} min` : ""
      }). id: ${created.id}`
    );
  }
);

server.registerTool(
  "snooze_task",
  {
    title: "Snooze",
    description:
      "Hide a task from Today for a few days without touching its interval " +
      "math — it stays as overdue as it was when it comes back.",
    inputSchema: {
      task: z.string().describe("Task name or id."),
      days: z.number().int().positive().max(365).describe("Typically 3, 7, or 14."),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  async ({ task: query, days }) =>
    withTask(query, async (task) => {
      const until = await db.snoozeTask(getDb(), task.id, days);
      return text(`Snoozed "${task.name}" until ${until.slice(0, 10)}.`);
    })
);

server.registerTool(
  "update_cadence",
  {
    title: "Update cadence",
    description:
      "Change how often a recurring task comes due. Use after completion_history " +
      "suggests the configured interval doesn't match reality. Seasonal " +
      "overrides win for the months they name; active_months limits the task " +
      "to part of the year (null clears it).",
    inputSchema: {
      task: z.string().describe("Task name or id."),
      base_interval_days: z.number().int().positive().optional(),
      seasonal_overrides: z
        .array(
          z.object({
            months: z.array(z.number().int().min(1).max(12)).min(1),
            interval_days: z.number().int().positive(),
          })
        )
        .nullable()
        .optional()
        .describe("e.g. [{months:[4,5,6,7,8,9], interval_days:10}]. null clears."),
      active_months: z
        .array(z.number().int().min(1).max(12))
        .nullable()
        .optional()
        .describe("Months the task is due-able at all. null = year-round."),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  async ({ task: query, ...patch }) =>
    withTask(query, async (task) => {
      const given = Object.fromEntries(
        Object.entries(patch).filter(([, v]) => v !== undefined)
      ) as db.CadencePatch;

      if (Object.keys(given).length === 0) {
        return failure("Nothing to change — pass at least one cadence field.");
      }
      const invalid = db.validateCadence(task, given);
      if (invalid) return failure(invalid);

      await db.updateTask(getDb(), task.id, given as Partial<Task>);
      const after = { ...task, ...given } as Task;
      const due = dueInfo(after, new Date());
      return text(
        `Updated cadence for "${task.name}".` +
          (due ? ` Next due ${due.dueDate.toISOString().slice(0, 10)}.` : "")
      );
    })
);

// -------------------------------------------------------------- resources
//
// Resources are read-only context a client can pull in, as opposed to tools,
// which do something. The scheme is `home://` rather than `7929://` because a
// URI scheme may not start with a digit (RFC 3986) — the SDK parses these with
// `new URL()`, so `7929://prd` fails at read time with "Invalid URL" even
// though it lists fine.

server.registerResource(
  "prd",
  "home://prd",
  {
    title: "7929 product requirements",
    description:
      "The spec the app is built from — data model, due-ness rules, seed data, " +
      "and design direction. Read it before answering questions about how the " +
      "app is meant to behave.",
    mimeType: "text/markdown",
  },
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: "text/markdown",
        text: readFileSync(join(projectRoot(), "7929-prd.md"), "utf8"),
      },
    ],
  })
);

server.registerResource(
  "tasks",
  "home://tasks",
  {
    title: "All tasks",
    description:
      "Every task row as JSON, including archived ones. Use the tools for " +
      "day-to-day questions; this is for bulk reasoning across the whole set.",
    mimeType: "application/json",
  },
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(await loadTasks(), null, 2),
      },
    ],
  })
);

// ------------------------------------------------------------------- boot

async function main() {
  await server.connect(new StdioServerTransport());
  // stdout is the protocol channel — anything logged there corrupts it.
  console.error("7929 MCP server ready on stdio");
}

main().catch((err) => {
  console.error("7929 MCP server failed to start:", err);
  process.exit(1);
});
