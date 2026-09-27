import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Lands the Google OAuth redirect. Supabase sends the browser back here
 * with a PKCE `code`; the verifier half lives in a cookie set by the
 * browser client when sign-in started, so the exchange has to happen on
 * this origin. Provider errors (the user cancelled, an unverified
 * account, signups disabled) arrive as `error` / `error_description`.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const providerError = searchParams.get("error");

  if (code && !providerError) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.redirect(new URL("/login?error=google", request.url));
}
