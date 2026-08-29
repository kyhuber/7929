/**
 * Walks every tool in the server and prints what each one returns.
 *
 *   npm run mcp:demo
 *
 * Starts the stub API, spawns the real server as a subprocess, and drives it
 * over stdio exactly as Claude Code would — so what you see here is what you
 * will see in a real session, against throwaway data.
 *
 * Read it top to bottom: the reads come first, then the writes, then a final
 * `list_today` showing every change having landed.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { start } from "./stub-api";

// Arbitrary high port; the stub only ever listens on localhost.
const PORT = 54329;

async function main() {
  const stop = await start(PORT);

  // Point the server at the stub. dotenv won't override variables that are
  // already set, so these win over any real .env.local.
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v) env[k] = v;
  env.NEXT_PUBLIC_SUPABASE_URL = `http://localhost:${PORT}`;
  env.SUPABASE_SERVICE_ROLE_KEY = "stub-service-role-key";

  const client = new Client({ name: "drive", version: "1.0.0" });
  await client.connect(
    new StdioClientTransport({
      command: "npx",
      args: ["tsx", "/home/user/7929/mcp/server.ts"],
      cwd: "/home/user/7929",
      env,
    })
  );

  const call = async (label: string, name: string, args: Record<string, unknown> = {}) => {
    const r = await client.callTool({ name, arguments: args });
    const body = (r.content as { text?: string }[])[0]?.text ?? "";
    console.log(`\n${"═".repeat(72)}\n▶ ${label}\n  ${name}(${JSON.stringify(args)})${r.isError ? "  [ERROR]" : ""}\n${"─".repeat(72)}`);
    console.log(body);
  };

  await call("Morning check", "list_today");
  await call("I have 20 minutes", "list_today", { max_minutes: 20 });
  await call("The backlog", "list_projects");
  await call("Only what's next", "list_projects", { priority: "next" });
  await call("One task in full", "task_detail", { task: "bathroom clean" });
  await call("Is this cadence right?", "completion_history", { task: "Bathroom clean" });
  await call("Ambiguous name", "task_detail", { task: "kitchen" });
  await call("Unknown name", "task_detail", { task: "gutters" });
  await call("Capture a project", "add_project", {
    name: "Caulk front storm door upper edge", est_minutes: 30,
    priority: "next", category: "exterior", materials: "Exterior paintable caulk",
  });
  await call("Mark it done", "complete_task", { task: "Front yard walk", notes: "rain garden fine, some maple debris" });
  await call("Finish a project", "complete_task", { task: "Fix rear exterior outlet" });
  await call("Not this week", "snooze_task", { task: "Kitchen deep", days: 7 });
  await call("Apply the suggestion", "update_cadence", { task: "Bathroom clean", base_interval_days: 11 });
  await call("Seasonal cadence", "update_cadence", {
    task: "Mow and yard", base_interval_days: 30,
    seasonal_overrides: [{ months: [4,5,6,7,8,9], interval_days: 8 }],
  });
  await call("Guardrail: cadence on a project", "update_cadence", { task: "Hang pictures in office", base_interval_days: 30 });
  await call("After the changes", "list_today");

  await client.close();
  stop();
}

main().catch((e) => { console.error(e); process.exit(1); });
