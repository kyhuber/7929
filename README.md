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

2. **Schema** — paste each file in `supabase/migrations/` into the Supabase
   SQL editor, in filename order, and run it.

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
| `npm run keepalive` | ping the database by hand (see below) |
| `npm run mcp` | MCP server over stdio ([mcp/README.md](mcp/README.md)) |
| `npm run mcp:check` | verify the MCP server boots and lists its tools |
| `node scripts/icons.mjs` | regenerate PWA icons |

## Keeping the project awake

Supabase pauses a free project after **7 days without database activity**, which
takes the app offline until someone clicks Restore in the dashboard. Two
schedulers prevent that, both calling `ping()` from
`supabase/migrations/0002_keepalive.sql` — a single-row update that reads no app
data and needs nothing beyond the anon key:

| Scheduler | When | Config |
|---|---|---|
| GitHub Actions | 09:37 UTC daily | [`.github/workflows/keepalive.yml`](.github/workflows/keepalive.yml) |
| Vercel cron | ~14:00 UTC daily | [`vercel.json`](vercel.json) → `/api/keepalive` |

Two of them, because each fails in a way the other survives: **GitHub disables
scheduled workflows after 60 days of repository inactivity** — exactly the
dormant-repo case this is meant for (it emails you, and one click re-enables) —
while a Vercel cron stops with the deployment. Pinging daily leaves six days of
margin even if one of the two is quietly dead.

Setup, once:

1. Run `supabase/migrations/0002_keepalive.sql` in the SQL editor.
2. Add repository secrets `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Settings → Secrets and variables → Actions).
3. Redeploy so Vercel picks up the cron. Hobby-plan crons run once a day and
   fire within the hour of the stated time — fine against a 7-day window.
   Setting a `CRON_SECRET` env var in Vercel is optional; when it's set, Vercel
   sends it and `/api/keepalive` rejects anything else.
4. Check it works: Actions → Supabase keepalive → Run workflow, and
   `npm run keepalive` locally. Both print the new timestamp.

After that, silence means it's working — GitHub emails you when a scheduled run
fails. To look directly, `keepalive.last_ping_at` holds the time of the last
successful ping (readable from the SQL editor; the table itself is not reachable
over the API).

If the project is *already* paused, restore it from the dashboard first — a ping
can't wake a project that's down.

## MCP server

`mcp/` exposes the app as tools an AI assistant can call — "what's overdue that
I can do in 20 minutes?", "add a project to caulk the back door", "is the
bathroom-clean cadence set right?". It shares `src/lib/dueness.ts` and
`src/lib/mutations.ts` with the app so the two can't disagree. Setup and the
tool list are in [mcp/README.md](mcp/README.md).
