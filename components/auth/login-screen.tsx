"use client";
import { useState } from "react";
import { AuthCard } from "@/components/application/auth/auth-card";
import { Button } from "@/components/base/buttons/button";
import { LinkButton } from "@/components/base/buttons/link-button";
import { Input } from "@/components/base/input/input";
type Mode = "signin" | "signup" | "recover";
const INVITE_NOTE =
  "Invited clients must use their invited email address and accept their invitation. Signing in alone grants no project access.";
export function LoginScreen({
  next,
  expired,
  configured,
  initialMode = "signin",
}: {
  next: string;
  expired: boolean;
  configured: boolean;
  initialMode?: Mode;
}) {
  const mode = initialMode;
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  const href = (target: Mode) => {
    const params = new URLSearchParams({ next });
    if (target !== "signin") params.set("mode", target);
    return `/login?${params}`;
  };
  async function submit(form: FormData) {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode,
          email: form.get("email"),
          ...(mode !== "recover" ? { password: form.get("password") } : {}),
          ...(mode === "signup"
            ? { password_confirmation: form.get("confirmPassword") }
            : {}),
          next,
        }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Authentication failed. Please retry.");
      // A full load, so the auth screen's BoardUI stylesheet doesn't carry into the app.
      if (body.next) window.location.assign(body.next);
      else {
        setMessage(body.message);
        setPending(false);
      }
    } catch (error) {
      setMessage((error as Error).message);
      setPending(false);
    }
  }
  const status =
    message ||
    (!configured
      ? "Authentication needs configuration. Follow docs/ONBOARDING_SETUP.md to connect Supabase."
      : expired
        ? "This password reset link is invalid or expired. Request another reset link."
        : "");
  return (
<<<<<<< HEAD
    <main className="flex min-h-screen items-start justify-center bg-background-full px-4 py-20">
      {mode === "recover" ? (
        <div className="flex w-full flex-col items-center gap-4">
          <div className="flex w-full max-w-[400px] flex-col rounded-3xl border border-border-button-default bg-background-primary-default p-6 shadow-xs sm:p-8">
            <div className="flex flex-col gap-1.5">
              <h1 className="text-title-2-medium text-text-primary">
                Reset your password
              </h1>
              <p className="text-body-regular text-text-secondary">
                Enter your account email to request a password reset link.
=======
    <main className="flex min-h-screen items-start justify-center px-4 py-20">
      <form
        className="flex w-full max-w-md flex-col gap-5 rounded-xl border bg-card p-8"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setMessage("");
          const form = new FormData(event.currentTarget);
          try {
            const response = await fetch("/api/auth/password", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: mode,
                email: form.get("email"),
                ...(mode !== "recover"
                  ? { password: form.get("password") }
                  : {}),
                ...(mode === "signup"
                  ? { password_confirmation: form.get("password_confirmation") }
                  : {}),
                next,
              }),
            });
            const body = await response.json();
            if (!response.ok)
              throw new Error(
                body.error || "Authentication failed. Please retry.",
              );
            if (body.next) {
              router.replace(body.next);
              router.refresh();
            } else setMessage(body.message);
          } catch (error) {
            setMessage((error as Error).message);
          } finally {
            setPending(false);
          }
        }}
      >
        <span className="font-display text-2xl font-semibold">Bridgify</span>
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">
          {mode === "signup"
            ? "Create an account with your email and password to get started immediately."
            : mode === "recover"
              ? "Enter your account email to request a password reset link."
              : "Use your email and password to access your owner workspace."}
        </p>
        {expired && (
          <p role="alert">
            This password reset link is invalid or expired. Request another
            reset link.
          </p>
        )}
        {!configured && (
          <p role="alert">
            Authentication needs configuration. Follow docs/ONBOARDING_SETUP.md
            to connect Supabase.
          </p>
        )}
        <fieldset disabled={pending} className="grid gap-5">
          <label className="grid gap-2">
            Email
            <Input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
            />
          </label>
          {mode !== "recover" && (
            <label className="grid gap-2">
              Password
              <Input
                key={mode}
                name="password"
                type="password"
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                required
                minLength={mode === "signup" ? 8 : 1}
                maxLength={mode === "signup" ? 72 : 1024}
              />
            </label>
          )}
          {mode === "signup" && (
            <>
              <label className="grid gap-2">
                Confirm password
                <Input
                  name="password_confirmation"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={72}
                />
              </label>
              <p className="text-xs text-muted-foreground">
                Use 8–72 characters. No email verification is required.
>>>>>>> origin/main
              </p>
            </div>
            <form
              className="mt-6 flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                submit(new FormData(event.currentTarget));
              }}
            >
              <Input
                name="email"
                type="email"
                label="Email"
                placeholder="you@company.com"
                autoComplete="email"
                isRequired
              />
              {status ? (
                <p
                  role="status"
                  aria-live="polite"
                  className="text-body-regular text-text-secondary"
                >
                  {status}
                </p>
              ) : null}
              <Button
                type="submit"
                className="w-full"
                disabled={pending || !configured}
              >
                {pending ? "Please wait…" : "Send password reset link"}
              </Button>
            </form>
            <p className="mt-6 text-center text-body-regular text-text-secondary">
              Remembered it?{" "}
              <LinkButton href={href("signin")}>Back to sign in</LinkButton>
            </p>
          </div>
          <p className="max-w-[520px] text-center text-caption-1-regular text-text-tertiary">
            {INVITE_NOTE}
          </p>
        </div>
<<<<<<< HEAD
      ) : (
        <AuthCard
          mode={mode}
          providers={[]}
          confirmPassword={mode === "signup"}
          description={
            mode === "signup"
              ? "Create an account with your email and password to get started immediately."
              : undefined
          }
          onSubmit={submit}
          pending={pending}
          status={status}
          switchHref={href(mode === "signup" ? "signin" : "signup")}
          forgotHref={href("recover")}
          footnote={INVITE_NOTE}
        />
      )}
=======
        <p className="text-xs text-muted-foreground">
          This website is for project owners. Clients communicate through iMessage and do not need a website account.
        </p>
      </form>
>>>>>>> origin/main
    </main>
  );
}
