"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { INTRODUCTION } from "@/lib/domain/security";
import { basicsPayload, validateBasics } from "@/lib/projects/setup-validation";
import {
  SetupField,
  SetupForm,
  SetupSubmit,
  FieldFeedback,
} from "./setup-form";
import { AutomationSetup } from "./automation-setup";
import type { Bundle } from "@/lib/domain/types";
import { AgreementStep } from "./agreement-step";
import { PhotonClientPicker } from "./photon-client-picker";
import { CurrencyInput, TimeZoneInput } from "./suggestion-input";
import { activationIssues } from "@/lib/projects/activation-readiness";
function IntroductionDraft({
  initial,
  onText,
  disabled,
  ...props
}: {
  initial: string;
  onText: (value: string) => void;
  disabled?: boolean;
} & Omit<ComponentProps<typeof Textarea>, "value" | "onChange" | "defaultValue">) {
  const [text, setText] = useState(initial);
  return (
    <Textarea
      rows={6}
      maxLength={4000}
      {...props}
      value={text}
      disabled={disabled}
      onChange={(event) => {
        setText(event.target.value);
        onText(event.target.value);
      }}
    />
  );
}

const steps = [
  "Basics",
  "Agreement",
  "People & chat",
  "Automation",
  "Review & activate",
];
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
  const introductionRef = useRef(
    bundle?.binding?.introduction_text || INTRODUCTION,
  );
  const [introductionEmpty, setIntroductionEmpty] = useState(
    !introductionRef.current.trim(),
  );
  const onIntroduction = useCallback((text: string) => {
    introductionRef.current = text;
    const empty = !text.trim();
    setIntroductionEmpty((current) => (current === empty ? current : empty));
    setError((current) => (current ? "" : current));
  }, []);
  const [consented, setConsented] = useState(false);
  const consentInput = useRef<HTMLInputElement>(null);
  const [errorTarget, setErrorTarget] = useState("");
  const [continuation, setContinuation] = useState<{
    step: number;
    ready: boolean;
    proceed: () => void;
  } | null>(null);
  const onContinueState = useCallback(
    (ready: boolean, proceed: () => void) => {
      setContinuation({ step, ready, proceed });
    },
    [step],
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
      throw Object.assign(
        new Error(
          data.error?.message ||
            "This step could not be saved. Check your connection and try again.",
        ),
        {
          code: data.error?.code,
          fieldErrors: data.error?.fieldErrors?.fieldErrors,
        },
      );
    return data.data;
  }
  async function run(action: () => Promise<void>, target = "") {
    setPending(true);
    setError("");
    setNotice("");
    setErrorTarget(target);
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
    const destination =
      section === "lifecycle" &&
      ["active", "review_only"].includes(result.project.status)
        ? `/app/projects/${result.project.id}`
        : `/app/projects/${result.project.id}/setup?step=${nextStep}`;
    router.push(destination);
    router.refresh();
  }
  const base = p ? `/app/projects/${p.id}/setup` : "/app/projects/new";
  const canContinuePeople =
    !!p?.people &&
    !pending &&
    bundle?.binding?.test_state === "sent" &&
    !bundle.binding.hold_reason;
  const canContinue =
    step === 3
      ? canContinuePeople
      : continuation?.step === step && continuation.ready;
  function goToStep(target: number) {
    if (target === step) return;
    if (locked || target < step) {
      if (p && target <= p.setup_step) router.push(`${base}?step=${target}`);
      return;
    }
    if (target !== step + 1 || !canContinue) return;
    if (step === 3) router.push(`${base}?step=4`);
    else continuation?.proceed();
  }
  const activationBlockers = bundle ? activationIssues(bundle) : [];
  const readyToActivate = !!p && !activationBlockers.length;
  function stepError(target: string) {
    return error && errorTarget === target ? (
      <p
        role="alert"
        className="rounded border border-destructive p-3 text-sm text-destructive"
      >
        {error}
      </p>
    ) : null;
  }
  return (
    <main className="mx-auto max-w-4xl p-5 md:p-10">
      <div className="mb-7 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Project setup{" "}
            {p
              ? `· ${{ draft: "Draft", active: "Active", review_only: "Manual approval", paused: "Paused", completed: "Completed", archived: "Archived" }[p.status] || "Saved"}`
              : ""}
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
          <button
            type="button"
            aria-current={step === index + 1 ? "step" : undefined}
            key={label}
            disabled={
              locked
                ? index + 1 > (p?.setup_step || step)
                : index + 1 > step && (index + 1 !== step + 1 || !canContinue)
            }
            onClick={() => goToStep(index + 1)}
            className={`rounded-lg border p-3 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50 ${step === index + 1 ? "border-primary bg-accent font-semibold" : "text-muted-foreground"}`}
          >
            {index + 1}. {label}
          </button>
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
          <SetupForm
            validate={validateBasics}
            onContinueState={onContinueState}
            disabled={locked}
            onSave={(form) => save("basics", basicsPayload(form), 2)}
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <SetupField label="Project name" name="name">
                <Input
                  name="name"
                  defaultValue={p?.name}
                  required
                  maxLength={120}
                  autoComplete="off"
                />
              </SetupField>
              <SetupField label="Client name" name="client_name">
                <Input
                  name="client_name"
                  defaultValue={p?.client_name}
                  required
                  maxLength={120}
                  autoComplete="name"
                />
              </SetupField>
              <SetupField
                label="Original agreed price"
                name="price"
                hint="Enter an amount, such as 250.00. Use 0 for an unpaid project."
              >
                <Input
                  name="price"
                  defaultValue={
                    p ? (p.original_amount_cents / 100).toFixed(2) : "0.00"
                  }
                  required
                  inputMode="decimal"
                />
              </SetupField>
              <SetupField
                label="Currency"
                name="currency"
                hint="Choose a three-letter currency code, such as USD or EUR."
              >
                <CurrencyInput
                  name="currency"
                  defaultValue={p?.currency || "USD"}
                  required
                  maxLength={3}
                />
              </SetupField>
              <SetupField
                label="Project time zone"
                name="timezone"
                hint="Dates use this time zone. Search by region or city."
              >
                <TimeZoneInput
                  name="timezone"
                  defaultValue={
                    p?.timezone ||
                    Intl.DateTimeFormat().resolvedOptions().timeZone
                  }
                  required
                />
              </SetupField>
              <SetupField
                label="Agreed completion date (optional)"
                name="due"
                hint="Leave blank if you have not agreed on a completion date."
              >
                <Input
                  name="due"
                  type="date"
                  defaultValue={p?.agreed_due_date || ""}
                />
              </SetupField>
            </div>
            <SetupSubmit>Save basics &amp; continue</SetupSubmit>
          </SetupForm>
        )}
        {step === 2 && bundle && (
          <AgreementStep
            key={doc?.id + "-" + doc?.status}
            bundle={bundle}
            onContinueState={onContinueState}
          />
        )}
        {step === 3 && p && (
          <div className="grid gap-7">
            <PhotonClientPicker
              projectId={p.id}
              people={p.people}
              error={errorTarget === "people" ? error : undefined}
              disabled={pending || locked}
              onConnect={(photonUserId) =>
                void run(async () => {
                  await send(`/api/v1/projects/${p.id}/chat-binding`, {
                    expectedVersion: p.version,
                    people: { photon_user_id: photonUserId },
                  });
                  router.refresh();
                }, "people")
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
              <FieldFeedback
                label="Introduction message"
                name="introduction"
                errors={
                  errorTarget === "introduction" && error
                    ? { introduction: error }
                    : introductionEmpty
                      ? {
                          introduction:
                            "Write an introduction before sending it to your client.",
                        }
                      : {}
                }
                hint="Personalize this message before sending. Explain what the assistant does and how your client can ask you to pause it."
              >
                <IntroductionDraft
                  initial={introductionRef.current}
                  onText={onIntroduction}
                  disabled={
                    pending ||
                    locked ||
                    ["sending", "unknown"].includes(
                      bundle?.binding?.test_state || "",
                    )
                  }
                />
              </FieldFeedback>
              <p className="text-sm text-muted-foreground">
                With your client&apos;s consent, this texts the introduction to{" "}
                {p.people?.client_name || "the connected client"} through
                Photon. An uncertain send must be checked with the client before
                retrying.
              </p>
              <p className="text-sm">
                Introduction:{" "}
                {{
                  sent: "Sent to client",
                  sending: "Sending…",
                  unknown: "Check with your client before retrying",
                  failed: "Could not send — try again",
                }[bundle?.binding?.test_state || ""] || "Not sent"}
              </p>
              {bundle?.binding?.hold_reason && (
                <p role="alert">{bundle.binding.hold_reason}</p>
              )}
              <Button
                disabled={
                  pending ||
                  locked ||
                  introductionEmpty ||
                  !p.people ||
                  (!!bundle?.binding &&
                    ["sending", "unknown"].includes(bundle.binding.test_state))
                }
                onClick={() =>
                  void run(async () => {
                    const result = await send(
                      `/api/v1/projects/${p.id}/chat-test`,
                      {
                        expectedVersion: p.version,
                        introduction: introductionRef.current,
                      },
                    );
                    setNotice(result.message);
                    router.refresh();
                  }, "introduction")
                }
              >
                Send introduction text
              </Button>
              <div className="flex gap-4">
                <Button variant="outline" onClick={() => router.refresh()}>
                  Refresh status
                </Button>
                <Button
                  disabled={!canContinuePeople}
                  onClick={() => goToStep(4)}
                >
                  Continue to automation
                </Button>
              </div>
            </div>
          </div>
        )}
        {step === 4 && p && (
          <AutomationSetup
            project={p}
            bundle={bundle!}
            locked={locked}
            onContinueState={onContinueState}
            onSave={(payload) => save("policy", payload, 5)}
          />
        )}
        {step === 5 && p && (
          <div className="grid gap-5">
            <p className="rounded border bg-muted p-4 text-sm">
              Once activated, the assistant evaluates new client messages
              against the confirmed agreement and these settings, creates tasks
              or review items, and sends appropriate updates through iMessage.
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
              <dt>Reviewed agreement</dt>
              <dd>
                {p.scope_version ? "Confirmed" : "Review the agreement first"}
              </dd>
              <dt>Connected client</dt>
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
                  ? `${p.policy.mode === "enabled" ? "Accept permitted changes automatically" : "You approve every request"} · ${p.policy.allowance} ${p.policy.allowance_mode === "manual_rounds" ? "rounds of feedback" : "individual changes"} included`
                  : "Required"}
              </dd>
            </dl>
            <p className="text-sm">
              The assistant starts handling new messages after you activate this
              project. Earlier messages stay available for context.
            </p>
            {bundle?.binding?.introduction_text && (
              <div className="grid gap-2">
                <h3 className="font-medium">
                  Introduction sent to your client
                </h3>
                <blockquote className="whitespace-pre-wrap rounded border p-4 text-sm">
                  {bundle.binding.introduction_text}
                </blockquote>
              </div>
            )}
            {!readyToActivate && (
              <div
                className="rounded border p-3 text-sm"
                aria-label="Steps needed to activate"
              >
                <p className="font-medium">Finish these steps to activate:</p>
                <ul className="mt-2 grid gap-2">
                  {activationBlockers.map((issue) => (
                    <li key={issue.message}>
                      <Link
                        className="underline"
                        href={`${base}?step=${issue.step}`}
                      >
                        {issue.message}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <form
              className={`grid gap-4 rounded-lg ${errorTarget === "activation" && error ? "border border-destructive p-4" : ""}`}
              onSubmit={(e) => {
                e.preventDefault();
                if (pending || locked) return;
                if (!readyToActivate || !consented) {
                  setErrorTarget("activation");
                  setError(
                    !readyToActivate
                      ? activationBlockers
                          .map((issue) => issue.message)
                          .join(" ")
                      : "Confirm that your client received the introduction and agreed to assistant processing before activating.",
                  );
                  if (readyToActivate && !consented)
                    consentInput.current?.focus();
                  return;
                }
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
                }, "activation");
              }}
            >
              <label className="flex items-start gap-3 rounded border p-3 text-sm">
                <input
                  type="checkbox"
                  ref={consentInput}
                  name="disclosed"
                  checked={consented}
                  onChange={(e) => setConsented(e.target.checked)}
                  disabled={pending || locked}
                  className="mt-1"
                />
                <span>
                  All participants agreed to assistant processing, received the
                  introduction, and know how to ask the owner to pause.
                </span>
              </label>
              <Button disabled={pending || locked}>
                {locked
                  ? "Already activated"
                  : p.policy?.mode === "enabled"
                    ? "Activate automation"
                    : "Activate in review-only mode"}
              </Button>
            </form>
            {stepError("activation")}
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
      </section>
      <p className="mt-5 text-xs text-muted-foreground">
        Each Save persists progress to your workspace. You can sign out and
        resume from Projects.
      </p>
    </main>
  );
}
