"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  AgreementStep,
  AutomationStep,
  BasicsStep,
  PeopleStep,
  ReviewStep,
} from "@/components/projects/wizard-steps";
import {
  STEPS,
  activationChecks,
  canActivate,
  extractScopeItems,
  formatSavedAt,
  judgeAgreementText,
  projectTitle,
  readAgreementFile,
  validateStep,
  type ProjectDraft,
  type StepId,
} from "@/lib/projects/draft";
import { upsertProject } from "@/lib/projects/storage";
import { useHydrated, useProjectList } from "@/lib/projects/use-projects";
import { cn } from "@/lib/utils";

export function ProjectWizard() {
  const params = useSearchParams();
  const projectId = params.get("project");
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const hydrated = useHydrated();
  const list = useProjectList();
  const [edit, setEdit] = useState<ProjectDraft | null>(null);
  const [trackedId, setTrackedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notedSave, setNotedSave] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [sending, setSending] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activeSpanId, setActiveSpanId] = useState<string | null>(null);

  if (trackedId !== (projectId ?? "")) {
    setTrackedId(projectId ?? "");
    setEdit(null);
    setNotedSave(null);
    setError("");
  }

  const stored = list.ok && projectId ? (list.data.find((item) => item.id === projectId) ?? null) : null;
  const draft = edit ?? stored;
  const projects = list.ok ? list.data : [];

  useEffect(() => {
    if (!edit || edit.status !== "draft") return;
    const timer = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      const saved = upsertProject({ ...edit, savedAt });
      if (!saved.ok) setError(saved.error);
      else setNotedSave(savedAt);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [edit]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [draft?.step]);

  if (!hydrated) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-6">
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        <div className="h-8 w-72 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </main>
    );
  }

  if (!list.ok) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-6">
        <h1 className="text-2xl font-semibold">Projects couldn’t be loaded</h1>
        <p className="text-sm text-muted-foreground">{list.error}</p>
        <Button type="button" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </main>
    );
  }

  if (!projectId || !draft) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-6">
        <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Projects / New project</p>
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed bg-card px-6 py-10">
          <h1 className="text-2xl font-semibold">{projectId ? "This draft isn’t on this device" : "Start a project"}</h1>
          <p className="max-w-lg text-sm text-muted-foreground">
            {projectId
              ? "Saved setup lives in this browser. Open Projects and start again, or resume a draft from the list."
              : "The wizard keeps a draft as you go. Nothing accepts client work until the activation checks pass."}
          </p>
          <Button asChild>
            <Link href="/app/projects">Back to projects</Link>
          </Button>
        </div>
      </main>
    );
  }

  const locked = draft.status !== "draft";
  const step = STEPS.find((item) => item.id === draft.step) ?? STEPS[0];
  const checks = activationChecks(draft, projects);
  const readyToActivate = canActivate(draft, projects);
  const savedLabel = formatSavedAt(notedSave ?? draft.savedAt);

  function update(recipe: (current: ProjectDraft) => ProjectDraft) {
    setEdit((current) => {
      const base = current ?? stored;
      if (!base || base.status !== "draft") return current;
      return recipe(base);
    });
  }

  function change(next: ProjectDraft) {
    if (!draft || draft.status !== "draft") return;
    setFieldErrors({});
    setEdit(next);
  }

  function goTo(nextStep: StepId) {
    if (!draft) return;
    setFieldErrors({});
    setEdit({ ...draft, step: nextStep });
  }

  function continueStep() {
    if (!draft || locked) return;
    if (!list.ok) {
      setError(list.error);
      return;
    }
    const nextErrors = validateStep(draft, draft.step, list.data);
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    goTo(Math.min(5, draft.step + 1) as StepId);
  }

  function saveAndExit() {
    if (!draft) return;
    const saved = upsertProject({ ...draft, savedAt: new Date().toISOString() });
    if (!saved.ok) {
      setError(saved.error);
      return;
    }
    router.push("/app/projects");
  }

  async function onFile(file: File) {
    if (!draft || draft.status !== "draft") return;
    setExtracting(true);
    update((current) => ({
      ...current,
      agreement: {
        ...current.agreement,
        mode: "pdf",
        status: "processing",
        error: "",
        text: "",
        items: [],
        fileName: file.name,
      },
    }));
    const result = await readAgreementFile(file);
    setExtracting(false);
    update((current) => {
      if (!result.ok) {
        return {
          ...current,
          agreement: {
            ...current.agreement,
            mode: "pdf",
            status: "rejected",
            error: result.error,
            text: "",
            items: [],
            fileName: result.fileName,
          },
        };
      }
      return {
        ...current,
        agreement: {
          ...current.agreement,
          mode: "pdf",
          status: "ready",
          error: "",
          text: result.text,
          fileName: result.fileName,
          items: extractScopeItems(result.text),
        },
      };
    });
  }

  function onExtract() {
    if (!draft || draft.status !== "draft") return;
    setExtracting(true);
    const result = judgeAgreementText(draft.agreement.text);
    window.setTimeout(() => {
      setExtracting(false);
      update((current) => {
        if (!result.ok) {
          return {
            ...current,
            agreement: { ...current.agreement, status: "rejected", error: result.error, items: [] },
          };
        }
        return {
          ...current,
          agreement: {
            ...current.agreement,
            status: "ready",
            error: "",
            text: result.text,
            items: extractScopeItems(result.text),
          },
        };
      });
    }, 400);
  }

  function sendTest() {
    if (!draft || sending || draft.status !== "draft") return;
    const instanceId = draft.people.instanceId.trim();
    const chatGuid = draft.people.chatGuid.trim();
    if (!instanceId || !chatGuid) {
      change({
        ...draft,
        people: {
          ...draft.people,
          testStatus: "failed",
          testDetail: "Enter the Photon instance and the chat GUID before sending a test.",
          testedChatGuid: "",
        },
      });
      return;
    }
    setSending(true);
    change({
      ...draft,
      people: { ...draft.people, testStatus: "sending", testDetail: "", testedChatGuid: "" },
    });
    window.setTimeout(() => {
      setSending(false);
      update((current) => {
        if (current.people.chatGuid.trim() !== chatGuid || current.people.instanceId.trim() !== instanceId) {
          return current;
        }
        return {
          ...current,
          people: {
            ...current.people,
            testStatus: "needs_confirmation",
            testDetail:
              "This page cannot see iMessage. Confirm delivery only after a post from the assistant shows up in this group.",
            testedChatGuid: "",
          },
        };
      });
    }, 500);
  }

  function confirmTest() {
    update((current) => {
      const chatGuid = current.people.chatGuid.trim();
      return {
        ...current,
        people: {
          ...current.people,
          testStatus: "delivered",
          testedChatGuid: chatGuid,
          testDetail: `Delivered to ${chatGuid}. Messages from before activation stay context only.`,
        },
      };
    });
  }

  function activate() {
    if (!draft || activating || locked) return;
    if (!list.ok) {
      setError(list.error);
      return;
    }
    if (!canActivate(draft, list.data)) {
      setFieldErrors({ activate: "Activation stays closed until every check is done." });
      return;
    }
    setActivating(true);
    const saved = upsertProject({
      ...draft,
      status: "active",
      step: 5,
      version: draft.version + 1,
      activatedAt: new Date().toISOString(),
      savedAt: new Date().toISOString(),
    });
    if (!saved.ok) {
      setActivating(false);
      setError(saved.error);
      return;
    }
    router.push("/app/projects");
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 md:p-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          {locked ? "Projects / Setup" : "New project"}
          {savedLabel ? ` · ${locked ? "saved" : "draft saved"} ${savedLabel}` : ""}
        </p>
        <h1 className="text-2xl font-semibold">{projectTitle(draft)}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {locked
            ? draft.status === "active"
              ? "This project is active. The setup you confirmed stays in place."
              : "This project is completed or archived, so it no longer accepts new work."
            : "A draft can store this setup. It never accepts client work until you activate it."}
        </p>
      </div>

      {error ? (
        <p className="rounded-md border border-crit/30 bg-crit-soft px-3 py-2 text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <ol className="flex gap-2 overflow-x-auto" aria-label="Setup steps">
        {STEPS.map((item) => {
          const state = item.id === draft.step ? "on" : item.id < draft.step ? "done" : "todo";
          return (
            <li key={item.id} className="min-w-36 flex-1">
              <button
                type="button"
                className={cn(
                  "flex w-full flex-col gap-1 border-t-[3px] px-3 py-2.5 text-left text-sm text-muted-foreground",
                  state === "on" && "border-primary",
                  state === "done" && "border-ok",
                  state === "todo" && "border-border",
                )}
                aria-current={state === "on" ? "step" : undefined}
                onClick={() => goTo(item.id)}
              >
                <span>Step {item.id}</span>
                <span className="font-semibold text-foreground">{item.title}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <section className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">
            {step.title}
          </h2>
        </div>
        <div className="px-4 py-4">
          {draft.step === 1 ? <BasicsStep draft={draft} errors={fieldErrors} onChange={change} /> : null}
          {draft.step === 2 ? (
            <AgreementStep
              draft={draft}
              errors={fieldErrors}
              onChange={change}
              onFile={onFile}
              onExtract={onExtract}
              busy={extracting}
              activeSpanId={activeSpanId}
              onViewSpan={setActiveSpanId}
            />
          ) : null}
          {draft.step === 3 ? (
            <PeopleStep
              draft={draft}
              errors={fieldErrors}
              onChange={change}
              onSendTest={sendTest}
              onConfirmTest={confirmTest}
              sending={sending}
            />
          ) : null}
          {draft.step === 4 ? <AutomationStep draft={draft} errors={fieldErrors} onChange={change} /> : null}
          {draft.step === 5 ? <ReviewStep draft={draft} checks={checks} onChange={change} locked={locked} /> : null}
        </div>
      </section>

      {locked ? (
        <Button asChild variant="outline" className="self-start">
          <Link href="/app/projects">Back to projects</Link>
        </Button>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="outline" onClick={() => goTo(Math.max(1, draft.step - 1) as StepId)} disabled={draft.step === 1}>
            Back
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={saveAndExit}>
              Save and exit
            </Button>
            {draft.step < 5 ? (
              <Button type="button" onClick={continueStep}>
                Continue
              </Button>
            ) : (
              <Button type="button" onClick={activate} disabled={!readyToActivate || activating}>
                {activating ? "Activating…" : "Activate project"}
              </Button>
            )}
          </div>
        </div>
      )}
      {!locked && draft.step === 5 && !readyToActivate ? (
        <p className="text-sm text-muted-foreground">
          Activate stays off until the checks above are done. Those checks are the same ones the server must pass before a
          live assistant can accept work.
        </p>
      ) : null}
      {fieldErrors.activate ? (
        <p className="text-sm text-crit" role="alert">
          {fieldErrors.activate}
        </p>
      ) : null}
    </main>
  );
}
