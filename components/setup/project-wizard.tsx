"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { INTRODUCTION, centsFromInput } from "@/lib/domain/security";
import type { Bundle } from "@/lib/domain/types";
import type { Term } from "@/lib/schemas/onboarding";
const steps = [
  "Basics",
  "Agreement",
  "People & chat",
  "Automation",
  "Review & activate",
];
function Field({
  label,
  name,
  value = "",
  type = "text",
  required = true,
}: {
  label: string;
  name: string;
  value?: string | number;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <Input name={name} type={type} defaultValue={value} required={required} />
    </label>
  );
}
function Check({
  name,
  children,
  checked = false,
}: {
  name: string;
  children: React.ReactNode;
  checked?: boolean;
}) {
  return (
    <label className="flex items-start gap-3 text-sm">
      <input
        className="mt-1"
        type="checkbox"
        name={name}
        defaultChecked={checked}
      />
      <span>{children}</span>
    </label>
  );
}
export function ProjectWizard({
  bundle,
  step = 1,
}: {
  bundle?: Bundle;
  step?: number;
}) {
  const p = bundle?.project,
    doc = bundle?.documents[0];
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [invite, setInvite] = useState("");
  const existing = bundle?.scope.find((s) => s.version === p?.scope_version);
  const [terms, setTerms] = useState<Term[]>(
    existing?.terms || doc?.extraction?.terms || [],
  );
  const router = useRouter(),
    keys = useRef(new Map<string, string>());
  useEffect(() => {
    if (doc && ["queued", "processing"].includes(doc.status)) {
      const timer = setInterval(() => router.refresh(), 3000);
      return () => clearInterval(timer);
    }
  }, [doc, router]);
  const locked = !!p?.activation_cutoff;
  async function send(url: string, body: unknown, method = "POST") {
    const fingerprint =
      body instanceof FormData
        ? JSON.stringify(
            await Promise.all(
              [...body.entries()].map(async ([key, value]) => [
                key,
                value instanceof File
                  ? {
                      name: value.name,
                      hash: Array.from(
                        new Uint8Array(
                          await crypto.subtle.digest(
                            "SHA-256",
                            await value.arrayBuffer(),
                          ),
                        ),
                      )
                        .map((b) => b.toString(16).padStart(2, "0"))
                        .join(""),
                    }
                  : value,
              ]),
            ),
          )
        : JSON.stringify(body);
    let key = keys.current.get(fingerprint);
    if (!key) {
      key = crypto.randomUUID();
      keys.current.set(fingerprint, key);
    }
    const response = await fetch(url, {
      method,
      headers: {
        ...(body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        "Idempotency-Key": key,
      },
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error?.message || "Request failed. Retry.");
    return data.data;
  }
  async function run(action: () => Promise<void>) {
    setPending(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  async function save(section: string, payload: unknown, nextStep: number) {
    const result = await send(
      p ? `/api/v1/projects/${p.id}` : "/api/v1/projects",
      p ? { expectedVersion: p.version, section, payload } : payload,
      p ? "PATCH" : "POST",
    );
    router.push(`/app/projects/${result.project.id}/setup?step=${nextStep}`);
    router.refresh();
  }
  const base = p ? `/app/projects/${p.id}/setup` : "/app/projects/new";
  return (
    <main className="mx-auto max-w-4xl p-5 md:p-10">
      <div className="mb-7 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Project onboarding {p ? `· ${p.status}` : ""}
          </p>
          <h1 className="font-display text-3xl font-semibold">
            {p?.name || "Create a project"}
          </h1>
        </div>
        <Link href="/app/projects" className="text-sm underline">
          All projects
        </Link>
      </div>
      <nav
        aria-label="Setup steps"
        className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-5"
      >
        {steps.map((label, index) => (
          <Link
            aria-current={step === index + 1 ? "step" : undefined}
            key={label}
            href={p ? `${base}?step=${index + 1}` : base}
            className={`rounded-lg border p-3 text-sm ${step === index + 1 ? "border-primary bg-accent font-semibold" : "text-muted-foreground"}`}
          >
            {index + 1}. {label}
          </Link>
        ))}
      </nav>
      {locked && (
        <p className="mb-5 rounded-lg border p-4">
          This setup has been activated and is retained as history. Material
          agreement changes require an approved amendment.
        </p>
      )}
      <section className="rounded-xl border bg-card p-5 md:p-8">
        <h2 className="mb-5 text-xl font-semibold">{steps[step - 1]}</h2>
        {step === 1 && (
          <form
            className="grid gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void run(async () => {
                await save(
                  "basics",
                  {
                    name: form.get("name"),
                    client_name: form.get("client_name"),
                    original_amount_cents: centsFromInput(
                      String(form.get("price")),
                    ),
                    currency: "USD",
                    timezone: form.get("timezone"),
                    agreed_due_date: form.get("due") || null,
                  },
                  2,
                );
              });
            }}
          >
            <fieldset
              disabled={pending || locked}
              className="grid gap-5 sm:grid-cols-2"
            >
              <Field label="Project name" name="name" value={p?.name} />
              <Field
                label="Client name"
                name="client_name"
                value={p?.client_name}
              />
              <Field
                label="Original agreed price (USD)"
                name="price"
                value={p ? (p.original_amount_cents / 100).toFixed(2) : "0.00"}
              />
              <Field
                label="Project timezone (IANA)"
                name="timezone"
                value={p?.timezone || "America/Los_Angeles"}
              />
              <Field
                label="Agreed completion date (optional)"
                name="due"
                type="date"
                required={false}
                value={p?.agreed_due_date || ""}
              />
              <p className="text-xs text-muted-foreground">
                The date is an agreed calendar date in the project timezone.
                Leave blank when no date is agreed.
              </p>
              <Button type="submit">Save basics & continue</Button>
            </fieldset>
          </form>
        )}
        {step === 2 && p && (
          <div className="grid gap-6">
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                form.set("expectedVersion", String(p.version));
                void run(async () => {
                  await send(`/api/v1/projects/${p.id}/documents`, form);
                  router.push(`${base}?step=2`);
                  router.refresh();
                });
              }}
            >
              <fieldset disabled={pending || locked} className="grid gap-4">
                <label className="grid gap-2">
                  Paste the complete agreement
                  <Textarea
                    name="text"
                    rows={7}
                    placeholder="Included work, exclusions, revision terms, dates and responsibilities…"
                  />
                </label>
                <label className="grid gap-2">
                  Or upload a text PDF (5 MB, 50 pages maximum)
                  <Input name="file" type="file" accept="application/pdf" />
                </label>
                <p className="text-xs text-muted-foreground">
                  30,000 characters maximum. Text is never silently shortened.
                  Scans and pages without usable text are unsupported. Files
                  remain private.
                </p>
                <Button type="submit">
                  {doc ? "Import replacement agreement" : "Import agreement"}
                </Button>
              </fieldset>
            </form>
            {doc && (
              <div className="grid gap-4">
                <p role="status">
                  Extraction: <strong>{doc.status}</strong>
                </p>
                {doc.error && <p role="alert">{doc.error}</p>}
                {["queued", "processing"].includes(doc.status) && (
                  <p>
                    Processing in the background. You can leave and return. The
                    document worker must be running.
                  </p>
                )}
                {doc.extraction && (
                  <>
                    <div className="rounded-md bg-muted p-4 text-sm">
                      <p>
                        Review every term and its evidence. Correct the
                        extracted wording and category where necessary. Removing
                        a term does not override the original agreement. Missing
                        terms can be added from source pages below.
                      </p>
                      <ul className="mt-2 list-disc pl-5">
                        {doc.extraction.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="grid gap-4">
                      {terms.map((term, index) => {
                        const span = bundle?.spans.find(
                          (s) => s.id === term.span_id,
                        );
                        return (
                          <div
                            key={index}
                            className="grid gap-3 rounded-lg border p-4"
                          >
                            <label>
                              Term type{" "}
                              <select
                                aria-label={`Term ${index + 1} category`}
                                className="ml-2 rounded border p-2"
                                disabled={locked}
                                value={term.kind}
                                onChange={(e) =>
                                  setTerms(
                                    terms.map((t, i) =>
                                      i === index
                                        ? {
                                            ...t,
                                            kind: e.target
                                              .value as Term["kind"],
                                          }
                                        : t,
                                    ),
                                  )
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
                            <label className="grid gap-2">
                              Confirmed wording
                              <Textarea
                                disabled={locked}
                                value={term.text}
                                onChange={(e) =>
                                  setTerms(
                                    terms.map((t, i) =>
                                      i === index
                                        ? { ...t, text: e.target.value }
                                        : t,
                                    ),
                                  )
                                }
                              />
                            </label>
                            <blockquote className="border-l-2 pl-3 text-sm">
                              Page {span?.page}: “{term.quote}”
                            </blockquote>
                            <button
                              className="w-fit text-sm underline"
                              type="button"
                              disabled={locked}
                              onClick={() =>
                                setTerms(terms.filter((_, i) => i !== index))
                              }
                            >
                              Remove draft term
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    {bundle?.spans
                      .filter((s) => s.document_id === doc.id)
                      .map((span) => (
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
                              if (!span.text.includes(quote)) {
                                setError(
                                  "The quote must exactly match this source page.",
                                );
                                return;
                              }
                              setTerms([
                                ...terms,
                                {
                                  kind: form.get("kind") as Term["kind"],
                                  text: String(form.get("wording")),
                                  quote,
                                  span_id: span.id,
                                },
                              ]);
                              e.currentTarget.reset();
                            }}
                          >
                            <label>
                              Category{" "}
                              <select
                                name="kind"
                                className="rounded border p-2"
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
                            <Field label="Exact source quote" name="quote" />
                            <Field label="Confirmed wording" name="wording" />
                            <Button disabled={locked} variant="outline">
                              Add missing term
                            </Button>
                          </form>
                        </details>
                      ))}
                    <form
                      className="grid gap-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = new FormData(e.currentTarget);
                        void run(() =>
                          save(
                            "scope",
                            {
                              document_id: doc.id,
                              terms,
                              reviewed_all_terms: form.get("reviewed") === "on",
                            },
                            3,
                          ),
                        );
                      }}
                    >
                      <Check name="reviewed">
                        I reviewed the full agreement, all extracted categories,
                        missing terms and source references. These terms
                        faithfully represent the agreement.
                      </Check>
                      <Button
                        disabled={pending || locked || doc.status !== "ready"}
                      >
                        Confirm baseline & continue
                      </Button>
                    </form>
                  </>
                )}
              </div>
            )}
          </div>
        )}
        {step === 3 && p && (
          <div className="grid gap-7">
            <div className="grid gap-3">
              <h3 className="font-semibold">
                1. Invite the designated requester and approver
              </h3>
              <p className="text-sm text-muted-foreground">
                Share the generated link with the client. They must sign in with
                this email and accept before you map their messaging identity.
                Replacing an invitation revokes the prior link and identity
                binding.
              </p>
              {bundle?.invitations.map((i) => (
                <p key={i.email} className="text-sm">
                  {i.email} ·{" "}
                  {i.accepted_at ? "Accepted" : "Waiting for acceptance"} ·
                  expires {new Date(i.expires_at).toLocaleDateString()}
                </p>
              ))}
              <form
                className="flex flex-wrap gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const email = new FormData(e.currentTarget).get("email");
                  void run(async () => {
                    const result = await send(
                      `/api/v1/projects/${p.id}/invitations`,
                      { expectedVersion: p.version, invitation: { email } },
                    );
                    setInvite(result.invitationUrl);
                    router.refresh();
                  });
                }}
              >
                <Input
                  className="max-w-sm"
                  aria-label="Client email"
                  name="email"
                  type="email"
                  required
                  placeholder="client@example.com"
                />
                <Button disabled={pending || locked}>
                  Create invitation link
                </Button>
              </form>
              {invite && (
                <div className="break-all rounded border p-3">
                  <p className="text-sm">
                    Share this invitation with the designated client:
                  </p>
                  <a className="text-sm underline" href={invite}>
                    {invite}
                  </a>
                </div>
              )}
              <Button variant="outline" onClick={() => router.refresh()}>
                Refresh client acceptance
              </Button>
            </div>
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                void run(() =>
                  save(
                    "people",
                    {
                      owner_sender_id: form.get("owner"),
                      client_sender_id: form.get("client"),
                      bot_sender_id: form.get("bot"),
                      instance_id: form.get("instance"),
                      chat_guid: form.get("chat"),
                      identities_confirmed: form.get("confirmed") === "on",
                    },
                    3,
                  ),
                );
              }}
            >
              <h3 className="font-semibold">
                2. Map identities to the exact project group
              </h3>
              <fieldset
                disabled={pending || locked || !bundle?.members.length}
                className="grid gap-4"
              >
                <Field
                  label="Owner iMessage sender ID (canonical email or E.164)"
                  name="owner"
                  value={p.people?.owner_sender_id}
                />
                <Field
                  label="Invited client iMessage sender ID"
                  name="client"
                  value={p.people?.client_sender_id}
                />
                <p className="text-xs text-muted-foreground">
                  This explicitly maps the accepted application user{" "}
                  {bundle?.members[0]?.user_id ||
                    "(client acceptance required)"}{" "}
                  to the client sender ID.
                </p>
                <Field
                  label="Provisioned bot sender ID"
                  name="bot"
                  value={p.people?.bot_sender_id}
                />
                <Field
                  label="Exact Photon instance ID"
                  name="instance"
                  value={p.people?.instance_id}
                />
                <Field
                  label="Exact provider chat GUID"
                  name="chat"
                  value={p.people?.chat_guid}
                />
                <Check name="confirmed">
                  I verified these identities with the participants. Email and
                  iMessage identities can differ. No display name establishes
                  authority.
                </Check>
                <Button>Save identity mapping</Button>
              </fieldset>
            </form>
            <div className="grid gap-4">
              <h3 className="font-semibold">
                3. Verify and introduce the assistant
              </h3>
              <blockquote className="rounded border p-4 text-sm">
                {INTRODUCTION}
              </blockquote>
              <p className="text-sm text-muted-foreground">
                With participant consent, this sends the introduction to the
                saved group. The server checks live membership and waits for its
                authenticated webhook echo. An uncertain send requires provider
                inspection.
              </p>
              <p className="text-sm">
                Test: {bundle?.binding?.test_state || "Not sent"} · Group
                verification:{" "}
                {bundle?.binding?.verified_at ? "Verified" : "Pending"}
              </p>
              {bundle?.binding?.hold_reason && (
                <p role="alert">{bundle.binding.hold_reason}</p>
              )}
              <Button
                disabled={
                  pending ||
                  !p.people ||
                  (!!bundle?.binding &&
                    ["sending", "unknown"].includes(bundle.binding.test_state))
                }
                onClick={() =>
                  void run(async () => {
                    const result = await send(
                      `/api/v1/projects/${p.id}/chat-test`,
                      { expectedVersion: p.version },
                    );
                    setNotice(result.message);
                    router.refresh();
                  })
                }
              >
                Send introduction & test linked group
              </Button>
              <div className="flex gap-4">
                <Button variant="outline" onClick={() => router.refresh()}>
                  Refresh verification
                </Button>
                <Button asChild>
                  <Link href={`${base}?step=4`}>Continue to automation</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
        {step === 4 && p && (
          <form
            className="grid gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(() =>
                save(
                  "policy",
                  {
                    mode: f.get("mode"),
                    allowance_mode: f.get("allowance_mode"),
                    allowance: Number(f.get("allowance")),
                    operations: f.getAll("operations"),
                    targets: String(f.get("targets"))
                      .split("\n")
                      .map((t) => t.trim())
                      .filter(Boolean),
                    exclusions: f.get("exclusions"),
                    max_open_tasks: Number(f.get("max_open_tasks")),
                    notifications: "dashboard",
                  },
                  5,
                ),
              );
            }}
          >
            <fieldset disabled={pending || locked} className="grid gap-5">
              <label className="grid gap-2">
                Automation mode
                <select
                  name="mode"
                  defaultValue={p.policy?.mode || "review_only"}
                  className="rounded border p-2"
                >
                  <option value="review_only">
                    Review only — owner decides all requests
                  </option>
                  <option value="enabled">
                    Automatically accept eligible routine requests
                  </option>
                </select>
              </label>
              <label className="grid gap-2">
                Revision accounting
                <select
                  name="allowance_mode"
                  defaultValue={p.policy?.allowance_mode || "per_request"}
                  className="rounded border p-2"
                >
                  <option value="per_request">
                    One unit per accepted request
                  </option>
                  <option value="manual_rounds">
                    Contract uses rounds — manual review required
                  </option>
                </select>
              </label>
              <Field
                label="Agreed revision allowance (defaults to zero)"
                name="allowance"
                type="number"
                value={p.policy?.allowance || 0}
              />
              <p className="text-sm text-muted-foreground">
                Revision rounds cannot be silently converted into per-request
                units. Agreements mentioning rounds require review-only
                handling.
              </p>
              <label className="flex gap-3 text-sm">
                <input
                  name="operations"
                  type="checkbox"
                  value="replace_text"
                  defaultChecked={p.policy?.operations.includes("replace_text")}
                />
                Replace exact text
              </label>
              <label className="flex gap-3 text-sm">
                <input
                  name="operations"
                  type="checkbox"
                  value="change_color"
                  defaultChecked={p.policy?.operations.includes("change_color")}
                />
                Change an existing element color
              </label>
              <label className="grid gap-2">
                Confirmed page/element target IDs (one per line)
                <Textarea
                  name="targets"
                  required
                  defaultValue={p.policy?.targets.join("\n")}
                />
              </label>
              <label className="grid gap-2">
                Exclusions and boundaries
                <Textarea
                  name="exclusions"
                  required
                  defaultValue={
                    p.policy?.exclusions ||
                    "No new pages, accounts, payments, integrations, prices or deadline commitments."
                  }
                />
              </label>
              <Field
                label="Maximum open automatic tasks (1–10)"
                name="max_open_tasks"
                type="number"
                value={p.policy?.max_open_tasks || 10}
              />
              <p className="text-sm">
                Owner exceptions go to the private dashboard. Paused and
                review-only projects retain messages without automatic
                acceptance.
              </p>
              <Button>Save automation & continue</Button>
            </fieldset>
          </form>
        )}
        {step === 5 && p && (
          <div className="grid gap-5">
            <p className="rounded border bg-muted p-4 text-sm">
              This release saves standing permissions and establishes verified
              message intake. Request analysis, automatic task creation and
              proposal responses are separate features and are not running yet.
            </p>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <dt>Client</dt>
              <dd>{p.client_name}</dd>
              <dt>Original price</dt>
              <dd>
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                }).format(p.original_amount_cents / 100)}
              </dd>
              <dt>Timezone</dt>
              <dd>{p.timezone}</dd>
              <dt>Agreed completion date</dt>
              <dd>{p.agreed_due_date || "No date agreed"}</dd>
              <dt>Confirmed baseline</dt>
              <dd>
                {p.scope_version ? `Version ${p.scope_version}` : "Required"}
              </dd>
              <dt>Client identity</dt>
              <dd>
                {bundle?.members.length
                  ? "Accepted and registered"
                  : "Required"}
              </dd>
              <dt>Chat verification</dt>
              <dd>{bundle?.binding?.verified_at ? "Verified" : "Required"}</dd>
              <dt>Policy</dt>
              <dd>
                {p.policy
                  ? `${p.policy.mode}; ${p.policy.allowance} ${p.policy.allowance_mode} units`
                  : "Required"}
              </dd>
            </dl>
            <p className="text-sm">
              Activation establishes the server timestamp cutoff. Earlier
              messages remain evidence and cannot trigger new work. Resuming
              also establishes a fresh cutoff. Completed and archived projects
              stop accepting work.
            </p>
            <blockquote className="rounded border p-4 text-sm">
              {INTRODUCTION}
            </blockquote>
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void run(async () => {
                  await save(
                    "lifecycle",
                    {
                      status:
                        p.policy?.mode === "enabled" ? "active" : "review_only",
                      reason: "Owner reviewed setup and activated project",
                      disclosed: f.get("disclosed") === "on",
                    },
                    5,
                  );
                });
              }}
            >
              <Check name="disclosed">
                All participants agreed to assistant processing, received the
                introduction, and know how to ask the owner to pause.
              </Check>
              <Button disabled={pending || locked}>
                Activate{" "}
                {p.policy?.mode === "enabled"
                  ? "automation"
                  : "in review-only mode"}
              </Button>
            </form>
            <Link href={`/app/projects/${p.id}`} className="underline">
              Open project overview
            </Link>
          </div>
        )}
        {pending && (
          <p role="status" className="mt-4 text-sm">
            Saving…
          </p>
        )}
        <p aria-live="polite" className="mt-4 text-sm">
          {notice}
        </p>
        {error && (
          <div
            role="alert"
            className="mt-4 rounded border border-destructive p-4 text-sm"
          >
            <p>{error}</p>
            <button className="mt-2 underline" onClick={() => router.refresh()}>
              Refresh saved state
            </button>
            <p className="mt-2">
              Your current form stays visible. If this is a version conflict,
              compare it with the refreshed state before saving again.
            </p>
          </div>
        )}
      </section>
      <p className="mt-5 text-xs text-muted-foreground">
        Each Save persists progress to your workspace. You can sign out and
        resume from Projects.
      </p>
    </main>
  );
}
