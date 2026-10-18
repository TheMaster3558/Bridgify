"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { INTRODUCTION, centsFromInput } from "@/lib/domain/security";
import type { Bundle } from "@/lib/domain/types";
import { AgreementStep } from "./agreement-step";
import { PhotonClientPicker } from "./photon-client-picker";
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
    [notice, setNotice] = useState("");
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
            href={
              p ? `${base}?step=${Math.min(index + 1, p.setup_step)}` : base
            }
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
                    currency: String(form.get("currency")).toUpperCase(),
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
                label="Original agreed price"
                name="price"
                value={p ? (p.original_amount_cents / 100).toFixed(2) : "0.00"}
              />
              <Field
                label="ISO currency"
                name="currency"
                value={p?.currency || "USD"}
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
        {step === 2 && bundle && (
          <AgreementStep key={doc?.id + "-" + doc?.status} bundle={bundle} />
        )}
        {step === 3 && p && (
          <div className="grid gap-7">
            <PhotonClientPicker
              people={p.people}
              disabled={pending || locked}
              onConnect={(photonUserId) =>
                void run(async () => {
                  await send(`/api/v1/projects/${p.id}/chat-binding`, {
                    expectedVersion: p.version,
                    people: { photon_user_id: photonUserId },
                  });
                  router.refresh();
                })
              }
            />
            {p.people && (
              <Link
                className="text-sm underline"
                href={`/app/projects/${p.id}/conversation`}
              >
                View client iMessage conversation
              </Link>
            )}
            <div className="grid gap-4">
              <h3 className="font-semibold">2. Introduce the assistant</h3>
              <blockquote className="rounded border p-4 text-sm">
                {INTRODUCTION}
              </blockquote>
              <p className="text-sm text-muted-foreground">
                With your client&apos;s consent, this texts the introduction to{" "}
                {p.people?.client_name || "the connected client"} through
                Photon. An uncertain send must be checked with the client before
                retrying.
              </p>
              <p className="text-sm">
                Introduction: {bundle?.binding?.test_state || "Not sent"}
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
                Send introduction text
              </Button>
              <div className="flex gap-4">
                <Button variant="outline" onClick={() => router.refresh()}>
                  Refresh status
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
                  currency: p.currency,
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
                {p.people
                  ? `${p.people.client_name} · ${p.people.client_sender_id}`
                  : "Required"}
              </dd>
              <dt>iMessage</dt>
              <dd>
                {p.people
                  ? `${p.people.client_name} · ${p.people.client_sender_id}`
                  : "Required"}
              </dd>
              <dt>Introduction</dt>
              <dd>
                {bundle?.binding?.test_state === "sent"
                  ? "Sent"
                  : "Send introduction first"}
              </dd>
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
