"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
export function AcceptInvite({ token }: { token: string }) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="grid gap-4">
      <Button
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            const response = await fetch("/api/v1/invitations/accept", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token }),
            });
            const body = await response.json();
            if (!response.ok)
              throw new Error(
                body.error?.message ||
                  "Invitation unavailable. Request a new link.",
              );
            window.location.assign(body.data.next);
          } catch (e) {
            setError((e as Error).message);
            setPending(false);
          }
        }}
      >
        {pending ? "Checking access…" : "Accept invitation"}
      </Button>
      <p role="alert">{error}</p>
    </div>
  );
}
