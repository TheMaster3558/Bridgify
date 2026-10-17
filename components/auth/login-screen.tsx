"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
type Mode = "signin" | "signup" | "recover";
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
  const [mode, setMode] = useState<Mode>(initialMode),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  const title =
    mode === "signup"
      ? "Create your account"
      : mode === "recover"
        ? "Reset your password"
        : "Sign in";
  function changeMode(mode: Mode) {
    setMode(mode);
    setMessage("");
  }
  return (
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
              : "Use your email and password to access your workspace or invitation."}
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
              </p>
            </>
          )}
          <Button disabled={pending || !configured}>
            {pending
              ? "Please wait…"
              : mode === "recover"
                ? "Send password reset link"
                : title}
          </Button>
        </fieldset>
        <p role="status" aria-live="polite" className="text-sm">
          {message}
        </p>
        <div className="grid gap-3 text-sm">
          {mode !== "signup" && (
            <button
              type="button"
              className="w-fit underline"
              disabled={pending}
              onClick={() => changeMode("signup")}
            >
              Create an account
            </button>
          )}
          {mode !== "signin" && (
            <button
              type="button"
              className="w-fit underline"
              disabled={pending}
              onClick={() => changeMode("signin")}
            >
              Back to sign in
            </button>
          )}
          {mode !== "recover" && (
            <button
              type="button"
              className="w-fit underline"
              disabled={pending}
              onClick={() => changeMode("recover")}
            >
              Forgot password?
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Invited clients must use their invited email address and accept their
          invitation. Signing in alone grants no project access.
        </p>
      </form>
    </main>
  );
}
