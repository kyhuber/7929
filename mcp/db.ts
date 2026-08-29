/**
 * Supabase client for the MCP server.
 *
 * The app authenticates as a signed-in user and relies on RLS. A local MCP
 * server has no browser session, so it uses the service-role key instead —
 * which bypasses RLS entirely. That is acceptable here only because 7929 is
 * a single-owner app (PRD §3) and this server runs locally over stdio, never
 * exposed to a network. The key lives in .env.local and must stay out of git.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import type { Db } from "../src/lib/mutations";

let cached: Db | null = null;

export function getDb(): Db {
  if (cached) return cached;

  config({ path: ".env.local" });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
        "The MCP server reads them from .env.local in the project root — the " +
        "same file `npm run seed` uses."
    );
  }

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
