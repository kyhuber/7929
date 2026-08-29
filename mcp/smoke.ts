/**
 * End-to-end check that the server actually speaks MCP: spawns it exactly the
 * way a client would, completes the handshake, and lists what it exposes.
 *
 *   npm run mcp:check
 *
 * Runs without Supabase credentials — tool *listing* and the PRD resource need
 * no database, so this verifies the wiring even before .env.local is filled in.
 * Use it after changing a tool definition, rather than restarting Claude
 * Desktop to find out whether the server still boots.
 */
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { projectRoot } from "./paths";

async function main() {
  // Absolute script path, but the *server's* cwd is left as-is on purpose: the
  // server has to find .env.local and the PRD by walking up to the project
  // root, not by trusting cwd. Running this from a subdirectory proves it does.
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", join(projectRoot(), "mcp", "server.ts")],
    cwd: process.cwd(),
  });

  const client = new Client({ name: "7929-smoke", version: "1.0.0" });
  await client.connect(transport);

  const { tools } = await client.listTools();
  console.log(`Tools (${tools.length}):`);
  for (const t of tools) {
    const params = Object.keys(t.inputSchema?.properties ?? {});
    console.log(`  ${t.name}(${params.join(", ")}) — ${t.title ?? ""}`);
  }

  const { resources } = await client.listResources();
  console.log(`\nResources (${resources.length}):`);
  for (const r of resources) console.log(`  ${r.uri} — ${r.title ?? r.name}`);

  const prd = await client.readResource({ uri: "home://prd" });
  // contents entries are text-or-blob; narrow before reading .text
  const entry = prd.contents[0];
  const body = entry && "text" in entry ? String(entry.text) : "";
  console.log(`\nPRD resource: ${body.length} chars, starts "${body.slice(0, 40)}…"`);

  // Exercises a real tool path. With credentials this returns the Today view;
  // without them it should fail with the actionable env-var message, not a crash.
  const today = await client.callTool({ name: "list_today", arguments: {} });
  const first = (today.content as { text?: string }[])[0]?.text ?? "";
  console.log(`\nlist_today ${today.isError ? "(error)" : "(ok)"}: ${first.split("\n")[0]}`);

  await client.close();
}

main().catch((err) => {
  console.error("Smoke check failed:", err);
  process.exit(1);
});
