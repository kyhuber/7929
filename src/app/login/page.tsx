"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(
    process.env.NEXT_PUBLIC_OWNER_EMAIL ?? ""
  );
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "link"
      ? "That link didn't work — it may have expired. Send a fresh one."
      : null
  );
  const [sending, setSending] = useState(false);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });
    setSending(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 pb-24">
      <h1 className="text-3xl font-semibold tracking-tight">7929</h1>
      <p className="mt-1 text-muted-foreground">
        Home maintenance, 17th Ave SW
      </p>

      {sent ? (
        <p className="mt-8 rounded-lg bg-card p-4">
          Check your email — the sign-in link is on its way to{" "}
          <span className="font-medium">{email}</span>.
        </p>
      ) : (
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
            disabled={sending || !email}
            className="h-12 w-full text-base"
          >
            {sending ? "Sending…" : "Send sign-in link"}
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
