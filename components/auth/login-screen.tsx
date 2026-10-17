"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export function LoginScreen({
  next,
  expired,
  configured,
}: {
  next: string;
  expired: boolean;
  configured: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <main className="flex min-h-screen items-start justify-center px-4 py-20">
      <form
        className="flex w-full max-w-md flex-col gap-5 rounded-xl border bg-card p-8"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setMessage("");
          try {
            const response = await fetch("/api/auth/email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: new FormData(event.currentTarget).get("email"),
                next,
              }),
            });
            const body = await response.json();
            setMessage(body.message || body.error);
          } catch {
            setMessage("Connection failed. Please retry.");
          } finally {
            setPending(false);
          }
        }}
      >
        <span className="font-display text-2xl font-semibold">Bridgify</span>
        <h1 className="text-xl font-semibold">
          Sign in or create your account
        </h1>
        <p className="text-sm text-muted-foreground">
          We’ll email you a secure sign-in link. No password to remember. To
          recover access, request another link using the same email address.
        </p>
        {expired && (
          <p role="alert">
            This link is invalid or expired. Request a new link. No project
            details have been revealed.
          </p>
        )}
        {!configured && (
          <p role="alert">
            Authentication needs configuration. Follow docs/ONBOARDING_SETUP.md
            to connect an empty Supabase project.
          </p>
        )}
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
        <Button disabled={pending || !configured}>
          {pending ? "Sending…" : "Email sign-in link"}
        </Button>
        <p aria-live="polite" className="text-sm">
          {message}
        </p>
        <p className="text-xs text-muted-foreground">
          Invited clients must use their invited email address. A forwarded link
          grants no access. If you lose access to your email account, recover
          that mailbox with your email provider.
        </p>
      </form>
    </main>
  );
}
