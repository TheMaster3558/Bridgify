"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function RecordResponse({
  proposalId,
  revision,
  version,
  projectVersion,
  termsHash,
  messages,
}: {
  proposalId: string;
  revision: number;
  version: number;
  projectVersion: number;
  termsHash: string;
  messages: { id: string; text: string; occurred_at: string }[];
}) {
  const router = useRouter();
  const [outcome, setOutcome] = useState("approved");
  const [evidence, setEvidence] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [key, setKey] = useState(() => crypto.randomUUID());
  return (
    <form
      className="grid gap-3 rounded border bg-card p-4"
      onChange={() => setKey(crypto.randomUUID())}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const r = await fetch(`/api/v1/proposals/${proposalId}/response`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": key,
            },
            body: JSON.stringify({
              revision,
              expectedVersion: version,
              expectedProjectVersion: projectVersion,
              termsHash,
              outcome,
              evidenceMessageIds: evidence,
              confirmed,
              note,
            }),
          });
          const v = await r.json();
          if (!r.ok)
            throw new Error(
              v.error?.message ?? "Response could not be recorded",
            );
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Response unavailable");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="font-semibold">Record the client’s decision</h2>
      <label className="grid gap-1">
        Outcome
        <select
          className="rounded border bg-background p-2"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
        >
          <option value="approved">Approved</option>
          <option value="declined">Declined</option>
          <option value="changes_requested">Changes requested</option>
        </select>
      </label>
      <fieldset className="grid gap-2">
        <legend>Client messages after this revision was sent</legend>
        {messages.map((m) => (
          <label className="flex gap-2 rounded border p-3" key={m.id}>
            <input
              type="checkbox"
              checked={evidence.includes(m.id)}
              onChange={(e) =>
                setEvidence((ids) =>
                  e.target.checked
                    ? [...ids, m.id]
                    : ids.filter((id) => id !== m.id),
                )
              }
            />
            <span className="whitespace-pre-wrap">
              {m.text}
              <small className="block">{m.occurred_at}</small>
            </span>
          </label>
        ))}
        {!messages.length && (
          <p>
            No matching messages on this page. Inspect older evidence pages or
            check message intake on the project Automation page.
          </p>
        )}
      </fieldset>
      <label className="grid gap-1">
        Your explanation
        <textarea
          className="rounded border bg-background p-2"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          minLength={3}
          maxLength={2000}
          required
        />
      </label>
      <label className="flex gap-2">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        I reviewed the evidence and confirm this decision applies to this exact
        revision and its frozen terms. Ambiguous messages require clarification
        first.
      </label>
      {error && <p role="alert">{error}</p>}
      <button
        className="w-fit rounded border px-4 py-2"
        disabled={
          busy ||
          !confirmed ||
          !evidence.length ||
          evidence.length > 10 ||
          note.trim().length < 3
        }
      >
        {busy ? "Recording…" : "Record client decision"}
      </button>
    </form>
  );
}
