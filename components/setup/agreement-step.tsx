"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Bundle } from "@/lib/domain/types";
import {
  initialReview,
  reviewedAgreementSchema,
  type AgreementReview,
} from "@/lib/schemas/agreement";

async function submit(url: string, body: unknown, key = crypto.randomUUID()) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Idempotency-Key": key,
      ...(body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
    },
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok)
    throw Object.assign(
      new Error(
        json.error?.message ||
          "Agreement could not be saved. Retry or refresh to compare the saved version.",
      ),
      { status: response.status },
    );
  return json.data;
}
export function AgreementStep({ bundle }: { bundle: Bundle }) {
  const { project: p } = bundle;
  const doc =
    bundle.documents.find((d) => d.id === p.current_agreement_document_id) ||
    bundle.documents[0];
  const baseline = bundle.scope.find(
    (s) => s.version === p.scope_version && s.document_id === doc?.id,
  );
  const [review, setReview] = useState<AgreementReview | null>(
    () =>
      doc?.review_draft ||
      (doc?.extraction?.commercial ? initialReview(doc.extraction) : null),
  );
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState("Saved");
  const [confirmed, setConfirmed] = useState(false);
  const latest = useRef(review),
    saved = useRef(JSON.stringify(review)),
    version = useRef(doc?.review_version || 0);
  const inFlight = useRef<Promise<void> | null>(null);
  const retry = useRef<{ body: unknown; key: string; snapshot: string } | null>(
    null,
  );
  const router = useRouter();
  const submissionKeys = useRef(new Map<string, string>());
  async function send(url: string, body: unknown, explicitKey?: string) {
    if (explicitKey) return submit(url, body, explicitKey);
    const input =
      body instanceof FormData
        ? await Promise.all(
            [...body.entries()].map(async ([name, value]) => [
              name,
              value instanceof File
                ? Array.from(
                    new Uint8Array(
                      await crypto.subtle.digest(
                        "SHA-256",
                        await value.arrayBuffer(),
                      ),
                    ),
                  )
                : value,
            ]),
          )
        : body;
    const fingerprint = url + JSON.stringify(input);
    let key = submissionKeys.current.get(fingerprint);
    if (!key) {
      key = crypto.randomUUID();
      submissionKeys.current.set(fingerprint, key);
    }
    return submit(url, body, key);
  }
  const locked = !!p.activation_cutoff || p.status !== "draft";
  // Server writes are serialized and versioned. A lost response retries the exact idempotent command.
  async function flush() {
    if (inFlight.current) await inFlight.current;
    if (!doc || !latest.current || locked) return;
    const operation = async () => {
      while (
        saved.current !== JSON.stringify(latest.current) ||
        retry.current
      ) {
        const request = retry.current || {
          key: crypto.randomUUID(),
          snapshot: JSON.stringify(latest.current),
          body: {
            action: "review",
            expectedVersion: p.version,
            document_id: doc.id,
            expectedReviewVersion: version.current,
            review: latest.current,
          },
        };
        retry.current = request;
        setSaveState("Saving review…");
        const result = await send(
          `/api/v1/projects/${p.id}/agreement`,
          request.body,
          request.key,
        ).catch((error) => {
          if (error.status === 400 || error.status === 422)
            retry.current = null;
          throw error;
        });
        version.current = result.reviewVersion;
        saved.current = request.snapshot;
        retry.current = null;
      }
      setSaveState("Saved");
    };
    const promise = operation();
    inFlight.current = promise;
    try {
      await promise;
    } finally {
      if (inFlight.current === promise) inFlight.current = null;
    }
  }
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  });
  useEffect(() => {
    if (locked || !review || saved.current === JSON.stringify(review)) return;
    const timer = setTimeout(() => {
      void flushRef.current().catch((e) => {
        setSaveState("Review not saved");
        setError(e.message);
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [review, locked]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (saved.current !== JSON.stringify(latest.current) || retry.current)
        event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
  function change(next: AgreementReview) {
    latest.current = next;
    setReview(next);
    setConfirmed(false);
    setSaveState("Unsaved changes");
  }
  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Agreement operation failed");
    } finally {
      setBusy("");
    }
  }
  function commercial<K extends keyof AgreementReview["commercial"]>(
    key: K,
    patch: Partial<AgreementReview["commercial"][K]>,
  ) {
    if (!review) return;
    change({
      ...review,
      commercial: {
        ...review.commercial,
        [key]: { ...review.commercial[key], ...patch },
      },
      ...(key === "price"
        ? { price_choice: "" as const }
        : key === "due_date"
          ? { date_choice: "" as const }
          : {}),
    });
  }
  const spans = bundle.spans.filter((s) => s.document_id === doc?.id);
  function evidence(key: keyof AgreementReview["commercial"]) {
    const field = review!.commercial[key];
    return (
      <div className="grid gap-2">
        <label>
          Source page
          <select
            aria-label={`${key} source page`}
            value={field.span_id || ""}
            onChange={(e) =>
              commercial(key, { span_id: e.target.value || null })
            }
            className="ml-2 rounded border p-2"
          >
            <option value="">Not specified</option>
            {spans.map((s) => (
              <option key={s.id} value={s.id}>
                Page {s.page}
              </option>
            ))}
          </select>
        </label>
        <label>
          Exact contract excerpt
          <Textarea
            value={field.quote || ""}
            onChange={(e) => commercial(key, { quote: e.target.value || null })}
          />
        </label>
      </div>
    );
  }
  const priceMismatch =
    !!review &&
    review.commercial.price.amount_cents !== null &&
    (review.commercial.price.amount_cents !== p.original_amount_cents ||
      review.commercial.price.currency !== p.currency);
  const dateMismatch =
    !!review &&
    review.commercial.due_date.value !== null &&
    review.commercial.due_date.value !== p.agreed_due_date;
  return (
    <div className="grid gap-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          form.set("expectedVersion", String(p.version));
          void run("Analyzing agreement with Gemini…", async () => {
            try {
              await send(`/api/v1/projects/${p.id}/documents`, form);
            } finally {
              router.refresh();
            }
          });
        }}
        className="grid gap-4"
      >
        <fieldset disabled={!!busy || locked} className="grid gap-4">
          <label>
            Paste the complete agreement
            <Textarea name="text" rows={6} maxLength={30000} />
          </label>
          <label>
            Or upload a text PDF (5 MB, 50 pages maximum)
            <Input name="file" type="file" accept="application/pdf" />
          </label>
          <p className="text-sm text-muted-foreground">
            Private to your workspace. Maximum 30,000 extracted characters.
            Scanned PDFs require pasted text. A replacement invalidates the
            previous extraction and baseline.
          </p>
          <Button>
            {doc
              ? "Upload replacement / analyze new text"
              : "Upload / analyze agreement"}
          </Button>
        </fieldset>
      </form>
      {doc && !busy && (
        <p role="status">
          {doc.status === "ready"
            ? "Review ready"
            : ["queued", "processing"].includes(doc.status)
              ? "Analysis is pending or running. Use Analyze now to start or resume this saved agreement."
              : "Extraction needs attention"}{" "}
          ·{" "}
          {doc.kind === "pdf" ? "Private PDF saved" : "Pasted agreement saved"}
        </p>
      )}
      {!busy &&
        doc?.error &&
        ["failed", "unsupported"].includes(doc.status) && (
          <p role="alert">{doc.error}</p>
        )}
      {doc &&
        ["queued", "processing", "failed", "unsupported"].includes(
          doc.status,
        ) && (
          <Button
            disabled={!!busy || locked}
            onClick={() =>
              void run("Analyzing agreement with Gemini…", async () => {
                try {
                  await send(
                    `/api/v1/projects/${p.id}/agreement`,
                    {
                      action: ["failed", "unsupported"].includes(doc.status)
                        ? "retry"
                        : "analyze",
                      expectedVersion: p.version,
                      document_id: doc.id,
                    },
                    crypto.randomUUID(),
                  );
                } finally {
                  router.refresh();
                }
              })
            }
          >
            {["failed", "unsupported"].includes(doc.status)
              ? "Retry extraction"
              : "Analyze now"}
          </Button>
        )}
      {doc?.status === "ready" && !review && (
        <p role="alert">
          This older extraction lacks structured commercial fields. Import the
          agreement again to review it in this flow.
        </p>
      )}
      {doc?.status === "ready" && doc.extraction?.model && (
        <p className="text-sm text-muted-foreground">
          Analyzed with {doc.extraction.model}.
          {doc.extraction.fallback_from
            ? ` Used this fallback because ${doc.extraction.fallback_from} was unavailable or reached its request limit.`
            : ""}
        </p>
      )}
      {review && doc?.status === "ready" && (
        <>
          <p className="text-sm">
            Review all terms and their excerpts. Missing terms remain
            unspecified. Your edits save to a review draft; Continue creates the
            confirmed baseline.
          </p>
          <fieldset disabled={locked || !!busy} className="grid gap-5">
            {review.terms.map((term, i) => (
              <div key={i} className="grid gap-3 rounded border p-4">
                <label>
                  Category
                  <select
                    aria-label={`Term ${i + 1} category`}
                    className="ml-2 rounded border p-2"
                    value={term.kind}
                    onChange={(e) =>
                      change({
                        ...review,
                        terms: review.terms.map((t, n) =>
                          n === i
                            ? { ...t, kind: e.target.value as typeof t.kind }
                            : t,
                        ),
                      })
                    }
                  >
                    {[
                      "inclusion",
                      "exclusion",
                      "revision",
                      "date",
                      "responsibility",
                    ].map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Reviewed wording
                  <Textarea
                    value={term.text}
                    maxLength={2000}
                    onChange={(e) =>
                      change({
                        ...review,
                        terms: review.terms.map((t, n) =>
                          n === i ? { ...t, text: e.target.value } : t,
                        ),
                      })
                    }
                  />
                </label>
                <blockquote className="border-l-2 pl-3 text-sm">
                  Page {spans.find((s) => s.id === term.span_id)?.page}: “
                  {term.quote}”
                </blockquote>
                <button
                  type="button"
                  className="text-left text-sm underline"
                  onClick={() =>
                    change({
                      ...review,
                      terms: review.terms.filter((_, n) => n !== i),
                    })
                  }
                >
                  Remove draft term
                </button>
              </div>
            ))}
            <div className="grid gap-3 rounded border p-4">
              <h3 className="font-semibold">Price and currency</h3>
              <label>
                Agreement price (leave blank if unspecified)
                <Input
                  aria-label="Agreement price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    review.commercial.price.amount_cents === null
                      ? ""
                      : review.commercial.price.amount_cents / 100
                  }
                  onChange={(e) =>
                    commercial("price", {
                      amount_cents:
                        e.target.value === ""
                          ? null
                          : Math.round(Number(e.target.value) * 100),
                    })
                  }
                />
              </label>
              <label>
                ISO currency
                <Input
                  value={review.commercial.price.currency || ""}
                  maxLength={3}
                  onChange={(e) =>
                    commercial("price", {
                      currency: e.target.value.toUpperCase() || null,
                    })
                  }
                />
              </label>
              {evidence("price")}
              {priceMismatch && (
                <label className="rounded bg-muted p-3">
                  Price differs from Basics ({p.currency}{" "}
                  {(p.original_amount_cents / 100).toFixed(2)}).
                  <select
                    aria-label="Resolve price mismatch"
                    value={review.price_choice}
                    onChange={(e) =>
                      change({
                        ...review,
                        price_choice: e.target
                          .value as AgreementReview["price_choice"],
                      })
                    }
                  >
                    <option value="">Choose explicitly…</option>
                    <option value="basics">
                      Keep Basics price; retain agreement excerpt
                    </option>
                    <option value="agreement">
                      Update Basics to reviewed agreement price
                    </option>
                  </select>
                </label>
              )}
            </div>
            <div className="grid gap-3 rounded border p-4">
              <h3 className="font-semibold">Overall completion date</h3>
              <Input
                aria-label="Agreement completion date"
                type="date"
                value={review.commercial.due_date.value || ""}
                onChange={(e) =>
                  commercial("due_date", { value: e.target.value || null })
                }
              />
              {evidence("due_date")}
              {dateMismatch && (
                <label className="rounded bg-muted p-3">
                  Date differs from Basics ({p.agreed_due_date || "unspecified"}
                  ).
                  <select
                    aria-label="Resolve date mismatch"
                    value={review.date_choice}
                    onChange={(e) =>
                      change({
                        ...review,
                        date_choice: e.target
                          .value as AgreementReview["date_choice"],
                      })
                    }
                  >
                    <option value="">Choose explicitly…</option>
                    <option value="basics">
                      Keep Basics date; retain agreement excerpt
                    </option>
                    <option value="agreement">
                      Update Basics to reviewed agreement date
                    </option>
                  </select>
                </label>
              )}
            </div>
            <div className="grid gap-3 rounded border p-4">
              <h3 className="font-semibold">Revision allowance</h3>
              <Input
                aria-label="Revision allowance"
                type="number"
                min="0"
                max="10000"
                step="1"
                value={review.commercial.revision.allowance ?? ""}
                onChange={(e) =>
                  commercial("revision", {
                    allowance:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
              <label>
                Allowance means
                <select
                  aria-label="Revision unit"
                  value={review.commercial.revision.unit}
                  onChange={(e) =>
                    commercial("revision", {
                      unit: e.target
                        .value as AgreementReview["commercial"]["revision"]["unit"],
                    })
                  }
                >
                  {["ambiguous", "requests", "rounds", "not_specified"].map(
                    (unit) => (
                      <option key={unit}>{unit}</option>
                    ),
                  )}
                </select>
              </label>
              <p className="text-sm">
                “Two revisions” is ambiguous until you resolve what a revision
                means. Missing allowance can remain unspecified; automation must
                remain review-only.
              </p>
              {evidence("revision")}
            </div>
            {review.issues.map((issue, i) => (
              <label key={i} className="grid gap-2 rounded border p-4">
                Needs review: {issue.text}
                <Textarea
                  aria-label={`Resolution ${i + 1}`}
                  placeholder="Explain your correction, clarification, or explicitly acknowledge that the agreement leaves this unspecified."
                  value={issue.resolution}
                  onChange={(e) =>
                    change({
                      ...review,
                      issues: review.issues.map((v, n) =>
                        n === i ? { ...v, resolution: e.target.value } : v,
                      ),
                    })
                  }
                />
              </label>
            ))}
            {spans.map((span) => (
              <details key={span.id} className="rounded border p-4">
                <summary>Complete source · page {span.page}</summary>
                <pre className="my-4 max-h-80 overflow-auto whitespace-pre-wrap font-sans text-sm">
                  {span.text}
                </pre>
                <form
                  className="grid gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = new FormData(e.currentTarget);
                    const quote = String(form.get("quote"));
                    if (!quote.trim() || !span.text.includes(quote)) {
                      setError("Use an exact excerpt from this source page.");
                      return;
                    }
                    change({
                      ...review,
                      terms: [
                        ...review.terms,
                        {
                          kind: form.get(
                            "kind",
                          ) as AgreementReview["terms"][number]["kind"],
                          text: String(form.get("text")),
                          span_id: span.id,
                          quote,
                        },
                      ],
                    });
                    e.currentTarget.reset();
                  }}
                >
                  <label>
                    Missing term category
                    <select name="kind">
                      {[
                        "inclusion",
                        "exclusion",
                        "revision",
                        "date",
                        "responsibility",
                      ].map((k) => (
                        <option key={k}>{k}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Exact excerpt
                    <Input name="quote" required maxLength={4000} />
                  </label>
                  <label>
                    Missing term wording
                    <Input name="text" required maxLength={2000} />
                  </label>
                  <Button variant="outline">Add missing term</Button>
                </form>
              </details>
            ))}
            <label className="flex gap-3">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              I reviewed the entire agreement, source excerpts, missing terms,
              revision meaning and all flagged issues.
            </label>
          </fieldset>
          <p role="status">
            {saveState}
            {baseline
              ? " · Confirmed baseline exists; edits remain draft until Continue."
              : ""}
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              disabled={!!busy || locked}
              onClick={() => void run("Saving review…", flush)}
            >
              Save review draft
            </Button>
            <Button
              disabled={!confirmed || !!busy || locked}
              onClick={() =>
                void run("Confirming agreement…", async () => {
                  const parsed = reviewedAgreementSchema.safeParse(
                    latest.current,
                  );
                  if (!parsed.success)
                    throw new Error(
                      parsed.error.issues.map((i) => i.message).join(". "),
                    );
                  if (priceMismatch && !parsed.data.price_choice)
                    throw new Error("Resolve the price mismatch first.");
                  if (dateMismatch && !parsed.data.date_choice)
                    throw new Error("Resolve the date mismatch first.");
                  await flush();
                  await send(`/api/v1/projects/${p.id}/scope/confirm`, {
                    expectedVersion: p.version,
                    document_id: doc.id,
                    terms: parsed.data.terms,
                    review: parsed.data,
                    reviewed_all_terms: true,
                  });
                  router.push(`/app/projects/${p.id}/setup?step=3`);
                  router.refresh();
                })
              }
            >
              Confirm baseline & continue
            </Button>
          </div>
        </>
      )}
      {busy && <p role="status">{busy}</p>}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
