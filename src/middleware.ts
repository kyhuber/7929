import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const OWNER_EMAIL = (
  process.env.OWNER_EMAIL ??
  process.env.NEXT_PUBLIC_OWNER_EMAIL ??
  ""
)
  .trim()
  .toLowerCase();

function isOwner(email: string | undefined) {
  return !!email && email.trim().toLowerCase() === OWNER_EMAIL;
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not run code between createServerClient and getUser —
  // it can cause random logouts.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/auth");
  // The keepalive cron carries no session — it authenticates to Supabase with
  // the anon key, so bouncing it to /login would defeat the point.
  const isPublicRoute = isAuthRoute || pathname === "/api/keepalive";

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Google sign-in means anyone with a Google account can get a session,
  // and RLS grants every authenticated session full access. When the
  // owner's address is configured, refuse everyone else at the door.
  // (Disabling "Allow new users to sign up" in Supabase is the real
  // lock; this is the belt to that suspenders.)
  if (user && OWNER_EMAIL && !isOwner(user.email)) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "?error=owner";
    const redirect = NextResponse.redirect(url);
    // signOut cleared the session cookies on supabaseResponse; carry
    // those deletions over so the browser actually forgets the session.
    supabaseResponse.cookies
      .getAll()
      .forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  if (user && pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // everything except static assets and PWA files
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons|apple-touch-icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
