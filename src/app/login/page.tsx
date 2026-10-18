"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { seedDemo } from "@/lib/backend";
import { sampleSnapshot } from "@/lib/sample";
import { getSupabase } from "@/lib/supabase";
import { Button, Divider, TextInput } from "@/components/ui";

export default function LoginPage() {
  const { state, demoAvailable, startDemo } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const supabase = getSupabase();

  useEffect(() => {
    if (state.status === "signedIn") router.replace("/");
  }, [state.status, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage(null);
    const { data, error } =
      mode === "signIn"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/auth/callback/` } });
    setBusy(false);
    if (error) setMessage({ text: error.message, error: true });
    else if (mode === "signUp" && !data.session) setMessage({ text: "Check your inbox to confirm your email, then sign in." });
  };

  const google = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback/` },
    });
    if (error) setMessage({ text: error.message, error: true });
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-16">
      <h1 className="text-[40px] font-semibold leading-none tracking-[-0.04em]">Spendly</h1>
      <p className="mt-3 text-[15px] text-muted">Know what you can spend today, and for the rest of the month.</p>

      {supabase ? (
        <>
          <form onSubmit={submit} className="mt-12 flex flex-col gap-4">
            <TextInput type="email" required autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <TextInput
              type="password"
              required
              minLength={8}
              autoComplete={mode === "signIn" ? "current-password" : "new-password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {message && <p className={message.error ? "text-sm text-danger" : "text-sm text-muted"}>{message.text}</p>}
            <Button type="submit" disabled={busy} className="mt-4">
              {mode === "signIn" ? "Sign in" : "Create account"}
            </Button>
          </form>
          <div className="my-6 flex items-center gap-4 text-xs text-faint">
            <Divider className="flex-1" /> or <Divider className="flex-1" />
          </div>
          <Button variant="secondary" onClick={google}>
            <GoogleMark /> Continue with Google
          </Button>
          <button
            className="mt-8 text-sm text-muted hover:text-fg"
            onClick={() => {
              setMode(mode === "signIn" ? "signUp" : "signIn");
              setMessage(null);
            }}
          >
            {mode === "signIn" ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>
        </>
      ) : (
        <div className="mt-12 flex flex-col gap-4">
          <Button onClick={startDemo} disabled={!demoAvailable}>
            Try the demo
          </Button>
          <Button
            variant="secondary"
            disabled={!demoAvailable}
            onClick={() => {
              seedDemo(sampleSnapshot());
              startDemo();
            }}
          >
            Explore with sample data
          </Button>
          <p className="text-sm text-muted">
            Supabase isn&apos;t configured yet, so Spendly runs in demo mode. Your data stays in this browser.
          </p>
        </div>
      )}
    </main>
  );
}

function GoogleMark() {
  // Monochrome "G" outline, keeping the near-monochrome look.
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M20.5 12.2c0-.6-.1-1.2-.2-1.7H12v3.3h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.6-3.9 2.6-6.5Z" />
      <path d="M12 21c2.4 0 4.4-.8 5.9-2.2L15 16.5c-.8.5-1.8.9-3 .9a5.3 5.3 0 0 1-5-3.6H4.1v2.3A9 9 0 0 0 12 21Z" />
      <path d="M7 13.8a5.3 5.3 0 0 1 0-3.6V7.9H4.1a9 9 0 0 0 0 8.2L7 13.8Z" />
      <path d="M12 6.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 4.1 7.9L7 10.2a5.3 5.3 0 0 1 5-3.6Z" />
    </svg>
  );
}
