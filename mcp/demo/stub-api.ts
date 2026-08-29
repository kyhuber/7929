/**
 * A minimal stand-in for Supabase's REST API — enough of PostgREST's shape to
 * serve the handful of queries the server makes.
 *
 * The point is that nothing about the MCP server is faked: it runs as a real
 * subprocess, makes real HTTP requests, and this answers them from memory.
 * That makes `npm run mcp:demo` a genuine end-to-end exercise of all eight
 * tools with no Supabase project, no credentials, and no network.
 *
 * State is per-process and thrown away when the demo exits.
 */
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const ago = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

type Row = Record<string, unknown>;

const mk = (o: Partial<Row> & { name: string }): Row => ({
  id: randomUUID(), kind: "recurring", category: "living", steps: [],
  base_interval_days: 7, seasonal_overrides: null, active_months: null,
  est_minutes: 30, last_completed_at: null, snooze_until: null, priority: null,
  status: "active", location: null, materials: null, notes: null,
  created_at: ago(300), ...o,
});

export const state = {
  tasks: [
    mk({ name: "Bathroom clean", category: "bathroom", base_interval_days: 7, est_minutes: 30,
         last_completed_at: ago(11),
         steps: ["Toilet (bowl, seat, exterior)", "Sink and faucet", "Mirror", "Mop floor", "Quick tub wipe"] }),
    mk({ name: "Mow and yard", category: "exterior", base_interval_days: 30, est_minutes: 60,
         seasonal_overrides: [{ months: [4,5,6,7,8,9], interval_days: 10 }], last_completed_at: ago(14),
         steps: ["Mow backyard", "Weed raised bed", "Rain garden walk", "Gutter glance"] }),
    mk({ name: "Front yard walk", category: "exterior", base_interval_days: 7, est_minutes: 10, last_completed_at: ago(9) }),
    mk({ name: "Kitchen reset", category: "kitchen", base_interval_days: 7, est_minutes: 25, last_completed_at: ago(7) }),
    mk({ name: "Floors", base_interval_days: 7, est_minutes: 20, last_completed_at: ago(5) }),
    mk({ name: "Kitchen deep", category: "kitchen", base_interval_days: 30, est_minutes: 45, last_completed_at: ago(28) }),
    mk({ name: "Rain garden water", category: "exterior", base_interval_days: 4, est_minutes: 15,
         active_months: [6,7,8,9], last_completed_at: ago(3) }),
    mk({ name: "Mini-split filter", category: "systems", base_interval_days: 90, est_minutes: 15, last_completed_at: ago(60) }),
    mk({ name: "Caulk back door frame bottom", kind: "project", category: "exterior", priority: "next",
         est_minutes: 60, location: "Back door", materials: "Exterior paintable caulk", base_interval_days: null }),
    mk({ name: "Fix rear exterior outlet", kind: "project", category: "exterior", priority: "next",
         est_minutes: 60, location: "Rear exterior", materials: "GFCI, weatherproof in-use cover", base_interval_days: null }),
    mk({ name: "Hang pictures in office", kind: "project", category: "admin", priority: "soon",
         est_minutes: 90, location: "Office", materials: "Picture hooks, level, stud finder", base_interval_days: null }),
    mk({ name: "Select living room rug", kind: "project", category: "living", priority: "someday",
         est_minutes: null, location: "Living room", base_interval_days: null }),
  ] as Row[],
  completions: [] as Row[],
};

// Bathroom clean is deliberately drifted — 11, 10, 9, 12 day gaps against a
// 7-day cadence — so `completion_history` has something real to say about it.
const bath = state.tasks.find((t) => t.name === "Bathroom clean")!;
for (const d of [53, 42, 32, 23, 11]) {
  state.completions.push({
    id: randomUUID(), task_id: bath.id, completed_at: ago(d),
    notes: d === 32 ? "grout looking dingy near tub" : null,
  });
}

const eqValue = (v: string) => v.replace(/^eq\./, "");

export function start(port: number) {
  const server = createServer((req, res) => {
    const url = new URL(req.url!, "http://localhost");
    const table = url.pathname.replace("/rest/v1/", "");
    const wantsObject = (req.headers.accept ?? "").includes("vnd.pgrst.object");

    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const send = (payload: unknown, code = 200) => {
        res.writeHead(code, { "Content-Type": "application/json" });
        res.end(JSON.stringify(wantsObject && Array.isArray(payload) ? payload[0] ?? null : payload));
      };

      const rows = table === "tasks" ? state.tasks : state.completions;

      if (req.method === "GET") {
        let out = [...rows];
        const taskId = url.searchParams.get("task_id");
        if (taskId) out = out.filter((r) => r.task_id === eqValue(taskId));
        const id = url.searchParams.get("id");
        if (id) out = out.filter((r) => r.id === eqValue(id));
        const order = url.searchParams.get("order");
        if (order?.startsWith("completed_at")) {
          out.sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)));
          if (order.includes("asc")) out.reverse();
        }
        const limit = url.searchParams.get("limit");
        if (limit) out = out.slice(0, Number(limit));
        return send(out);
      }

      if (req.method === "POST") {
        const payload = JSON.parse(body || "{}");
        const created = { id: randomUUID(), created_at: new Date().toISOString(), ...payload };
        rows.push(created);
        return send([created], 201);
      }

      if (req.method === "PATCH") {
        const patch = JSON.parse(body || "{}");
        const id = eqValue(url.searchParams.get("id") ?? "");
        const row = rows.find((r) => r.id === id);
        if (row) Object.assign(row, patch);
        return send(row ? [row] : []);
      }

      if (req.method === "DELETE") {
        const id = eqValue(url.searchParams.get("id") ?? "");
        const i = rows.findIndex((r) => r.id === id);
        if (i >= 0) rows.splice(i, 1);
        return send([]);
      }

      send([], 405);
    });
  });
  return new Promise<() => void>((resolve) => {
    server.listen(port, () => resolve(() => server.close()));
  });
}
