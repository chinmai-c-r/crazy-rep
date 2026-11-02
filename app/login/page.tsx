"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { AuthShell } from "@/components/AuthShell";
import { PasswordField, TextField } from "@/components/form-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldGroup, FieldSeparator } from "@/components/ui/field";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requestAccessUrl } from "@/lib/flags";
import { clearOfflineData } from "@/lib/offline";
import { resetRequestSchema, signInSchema, signUpSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup" | "reset";
type Notice = { ok: boolean; text: string } | null;

const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === "true";

const callback = (path: string) => `${window.location.origin}/auth/confirm?next=${encodeURIComponent(path)}`;

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [notice, setNotice] = useState<Notice>(null);
  const [next, setNext] = useState("/dashboard");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const n = params.get("next");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the URL once on mount
    if (n?.startsWith("/") && !n.startsWith("//")) setNext(n);
    const e = params.get("error");
    if (e) setNotice({ ok: false, text: e });
  }, []);

  const switchTo = (m: Mode) => {
    setMode(m);
    setNotice(null);
  };

  const copy = {
    signin: ["Welcome back", "Sign in to keep tracking your meals."],
    signup: ["Create your account", "Snap your meals, get instant calories and macros."],
    reset: ["Reset password", "We'll email you a link to set a new password."],
  }[mode];

  return (
    <AuthShell title={copy[0]} description={copy[1]}>
      <div className="flex flex-col gap-6">
        {mode !== "reset" && (
          <Tabs value={mode} onValueChange={(v) => switchTo(v as Mode)}>
            <TabsList className="h-11 w-full rounded-full p-1">
              <TabsTrigger value="signin" className="rounded-full">
                Sign in
              </TabsTrigger>
              <TabsTrigger value="signup" className="rounded-full">
                Sign up
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {notice && (
          <Alert variant={notice.ok ? "default" : "destructive"} className={notice.ok ? "border-primary/30 text-primary" : ""}>
            <AlertDescription className={notice.ok ? "text-primary" : ""}>{notice.text}</AlertDescription>
          </Alert>
        )}

        {mode === "signin" && <SignInForm next={next} onNotice={setNotice} />}
        {mode === "signup" && <SignUpForm onNotice={setNotice} />}
        {mode === "reset" && <ResetForm onNotice={setNotice} />}

        {GOOGLE_ENABLED && mode !== "reset" && (
          <>
            <FieldSeparator>or</FieldSeparator>
            <GoogleButton next={next} onNotice={setNotice} />
          </>
        )}

        <div className="flex flex-col items-center gap-3 text-sm">
          {mode === "reset" ? (
            <Button variant="link" onClick={() => switchTo("signin")}>
              ← Back to sign in
            </Button>
          ) : (
            <Button variant="link" onClick={() => switchTo("reset")}>
              Forgot your password?
            </Button>
          )}
          <p className="text-center text-xs text-muted-foreground">
            By continuing you agree to our{" "}
            <Link href="/privacy" className="underline underline-offset-4">
              privacy policy
            </Link>
            .
          </p>
        </div>
      </div>
    </AuthShell>
  );
}

function SubmitButton({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" size="xl" className="w-full" disabled={busy}>
      {busy && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  );
}

function SignInForm({ next, onNotice }: { next: string; onNotice: (n: Notice) => void }) {
  const router = useRouter();
  const form = useForm<z.input<typeof signInSchema>, unknown, z.output<typeof signInSchema>>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    onNotice(null);
    const { error } = await createClient().auth.signInWithPassword(values);
    if (error) return onNotice({ ok: false, text: error.message });
    clearOfflineData(); // never show the last person's saved data
    router.replace(next);
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <TextField control={form.control} name="email" label="Email" type="email" autoComplete="email" placeholder="you@example.com" />
        <PasswordField control={form.control} name="password" label="Password" autoComplete="current-password" />
        <SubmitButton busy={form.formState.isSubmitting}>Sign in</SubmitButton>
      </FieldGroup>
    </form>
  );
}

function SignUpForm({ onNotice }: { onNotice: (n: Notice) => void }) {
  const router = useRouter();
  const form = useForm<z.input<typeof signUpSchema>, unknown, z.output<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async ({ name, email, password }) => {
    onNotice(null);
    // Only emails allowed by the sign-in-users flag can create an account; everyone else can request access
    const check = await fetch("/api/signup-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const { allowed } = (await check.json().catch(() => ({}))) as { allowed?: boolean };
    if (!check.ok) return onNotice({ ok: false, text: "Couldn't check your email. Please try again." });
    if (!allowed) return router.push(requestAccessUrl(email));

    const { data, error } = await createClient().auth.signUp({
      email,
      password,
      options: { data: { display_name: name || undefined }, emailRedirectTo: callback("/profile?welcome=1") },
    });
    if (error) return onNotice({ ok: false, text: error.message });
    if (data.session) {
      clearOfflineData();
      router.replace("/profile?welcome=1");
      router.refresh();
      return;
    }
    form.reset();
    onNotice({ ok: true, text: "Check your inbox to confirm your email, then come back and sign in." });
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <TextField control={form.control} name="name" label="Name (optional)" autoComplete="name" placeholder="Alex" />
        <TextField control={form.control} name="email" label="Email" type="email" autoComplete="email" placeholder="you@example.com" />
        <PasswordField
          control={form.control}
          name="password"
          label="Password"
          autoComplete="new-password"
          description="At least 6 characters."
        />
        <SubmitButton busy={form.formState.isSubmitting}>Create account</SubmitButton>
      </FieldGroup>
    </form>
  );
}

function ResetForm({ onNotice }: { onNotice: (n: Notice) => void }) {
  const form = useForm<z.input<typeof resetRequestSchema>, unknown, z.output<typeof resetRequestSchema>>({
    resolver: zodResolver(resetRequestSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit(async ({ email }) => {
    onNotice(null);
    const { error } = await createClient().auth.resetPasswordForEmail(email, { redirectTo: callback("/reset-password") });
    onNotice(error ? { ok: false, text: error.message } : { ok: true, text: "If that email has an account, a reset link is on its way." });
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <TextField control={form.control} name="email" label="Email" type="email" autoComplete="email" placeholder="you@example.com" />
        <SubmitButton busy={form.formState.isSubmitting}>Send reset link</SubmitButton>
      </FieldGroup>
    </form>
  );
}

function GoogleButton({ next, onNotice }: { next: string; onNotice: (n: Notice) => void }) {
  async function signIn() {
    onNotice(null);
    const { error } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback(next) } });
    if (error) onNotice({ ok: false, text: error.message });
  }
  return (
    <Button variant="outline" size="xl" className="w-full" onClick={signIn}>
      Continue with Google
    </Button>
  );
}
