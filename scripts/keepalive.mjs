/**
 * Pings the database so the project is never idle long enough for Supabase to
 * pause it. Run: node scripts/keepalive.mjs (or `npm run keepalive`).
 *
 * Deliberately dependency-free: the GitHub Actions job runs it straight from a
 * checkout with no `npm ci`, so a broken install can never be the reason the
 * project went quiet. Credentials come from the environment, falling back to
 * .env.local for local runs. Only the anon key is needed — ping() is the one
 * thing anon is allowed to call.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Minimal .env.local reader — dotenv isn't available without node_modules. */
function fromEnvFile(key) {
  let text;
  try {
    text = readFileSync(join(root, ".env.local"), "utf8");
  } catch {
    return undefined;
  }
  const line = text
    .split("\n")
    .find((l) => l.trimStart().startsWith(`${key}=`));
  if (!line) return undefined;
  return line
    .slice(line.indexOf("=") + 1)
    .trim()
    .replace(/^(["'])(.*)\1$/, "$2");
}

const env = (key) => process.env[key] || fromEnvFile(key);

const url = env("NEXT_PUBLIC_SUPABASE_URL");
const anonKey = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");

if (!url || !anonKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.\n" +
      "Locally they come from .env.local; in GitHub Actions from repository secrets."
  );
  process.exit(1);
}

const endpoint = `${url.replace(/\/+$/, "")}/rest/v1/rpc/ping`;

async function ping() {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: "{}",
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.text()).trim();
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${body.slice(0, 300)}`);
  return body.replace(/^"|"$/g, "");
}

// A single failure is usually a blip; a real outage fails all three.
const attempts = 3;
for (let attempt = 1; attempt <= attempts; attempt++) {
  try {
    console.log(`pinged ${url} — last_ping_at ${await ping()}`);
    process.exit(0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`attempt ${attempt}/${attempts} failed: ${message}`);
    if (attempt === attempts) {
      console.error(
        "\nKeepalive failed. Likely causes:\n" +
          "  - the project is already paused → restore it from the Supabase dashboard\n" +
          "  - ping() is missing → run supabase/migrations/0002_keepalive.sql\n" +
          "  - the anon key was rotated → update .env.local and the repository secrets"
      );
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
}
