import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Inactivity keepalive — the backstop to .github/workflows/keepalive.yml.
 *
 * Two schedulers, because each fails in a way the other survives: GitHub
 * disables scheduled workflows after 60 days of repository inactivity, and a
 * Vercel cron stops with the deployment. Both call the same ping(), which is
 * an idempotent bump of a single row, so running twice a day costs nothing.
 */
export async function GET(request: NextRequest) {
  // Vercel sends this header when CRON_SECRET is set; without it the route is
  // public, which is harmless — ping() reads nothing and writes one counter.
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ping");

  if (error) {
    console.error("keepalive ping failed:", error.message);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, last_ping_at: data });
}
