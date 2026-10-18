"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { centsFromInput } from "@/lib/domain/security";
import {
  agreementErrors,
  termGroups,
  type FieldErrors,
} from "@/lib/projects/setup-validation";
import {
  FieldFeedback,
  SetupField,
  SetupForm,
  SetupSubmit,
} from "./setup-form";
import {
  useSetupContinue,
  type ContinueStateChange,
} from "./use-setup-continue";
import type { Bundle } from "@/lib/domain/types";
import {
  initialReview,
  reviewedAgreementSchema,
  reviewDraftSchema,
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
      {
        status: response.status,
        code: json.error?.code,
        fieldErrors: json.error?.fieldErrors?.fieldErrors,
      },
    );
  return json.data;
}
export function AgreementStep({
  bundle,
  onContinueState,
}: {
  bundle: Bundle;
  onContinueState?: ContinueStateChange;
}) {
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
  const [priceInput, setPriceInput] = useState(
    review?.commercial.price.amount_cents == null
      ? ""
      : (review.commercial.price.amount_cents / 100).toFixed(2),
  );
  const [revisionInput, setRevisionInput] = useState(
    String(review?.commercial.revision.allowance ?? ""),
  );
  const [invalidDateInput, setInvalidDateInput] = useState(false);
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
    if (
      locked ||
      !review ||
      !reviewDraftSchema.safeParse(review).success ||
      saved.current === JSON.stringify(review)
    )
      return;
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
    setError("");
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
  const errors = review ? agreementErrors(review, spans, p) : {};
  let validPriceInput = true;
  if (priceInput.trim()) {
    try {
      centsFromInput(priceInput);
    } catch {
      validPriceInput = false;
      errors["commercial.price.amount_cents"] =
        "Enter a price from 0 to 1,000,000 with no more than two decimal places.";
    }
  }
  const validRevisionInput =
    revisionInput === "" ||
    (/^\d+$/.test(revisionInput) && Number(revisionInput) <= 10000);
  if (!validRevisionInput)
    errors["commercial.revision.allowance"] =
      "Enter a whole number from 0 to 10,000, or leave blank if the agreement does not specify included changes.";
  if (invalidDateInput)
    errors["commercial.due_date.value"] =
      "Enter a complete, real date, or clear the date if none is agreed.";
  const canConfirm = review && !Object.keys(errors).length;
  function confirmAgreement() {
    if (!confirmed || !canConfirm || busy || locked || !doc || !latest.current)
      return;
    void run("Confirming agreement…", async () => {
      if (
        !latest.current ||
        Object.keys(agreementErrors(latest.current, spans, p)).length
      )
        return;
      const parsed = reviewedAgreementSchema.parse(latest.current);
      await flush();
      await send(`/api/v1/projects/${p.id}/scope/confirm`, {
        expectedVersion: p.version,
        document_id: doc.id,
        terms: parsed.terms,
        review: parsed,
        reviewed_all_terms: true,
      });
      router.push(`/app/projects/${p.id}/setup?step=3`);
      router.refresh();
    });
  }
  useSetupContinue(
    !!confirmed && !!canConfirm && !busy && !locked && doc?.status === "ready",
    confirmAgreement,
    onContinueState,
  );
  function evidence(key: keyof AgreementReview["commercial"]) {
    const field = review!.commercial[key];
    return (
      <details
        open={
          !!(
            errors[`commercial.${key}.span_id`] ||
            errors[`commercial.${key}.quote`]
          )
        }
        className="rounded border p-3"
      >
        <summary className="cursor-pointer text-sm">
          Check the contract excerpt
        </summary>
        <div className="mt-3 grid gap-3">
          <FieldFeedback
            label="Source page"
            name={`commercial.${key}.span_id`}
            errors={errors}
          >
            <select
              aria-label={`${key} source page`}
              value={field.span_id || ""}
              onChange={(e) =>
                commercial(key, { span_id: e.target.value || null })
              }
              className="rounded border p-2"
            >
              <option value="">Not stated in the agreement</option>
              {spans.map((s) => (
                <option key={s.id} value={s.id}>
                  Page {s.page}
                </option>
              ))}
            </select>
          </FieldFeedback>
          <FieldFeedback
            label="Exact contract excerpt"
            name={`commercial.${key}.quote`}
            errors={errors}
            hint="Copy the exact words from the source page. Do not paraphrase this excerpt."
          >
            <Textarea
              value={field.quote || ""}
              maxLength={4000}
              onChange={(e) =>
                commercial(key, { quote: e.target.value || null })
              }
            />
          </FieldFeedback>
        </div>
      </details>
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
      <SetupForm
        validate={validateUpload}
        disabled={!!busy || locked}
        onSave={async (form) => {
          form.set("expectedVersion", String(p.version));
          setBusy("Analyzing agreement…");
          try {
            await send(`/api/v1/projects/${p.id}/documents`, form);
          } finally {
            setBusy("");
            router.refresh();
          }
        }}
      >
        <SetupField
          label="Paste the complete agreement"
          name="text"
          hint="Paste text here, or upload a PDF below. Use one source at a time."
        >
          <Textarea name="text" rows={6} maxLength={30000} />
        </SetupField>
        <SetupField
          label="Or upload a text PDF (5 MB, 50 pages maximum)"
          name="file"
          hint="Scanned PDFs cannot be read. Paste their complete text instead."
        >
          <Input name="file" type="file" accept="application/pdf,.pdf" />
        </SetupField>
        <p className="text-sm text-muted-foreground">
          Your agreement is private to your workspace. Replacing it means
          reviewing and confirming the new agreement again.
        </p>
        <SetupSubmit>
          {doc
            ? "Upload replacement / analyze new text"
            : "Upload / analyze agreement"}
        </SetupSubmit>
      </SetupForm>
      {doc && !busy && (
        <p role="status">
          {doc.status === "ready"
            ? "Review ready"
            : ["queued", "processing"].includes(doc.status)
              ? "Your agreement is saved. Analysis is running or waiting to start."
              : "The agreement could not be read."}{" "}
          ·{" "}
          {doc.kind === "pdf" ? "Private PDF saved" : "Pasted agreement saved"}
        </p>
      )}
      {!busy &&
        doc?.error &&
        ["failed", "unsupported"].includes(doc.status) && (
          <div className="rounded border border-destructive p-4">
            <p className="font-medium">
              {doc.kind === "pdf"
                ? "Check your agreement PDF"
                : "Check your agreement text"}
            </p>
            <p role="alert" className="mt-2 text-sm text-destructive">
              {doc.error}
            </p>
            <p className="mt-2 text-sm">
              Retry analysis, or replace the agreement using the fields above.
            </p>
          </div>
        )}
      {doc &&
        ["queued", "processing", "failed", "unsupported"].includes(
          doc.status,
        ) && (
          <Button
            disabled={!!busy || locked}
            onClick={() =>
              void run("Analyzing agreement…", async () => {
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
        <p role="alert" className="rounded border border-destructive p-4">
          This saved agreement needs a fresh analysis. Upload or paste it again
          to review its price, dates and included changes.
        </p>
      )}
      {review && doc?.status === "ready" && (
        <>
          <div className="rounded-lg bg-muted p-4 text-sm">
            <p className="font-medium">
              Review what you and your client agreed
            </p>
            <p className="mt-1">
              Check the items below, edit any unclear wording and answer the
              questions. Original contract excerpts are available for every
              item. Your edits save as a draft until you confirm.
            </p>
          </div>
          <fieldset disabled={locked || !!busy} className="grid gap-6">
            {termGroups.map((group) => {
              const items = review.terms
                .map((term, i) => ({ term, i }))
                .filter(({ term }) => term.kind === group.kind);
              return (
                <section
                  key={group.kind}
                  className="grid gap-3"
                  aria-label={group.label}
                >
                  <div>
                    <h3 className="font-semibold">
                      {group.label}{" "}
                      <span className="text-sm font-normal text-muted-foreground">
                        ({items.length})
                      </span>
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {group.description}
                    </p>
                  </div>
                  {!items.length && (
                    <p className="rounded border border-dashed p-3 text-sm text-muted-foreground">
                      No items found in the agreement.
                    </p>
                  )}
                  {group.kind === "inclusion" && errors.terms && (
                    <p
                      role="alert"
                      className="rounded border border-destructive p-3 text-sm text-destructive"
                    >
                      {errors.terms}
                    </p>
                  )}
                  {items.map(({ term, i }) => (
                    <div
                      key={i}
                      className={`grid gap-3 rounded-lg border p-4 ${errors[`terms.${i}.text`] || errors[`terms.${i}.quote`] ? "border-destructive" : ""}`}
                    >
                      <FieldFeedback
                        label="Reviewed wording"
                        name={`terms.${i}.text`}
                        errors={errors}
                      >
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
                      </FieldFeedback>
                      <details>
                        <summary className="cursor-pointer text-sm text-muted-foreground">
                          View contract excerpt · page{" "}
                          {spans.find((s) => s.id === term.span_id)?.page ||
                            "unknown"}
                        </summary>
                        <blockquote className="my-3 whitespace-pre-wrap border-l-2 pl-3 text-sm">
                          “{term.quote}”
                        </blockquote>
                        <label className="grid gap-2 text-sm">
                          Move to section
                          <select
                            aria-label={`Term ${i + 1} category`}
                            className="rounded border p-2"
                            value={term.kind}
                            onChange={(e) =>
                              change({
                                ...review,
                                terms: review.terms.map((t, n) =>
                                  n === i
                                    ? {
                                        ...t,
                                        kind: e.target.value as typeof t.kind,
                                      }
                                    : t,
                                ),
                              })
                            }
                          >
                            {termGroups.map((g) => (
                              <option key={g.kind} value={g.kind}>
                                {g.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </details>
                      {errors[`terms.${i}.quote`] && (
                        <p role="alert" className="text-sm text-destructive">
                          {errors[`terms.${i}.quote`]}
                        </p>
                      )}
                      <button
                        type="button"
                        className="justify-self-start text-sm text-muted-foreground underline"
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
                </section>
              );
            })}
            <section className="grid gap-4 rounded-lg border p-4">
              <h3 className="font-semibold">Contract price</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldFeedback
                  label="Agreement price"
                  name="commercial.price.amount_cents"
                  errors={errors}
                  hint="Leave blank if the contract does not state a price."
                >
                  <Input
                    inputMode="decimal"
                    value={priceInput}
                    onChange={(e) => {
                      setPriceInput(e.target.value);
                      if (!e.target.value.trim())
                        commercial("price", { amount_cents: null });
                      else {
                        try {
                          commercial("price", {
                            amount_cents: centsFromInput(e.target.value),
                          });
                        } catch {
                          setConfirmed(false);
                        }
                      }
                    }}
                  />
                </FieldFeedback>
                <FieldFeedback
                  label="Currency"
                  name="commercial.price.currency"
                  errors={errors}
                  hint="For example, USD, EUR or GBP. Leave blank if not stated."
                >
                  <Input
                    value={review.commercial.price.currency || ""}
                    maxLength={3}
                    onChange={(e) =>
                      commercial("price", {
                        currency: e.target.value.toUpperCase() || null,
                      })
                    }
                  />
                </FieldFeedback>
              </div>
              {evidence("price")}
              {priceMismatch && (
                <FieldFeedback
                  label={`Which price should this project use? Basics has ${p.currency} ${(p.original_amount_cents / 100).toFixed(2)}.`}
                  name="price_choice"
                  errors={errors}
                >
                  <select
                    aria-label="Resolve price mismatch"
                    className="rounded border p-2"
                    value={review.price_choice}
                    onChange={(e) =>
                      change({
                        ...review,
                        price_choice: e.target
                          .value as AgreementReview["price_choice"],
                      })
                    }
                  >
                    <option value="">Choose a price…</option>
                    <option value="basics">Keep the price from Basics</option>
                    <option value="agreement">
                      Use the reviewed contract price
                    </option>
                  </select>
                </FieldFeedback>
              )}
            </section>
            <section className="grid gap-4 rounded-lg border p-4">
              <h3 className="font-semibold">Project completion date</h3>
              <FieldFeedback
                label="Agreement completion date"
                name="commercial.due_date.value"
                errors={errors}
                hint="Use the overall completion date. Leave blank if the agreement only lists milestones or has no date."
              >
                <Input
                  type="date"
                  value={review.commercial.due_date.value || ""}
                  onChange={(e) => {
                    setInvalidDateInput(!e.target.validity.valid);
                    commercial("due_date", { value: e.target.value || null });
                  }}
                />
              </FieldFeedback>
              {evidence("due_date")}
              {dateMismatch && (
                <FieldFeedback
                  label={`Which completion date should this project use? Basics has ${p.agreed_due_date || "no date"}.`}
                  name="date_choice"
                  errors={errors}
                >
                  <select
                    aria-label="Resolve date mismatch"
                    className="rounded border p-2"
                    value={review.date_choice}
                    onChange={(e) =>
                      change({
                        ...review,
                        date_choice: e.target
                          .value as AgreementReview["date_choice"],
                      })
                    }
                  >
                    <option value="">Choose a date…</option>
                    <option value="basics">Keep the date from Basics</option>
                    <option value="agreement">
                      Use the reviewed contract date
                    </option>
                  </select>
                </FieldFeedback>
              )}
            </section>
            <section className="grid gap-4 rounded-lg border p-4">
              <h3 className="font-semibold">Changes included in the price</h3>
              <p className="text-sm text-muted-foreground">
                A request is one individual change. A round is a batch of
                feedback reviewed together. Check which meaning your agreement
                uses.
              </p>
              <FieldFeedback
                label="Number of included changes or rounds"
                name="commercial.revision.allowance"
                errors={errors}
                hint="Leave blank only if the agreement does not specify a number."
              >
                <Input
                  aria-label="Number of included changes or rounds"
                  inputMode="numeric"
                  value={revisionInput}
                  onChange={(e) => {
                    const value = e.target.value;
                    setRevisionInput(value);
                    if (!value) commercial("revision", { allowance: null });
                    else if (/^\d+$/.test(value))
                      commercial("revision", { allowance: Number(value) });
                    else setConfirmed(false);
                  }}
                />
              </FieldFeedback>
              <FieldFeedback
                label="What does that number cover?"
                name="commercial.revision.unit"
                errors={errors}
              >
                <select
                  aria-label="What does that number cover?"
                  className="rounded border p-2"
                  value={review.commercial.revision.unit}
                  onChange={(e) =>
                    commercial("revision", {
                      unit: e.target
                        .value as AgreementReview["commercial"]["revision"]["unit"],
                    })
                  }
                >
                  <option value="ambiguous">
                    Needs clarification — choose a meaning
                  </option>
                  <option value="requests">Individual change requests</option>
                  <option value="rounds">Rounds of feedback</option>
                  <option value="not_specified">
                    The agreement does not specify included changes
                  </option>
                </select>
              </FieldFeedback>
              <p className="text-sm text-muted-foreground">
                Rounds of feedback and agreements without a specified number of
                changes need your approval for each request.
              </p>
              {evidence("revision")}
            </section>
            {!!review.issues.length && (
              <section className="grid gap-4" aria-label="Questions to review">
                <h3 className="font-semibold">Questions to review</h3>
                <p className="text-sm text-muted-foreground">
                  Clarify these points, or record that you understand the
                  agreement leaves them open.
                </p>
                {review.issues.map((issue, i) => (
                  <FieldFeedback
                    key={i}
                    label={issue.text}
                    name={`issues.${i}.resolution`}
                    errors={errors}
                  >
                    <Textarea
                      aria-label={`Resolution ${i + 1}`}
                      maxLength={2000}
                      placeholder="Describe your clarification, or acknowledge that this is not stated in the agreement."
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
                  </FieldFeedback>
                ))}
              </section>
            )}
            <section className="grid gap-3">
              <h3 className="font-semibold">
                Original agreement & missing items
              </h3>
              <p className="text-sm text-muted-foreground">
                Open a source page to check the complete text or add something
                the assistant missed.
              </p>
              {spans.map((span) => (
                <details key={span.id} className="rounded border p-4">
                  <summary className="cursor-pointer">
                    Complete source · page {span.page}
                  </summary>
                  <pre className="my-4 max-h-80 overflow-auto whitespace-pre-wrap font-sans text-sm">
                    {span.text}
                  </pre>
                  <MissingTermForm
                    span={span}
                    disabled={review.terms.length >= 100}
                    onAdd={(term) =>
                      change({ ...review, terms: [...review.terms, term] })
                    }
                  />
                </details>
              ))}
            </section>
            <label className="flex gap-3 rounded border p-4 text-sm">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-1"
              />
              I reviewed the entire agreement, source excerpts, missing terms,
              included changes and all flagged questions.
            </label>
          </fieldset>
          <p role="status">
            {saveState}
            {baseline
              ? " · A confirmed agreement exists. These edits are a draft until you confirm again."
              : ""}
          </p>
          {errors.review && (
            <p
              role="alert"
              className="rounded border border-destructive p-3 text-sm text-destructive"
            >
              {errors.review}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={
                !!busy ||
                locked ||
                !reviewDraftSchema.safeParse(review).success ||
                !validPriceInput ||
                !validRevisionInput ||
                invalidDateInput
              }
              onClick={() => void run("Saving review…", flush)}
            >
              Save review draft
            </Button>
            <Button
              disabled={!confirmed || !canConfirm || !!busy || locked}
              onClick={confirmAgreement}
            >
              Confirm agreement &amp; continue
            </Button>
          </div>
          {(!canConfirm || !confirmed) && (
            <p className="text-sm text-muted-foreground">
              To continue, complete the highlighted fields, answer each question
              and check the review confirmation above.
            </p>
          )}
        </>
      )}
      {busy && <p role="status">{busy}</p>}
      {error && (
        <p
          role="alert"
          className="rounded border border-destructive p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}

function validateUpload(form: FormData): FieldErrors {
  const text = String(form.get("text") || "").trim(),
    file = form.get("file");
  if (file instanceof File && file.name) {
    if (text)
      return {
        text: "Use either pasted text or a PDF. Clear this text to upload the PDF.",
        file: "Clear the pasted text above, or remove this PDF to analyze the text.",
      };
    if (!file.size)
      return {
        file: "This PDF is empty. Choose a PDF containing the agreement text.",
      };
    if (file.type !== "application/pdf" || !/\.pdf$/i.test(file.name))
      return { file: "Choose a PDF file, or paste the agreement text above." };
    if (file.size > 5242880)
      return {
        file: "This PDF is larger than 5 MB. Choose a smaller PDF or paste the complete agreement text.",
      };
    return {};
  }
  if (!text) return { text: "Paste your agreement, or choose a PDF below." };
  if (text.length > 30000)
    return {
      text: "Keep the complete agreement within 30,000 characters. No text will be cut off.",
    };
  return {};
}

function MissingTermForm({
  span,
  disabled,
  onAdd,
}: {
  span: Bundle["spans"][number];
  disabled: boolean;
  onAdd: (term: AgreementReview["terms"][number]) => void;
}) {
  const validate = useCallback(
    (form: FormData): FieldErrors => {
      const errors: FieldErrors = {},
        quote = String(form.get("quote") || ""),
        text = String(form.get("text") || "");
      if (!quote.trim() || !span.text.includes(quote))
        errors.quote = "Copy an exact excerpt from this source page.";
      if (!text.trim())
        errors.text = "Describe this part of the agreement in plain language.";
      return errors;
    },
    [span.text],
  );
  return (
    <SetupForm
      validate={validate}
      disabled={disabled}
      resetOnSave
      onSave={async (form) =>
        onAdd({
          kind: form.get("kind") as AgreementReview["terms"][number]["kind"],
          text: String(form.get("text")).trim(),
          quote: String(form.get("quote")),
          span_id: span.id,
        })
      }
    >
      <SetupField label="Section for this item" name="kind">
        <select name="kind" className="rounded border p-2">
          {termGroups.map((g) => (
            <option key={g.kind} value={g.kind}>
              {g.label}
            </option>
          ))}
        </select>
      </SetupField>
      <SetupField label="Exact excerpt" name="quote">
        <Textarea name="quote" required maxLength={4000} />
      </SetupField>
      <SetupField label="Missing item description" name="text">
        <Input name="text" required maxLength={2000} />
      </SetupField>
      <SetupSubmit>Add missing term</SetupSubmit>
    </SetupForm>
  );
}
