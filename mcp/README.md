# 7929 MCP server

An [MCP](https://modelcontextprotocol.io) server that exposes the house
maintenance app as tools an AI assistant can call: *"what's overdue that I can
do in 20 minutes?"*, *"add a project to caulk the back door"*, *"is the
bathroom-clean cadence set right?"*

It runs locally over stdio and talks to the same Supabase database as the web
app.

## What MCP is, briefly

An MCP server advertises two kinds of thing to a client (Claude Desktop, Claude
Code, and others):

- **Tools** — things the model can *do*. Each has a name, a description, and a
  typed input schema. The model picks one and supplies arguments; the server
  runs it and returns text.
- **Resources** — read-only content the client can pull into context, addressed
  by URI.

The client discovers all of it at connect time, so adding a tool here makes it
available in conversation with no client-side change.

## Setup

1. **Credentials.** The server reads `NEXT_PUBLIC_SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` from `.env.local` in the repo root — the same
   file `npm run seed` uses. See the security note below.

2. **Check it boots**, before wiring it into any client:

   ```sh
   npm run mcp:check
   ```

   This spawns the server exactly as a client would, completes the handshake,
   and prints the tools and resources it advertises. It needs no credentials —
   tool *listing* and the PRD resource work without a database, so a failure
   here is a wiring problem, not a config one.

3. **Register it.** In Claude Code, from the repo root:

   ```sh
   claude mcp add 7929-home -- npx tsx mcp/server.ts
   ```

   Or add it to a client's config file directly:

   ```json
   {
     "mcpServers": {
       "7929-home": {
         "command": "npx",
         "args": ["tsx", "mcp/server.ts"],
         "cwd": "/absolute/path/to/7929"
       }
     }
   }
   ```

   The server walks up from its working directory to find the project root
   (marked by `7929-prd.md`), so any directory inside the repo works. Set `cwd`
   anyway in a client config — a client that spawns it from somewhere else
   entirely has nothing to walk up from.

## Tools

| Tool | What it does |
|---|---|
| `list_today` | Overdue / due / coming-up, with an optional `max_minutes` filter |
| `list_projects` | The backlog, grouped Next · Soon · Someday |
| `task_detail` | Cadence, next due, steps, materials, recent completions |
| `completion_history` | Configured cadence vs. what actually happened, with a suggestion |
| `complete_task` | Records a completion and restarts the interval |
| `add_project` | Quick-add to the backlog; only `name` is required |
| `snooze_task` | Hides a task from Today without touching interval math |
| `update_cadence` | Change base interval, seasonal overrides, or active months |

Tasks are addressed by name (`"Bathroom clean"`) or id. An ambiguous name comes
back as an error listing the candidates rather than a guess — a wrong guess here
would complete the wrong task.

### `completion_history` is the one the app can't do

Every other tool mirrors a screen. This one doesn't: PRD §5 keeps completion
history in its own table specifically so intervals can be tuned "against what
actually happened", but no screen was ever built for it. The tool compares the
gaps between real completions against the configured cadence and proposes an
interval that matches reality — and `update_cadence` applies the conclusion.

## Resources

| URI | Contents |
|---|---|
| `home://prd` | The full PRD — the spec the app is built from |
| `home://tasks` | Every task row as JSON, for bulk reasoning |

The scheme is `home://`, not `7929://`: a URI scheme may not start with a digit
(RFC 3986), and the SDK parses resource URIs with `new URL()`, so a digit-led
scheme lists fine and then fails at read time with `Invalid URL`.

## Security note — this uses the service-role key

The web app authenticates as a signed-in user and relies on row-level security.
A local MCP server has no browser session, so it uses the **service-role key**,
which **bypasses RLS entirely**.

That's acceptable here because 7929 is single-owner by design (PRD §3) and this
server runs as a local subprocess over stdio, never bound to a network port.
Two things follow:

- `.env.local` must stay out of git (`.gitignore` already covers `.env*`).
- Don't turn this into a remote HTTP server by swapping the transport. That
  would put an unauthenticated, RLS-bypassing endpoint on the network. A remote
  MCP server needs real auth, which this deliberately doesn't have.

## How it stays honest

Two rules keep the server from becoming a second, subtly different
implementation of the app:

1. **Due-ness is never recomputed here.** Reads import `classifyForToday` and
   `dueInfo` from `src/lib/dueness.ts` — the same module the app renders from.
2. **Writes go through `src/lib/mutations.ts`**, shared with the React context.
   That module owns the rule that completing a task writes *both* a
   `completions` row and `tasks.last_completed_at`; `src/lib/completion.test.ts`
   pins it, including the rollback when only half the write succeeds.

## Files

| File | Role |
|---|---|
| `server.ts` | Tool and resource registration, stdio transport |
| `db.ts` | Service-role Supabase client |
| `paths.ts` | Finding the project root from any working directory |
| `lookup.ts` | Resolving a task from a name the model typed |
| `analysis.ts` | Cadence-vs-reality interval statistics (pure) |
| `format.ts` | Rendering tasks as text for a model to read |
| `smoke.ts` | The `npm run mcp:check` harness |

## Known limits

- **It's a desktop companion to a phone app.** MCP clients run on a laptop; the
  app itself lives on the iPhone home screen. Quick-capture by voice is the use
  case most weakened by that.
- **No auth.** Single-user by design, which is why the hardest part of a real
  MCP server isn't here.
- **Reads load the whole task table** on each call. A few dozen rows — paging
  would be premature.
