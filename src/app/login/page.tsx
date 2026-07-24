"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Email magic-link sign-in with a 6-digit code fallback. The code path
 * matters on iOS: the installed home-screen app has cookie storage
 * separate from Safari, so a link tapped in Mail signs in the wrong
 * browser. Typing the code inside the app signs in the app itself —
 * once, after which the session persists via refresh tokens.
 */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(
    process.env.NEXT_PUBLIC_OWNER_EMAIL ?? ""
  );
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "link"
      ? "That link didn't work — it may have expired. Send a fresh one."
      : null
  );
  const [busy, setBusy] = useState(false);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });
    setBusy(false);
    if (error) {
      setError(error.message);
    } else {
      setStep("code");
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
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
        <form onSubmit={sendLink} className="mt-8 space-y-4">
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
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            type="submit"
            disabled={busy || !email}
            className="h-12 w-full text-base"
          >
            {busy ? "Sending…" : "Send sign-in email"}
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
            disabled={busy || code.length < 6}
            className="h-12 w-full text-base"
          >
            {busy ? "Checking…" : "Sign in"}
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

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
