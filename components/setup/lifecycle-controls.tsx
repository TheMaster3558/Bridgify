"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export function LifecycleControls({
  id,
  version,
  status,
  mode,
}: {
  id: string;
  version: number;
  status: string;
  mode: string;
}) {
  const [disclosed,setDisclosed]=useState(false);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const options =
    status === "archived"
      ? []
      : status === "completed"
        ? ["archived"]
        : status === "draft"
          ? ["archived"]
          : [
              ...(status === "paused"
                ? [mode === "enabled" ? "active" : "review_only"]
                : ["paused"]),
              "completed",
              "archived",
            ];
  if (!options.length) return null;
  return (
    <form
      className="grid gap-3 rounded-lg border p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const next = String(form.get("status"));
        if (
          ["completed", "archived"].includes(next) &&
          !window.confirm(
            `Mark this project ${next}? It will stop accepting new work. History is retained.`,
          )
        )
          return;
        setPending(true);
        setError("");
        try {
          const response = await fetch(`/api/v1/projects/${id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": crypto.randomUUID(),
            },
            body: JSON.stringify({
              expectedVersion: version,
              section: "lifecycle",
              payload: {
                status: next,
                reason: form.get("reason"),
                disclosed,
              },
            }),
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body.error.message);
          window.location.reload();
        } catch (e) {
          setError((e as Error).message);
          setPending(false);
        }
      }}
    >
      <h2 className="font-semibold">Project lifecycle</h2>
      <label className="grid gap-2">
        New state
        <select className="rounded border p-2" name="status">
          {options.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2">
        Reason
        <Input name="reason" required minLength={3} maxLength={1000} />
      </label>
      <p className="text-xs text-muted-foreground">
        Pause keeps existing work and history. Resume sets a fresh cutoff;
        earlier messages require owner review. Completion and archive cannot be
        undone through this setup flow.
      </p>
      {status === "paused" && <label className="flex gap-2 text-sm"><input type="checkbox" checked={disclosed} onChange={e=>setDisclosed(e.target.checked)}/>I verified the client identity and their consent to assistant processing before resuming.</label>}
      <Button disabled={pending}>
        {pending ? "Saving…" : "Update project state"}
      </Button>
      <p role="alert">{error}</p>
    </form>
  );
}
