"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const OWNER_EMAIL = process.env.NEXT_PUBLIC_OWNER_EMAIL ?? "";

const ERRORS: Record<string, string> = {
  google: "Google sign-in didn't complete. Try again, or use email below.",
  link: "That link didn't work — it may have expired. Send a fresh one.",
  owner: "That account isn't the owner of this app. Sign in with the owner's Google account.",
};

/**
 * Google sign-in first, with the email magic-link / 6-digit-code flow
 * kept underneath as a fallback. Both matter on iOS: the installed
 * home-screen app has cookie storage separate from Safari, so a magic
 * link tapped in Mail signs in the wrong browser. Google's redirect
 * comes back into the app itself, and if that ever misbehaves, typing
 * the emailed code inside the app still works. Either way it's once —
 * after that the session persists via refresh tokens.
 */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(OWNER_EMAIL);
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState<string | null>(() => {
    const key = searchParams.get("error");
    return key ? (ERRORS[key] ?? "Sign-in didn't complete. Try again.") : null;
  });
  const [busy, setBusy] = useState<"google" | "email" | null>(null);

  async function signInWithGoogle() {
    setBusy("google");
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // Skip Google's account chooser when we already know who this is.
        queryParams: OWNER_EMAIL ? { login_hint: OWNER_EMAIL } : undefined,
      },
    });
    // On success the browser is already navigating to Google; only an
    // error brings control back here.
    if (error) {
      setBusy(null);
      setError(error.message);
    }
  }

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy("email");
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });
    setBusy(null);
    if (error) {
      setError(error.message);
    } else {
      setStep("code");
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy("email");
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "email",
    });
    setBusy(null);
    if (error) {
      setError(
        /expired|invalid/i.test(error.message)
          ? "That code didn't work — check for typos, or send a fresh one."
          : error.message
      );
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 pb-24">
      <h1 className="text-3xl font-semibold tracking-tight">7929</h1>
      <p className="mt-1 text-muted-foreground">
        Home maintenance, 17th Ave SW
      </p>

      {step === "email" ? (
        <div className="mt-8 space-y-4">
          <Button
            type="button"
            variant="outline"
            disabled={busy !== null}
            onClick={signInWithGoogle}
            className="h-12 w-full gap-3 bg-background text-base"
          >
            <GoogleLogo />
            {busy === "google" ? "Opening Google…" : "Continue with Google"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex items-center gap-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or use email
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={sendLink} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12"
              />
            </div>
            <Button
              type="submit"
              variant="secondary"
              disabled={busy !== null || !email}
              className="h-12 w-full text-base"
            >
              {busy === "email" ? "Sending…" : "Send sign-in email"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-11 w-full text-muted-foreground"
              disabled={!email}
              onClick={() => {
                setStep("code");
                setError(null);
              }}
            >
              I already have a code
            </Button>
          </form>
        </div>
      ) : (
        <form onSubmit={verifyCode} className="mt-8 space-y-4">
          <p className="rounded-lg bg-card p-4 text-sm">
            Email sent to <span className="font-medium">{email}</span>. Enter
            the code from it below — on the phone app, use the code, not the
            link.
          </p>
          <div className="space-y-2">
            <Label htmlFor="code">Code</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="h-12 text-center text-xl tracking-[0.4em]"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            type="submit"
            disabled={busy !== null || code.length < 6}
            className="h-12 w-full text-base"
          >
            {busy === "email" ? "Checking…" : "Sign in"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full text-muted-foreground"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
          >
            Use a different email or resend
          </Button>
        </form>
      )}
    </main>
  );
}

/** Google's "G" mark, per their sign-in branding guidelines. */
function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="size-5 shrink-0">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
