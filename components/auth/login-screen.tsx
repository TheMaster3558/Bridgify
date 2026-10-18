"use client";
import { useState } from "react";
import { AuthCard } from "@/components/application/auth/auth-card";
import { Button } from "@/components/base/buttons/button";
import { LinkButton } from "@/components/base/buttons/link-button";
import { Input } from "@/components/base/input/input";
type Mode = "signin" | "signup" | "recover";
const INVITE_NOTE =
  "This workspace is for project owners. Clients communicate through the connected iMessage conversation.";
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
    </main>
  );
}
