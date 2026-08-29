# 7929 — Home Maintenance PWA

Single-user PWA for recurring home maintenance and the project backlog at
7929 17th Ave SW. Interval-based due-ness, not calendar dates: every task has
a cadence, a last-completed date, and a computed overdue-ness. Nothing is
ever "missed" — only overdue by *N* days. Full spec in [7929-prd.md](7929-prd.md).

Stack: Next.js 15 (App Router) · TypeScript · Tailwind 4 · shadcn/ui · Supabase.

## Setup

1. **Env keys** — create `.env.local` in the repo root with the values from
   your Supabase project (Project Settings → API):

   ```sh
   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   SUPABASE_SERVICE_ROLE_KEY=<service role key>   # seeding and the MCP server only
   ```

2. **Schema** — paste `supabase/migrations/0001_init.sql` into the Supabase
   SQL editor and run it.

3. **Auth** — in Supabase → Authentication → URL Configuration, set the Site
   URL to your deployed origin (and add `http://localhost:3000` to redirect
   URLs for local dev). Email magic link is the only sign-in method.

4. **Seed** (once):

   ```sh
   npm install
   npm run seed
   ```

   Seeds all §9 tasks with the staggered backdates so day one shows a
   manageable set, not a wall of red. Refuses to run if tasks already exist.

5. **Run**:

   ```sh
   npm run dev
   ```

## Deploy

Push to GitHub, import into Vercel, add the two `NEXT_PUBLIC_*` env vars
(the service-role key is only needed locally for seeding). Then on the
iPhone: open the Vercel URL in Safari → Share → Add to Home Screen.

## Commands

| Command | What |
|---|---|
| `npm run dev` | dev server |
| `npm run build` | production build |
| `npm test` | dueness logic unit tests |
| `npm run seed` | one-time seed from PRD §9 |
| `npm run mcp` | MCP server over stdio ([mcp/README.md](mcp/README.md)) |
| `npm run mcp:check` | verify the MCP server boots and lists its tools |
| `npm run mcp:demo` | walk every MCP tool against a stub database |
| `node scripts/icons.mjs` | regenerate PWA icons |

## MCP server

`mcp/` exposes the app as tools an AI assistant can call — "what's overdue that
I can do in 20 minutes?", "add a project to caulk the back door", "is the
bathroom-clean cadence set right?". It shares `src/lib/dueness.ts` and
`src/lib/mutations.ts` with the app so the two can't disagree. Setup and the
tool list are in [mcp/README.md](mcp/README.md).
