"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export function ResetPassword({ next }: { next: string }) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const router = useRouter();
  return (
    <form
      className="grid gap-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        const form = new FormData(event.currentTarget);
        try {
          const response = await fetch("/api/auth/password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "update_password",
              password: form.get("password"),
              password_confirmation: form.get("password_confirmation"),
              next,
            }),
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body.error);
          router.replace(body.next);
          router.refresh();
        } catch (error) {
          setError((error as Error).message);
          setPending(false);
        }
      }}
    >
      <fieldset disabled={pending} className="grid gap-5">
        <label className="grid gap-2">
          New password
          <Input
            type="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
          />
        </label>
        <label className="grid gap-2">
          Confirm new password
          <Input
            type="password"
            name="password_confirmation"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
          />
        </label>
        <Button>{pending ? "Saving…" : "Save new password"}</Button>
      </fieldset>
      <p role="alert">{error}</p>
    </form>
  );
}
