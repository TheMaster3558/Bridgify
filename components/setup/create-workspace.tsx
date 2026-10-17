"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
export function CreateWorkspace() {
  const router = useRouter();
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="grid max-w-md gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError("");
        try {
          const response = await fetch("/api/v1/workspaces", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: new FormData(e.currentTarget).get("name"),
            }),
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body.error.message);
          router.push("/app");
          router.refresh();
        } catch (e) {
          setError((e as Error).message);
          setPending(false);
        }
      }}
    >
      <label className="grid gap-2">
        Workspace name
        <Input
          name="name"
          required
          maxLength={120}
          autoComplete="organization"
        />
      </label>
      <Button disabled={pending}>
        {pending ? "Creating…" : "Create owner workspace"}
      </Button>
      <p role="alert">{error}</p>
    </form>
  );
}
