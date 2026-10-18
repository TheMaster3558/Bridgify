"use client";
import { useCallback, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Bundle, Project } from "@/lib/domain/types";
import {
  DEFAULT_SETUP_POLICY,
  policyPayload,
  validatePolicy,
} from "@/lib/projects/setup-validation";
import { SetupField, SetupForm, SetupSubmit } from "./setup-form";
import type { ContinueStateChange } from "./use-setup-continue";
import {
  AUTOMATIC_ACCEPTANCE_GUIDANCE,
  MANUAL_ACCEPTANCE_GUIDANCE,
  initialAcceptanceGuidance,
} from "@/lib/assistant/policy-guidance";

export function AutomationSetup({
  project: p,
  bundle,
  locked,
  onSave,
  onContinueState,
  saveLabel,
}: {
  project: Project;
  bundle: Pick<Bundle, "scope">;
  locked: boolean;
  saveLabel?: string;
  onSave: (payload: ReturnType<typeof policyPayload>) => Promise<void>;
  onContinueState?: ContinueStateChange;
}) {
  const agreement = bundle.scope.find(
    (s) => s.version === p.scope_version,
  )?.agreement;
  const revision = agreement?.commercial.revision;
  const manualRequired =
    revision?.unit === "rounds" || revision?.unit === "not_specified";
  const [mode, setMode] = useState(
    manualRequired ? "review_only" : p.policy?.mode || "review_only",
  );
  const [counting, setCounting] = useState(
    p.policy?.allowance_mode ||
      (revision?.unit === "rounds" ? "manual_rounds" : "per_request"),
  );
  const [guidance, setGuidance] = useState(() =>
    initialAcceptanceGuidance(p.policy),
  );
  const [guidanceEdited, setGuidanceEdited] = useState(false);
  const [guidanceVersion, setGuidanceVersion] = useState(0);
  const validate = useCallback(
    (form: FormData) => {
      const errors = validatePolicy(form);
      if (manualRequired && form.get("mode") === "enabled")
        errors.mode =
          "This agreement needs your approval for each request. Choose manual approval.";
      return errors;
    },
    [manualRequired],
  );
  return (
    <SetupForm
      validate={validate}
      validationKey={mode}
      onContinueState={onContinueState}
      disabled={locked}
      onSave={(form) => onSave(policyPayload(form))}
    >
      <SetupField
        label="How should the assistant handle requests?"
        name="mode"
        hint="The assistant evaluates requests against your confirmed agreement. Choose whether it can accept clear requests or must ask you first."
      >
        <select
          name="mode"
          value={mode}
          onChange={(e) => {
            const next = e.target.value as typeof mode;
            setMode(next);
            if (!guidanceEdited) {
              setGuidance(
                next === "enabled"
                  ? AUTOMATIC_ACCEPTANCE_GUIDANCE
                  : MANUAL_ACCEPTANCE_GUIDANCE,
              );
              setGuidanceVersion((version) => version + 1);
            }
          }}
          className="rounded border p-2"
        >
          <option value="review_only">I approve every request</option>
          <option value="enabled" disabled={manualRequired}>
            Let the assistant accept clear, in-scope requests
          </option>
        </select>
      </SetupField>
      <SetupField
        label={
          mode === "enabled"
            ? "What may the assistant accept automatically?"
            : "Request review guidance (optional)"
        }
        name="acceptance_guidance"
        hint="Edit this in your own words. The assistant uses this guidance and the agreement to decide whether to create a task, ask a question or put the request in your review queue. It accepts work for you to do; it does not edit the website."
      >
        <Textarea
          key={guidanceVersion}
          name="acceptance_guidance"
          rows={5}
          maxLength={4000}
          required={mode === "enabled"}
          defaultValue={guidance}
          onChange={() => {
            if (!guidanceEdited) setGuidanceEdited(true);
          }}
        />
      </SetupField>
      {manualRequired && (
        <p className="text-sm text-muted-foreground">
          Your agreement{" "}
          {revision?.unit === "rounds"
            ? "includes rounds of feedback"
            : "does not specify how many changes are included"}
          , so each request needs your approval.
        </p>
      )}
      <SetupField
        label="How are included changes counted?"
        name="allowance_mode"
        hint="An individual request is one change. A round is a batch of feedback that you review together."
      >
        <select
          name="allowance_mode"
          value={counting}
          onChange={(e) => setCounting(e.target.value as typeof counting)}
          className="rounded border p-2"
        >
          <option value="per_request">Individual change requests</option>
          <option value="manual_rounds">
            Rounds of feedback (manual approval)
          </option>
        </select>
      </SetupField>
      <SetupField
        label={
          counting === "manual_rounds"
            ? "Included rounds of feedback"
            : "Included change requests"
        }
        name="allowance"
        hint="Use the number agreed with your client. Enter 0 if no changes are included."
      >
        <Input
          name="allowance"
          type="number"
          min={0}
          max={10000}
          step={1}
          required
          defaultValue={p.policy?.allowance ?? revision?.allowance ?? 0}
        />
      </SetupField>
      <details className="rounded-lg border p-4">
        <summary className="cursor-pointer font-medium">
          Advanced settings · optional limits
        </summary>
        <div className="mt-4 grid gap-5">
          <p className="text-sm text-muted-foreground">
            You can leave the page or element list blank. The confirmed
            agreement and your guidance set the boundaries. Adding a list
            narrows the requests eligible for automatic acceptance.
          </p>
          <SetupField
            label="Pages or elements covered by these permissions (optional)"
            name="targets"
            hint="Leave blank to evaluate requests across the confirmed scope. To restrict automatic acceptance to specific pages or elements, list their names or identifiers, one per line."
          >
            <Textarea
              name="targets"
              defaultValue={p.policy?.targets.join("\n") || ""}
              rows={3}
            />
          </SetupField>
          <SetupField
            label="What always needs your approval?"
            name="exclusions"
            hint="Describe work the assistant must leave for you, even when automatic acceptance is enabled."
          >
            <Textarea
              name="exclusions"
              required
              maxLength={4000}
              defaultValue={
                p.policy?.exclusions || DEFAULT_SETUP_POLICY.exclusions
              }
            />
          </SetupField>
          <SetupField
            label="Maximum automatic tasks open at once"
            name="max_open_tasks"
            hint="Choose 1–10. When this limit is reached, new requests wait for your review."
          >
            <Input
              name="max_open_tasks"
              type="number"
              min={1}
              max={10}
              step={1}
              required
              defaultValue={
                p.policy?.max_open_tasks ?? DEFAULT_SETUP_POLICY.max_open_tasks
              }
            />
          </SetupField>
        </div>
      </details>
      <fieldset className="grid gap-3 rounded-lg border p-4">
        <legend className="px-1 font-medium">Automatic client replies</legend>
        <p className="text-sm text-muted-foreground">
          These replies also work with manual approval. Accepted requests always
          receive a task confirmation. Casual conversation stays quiet.
        </p>
        {(
          [
            [
              "status_questions",
              "Answer status questions using saved project progress",
            ],
            [
              "progress_updates",
              "Send updates when I start, block, complete or cancel work",
            ],
            [
              "clarifications",
              "Answer project questions and ask for missing request details (up to two follow-ups per request)",
            ],
            [
              "review_acknowledgments",
              "Acknowledge requests waiting for my review",
            ],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="grid gap-1 text-sm">
            {label}
            <select
              name={`reply_${key}`}
              defaultValue={
                key === "progress_updates"
                  ? p.policy?.replies?.progress_updates
                    ? "on"
                    : "off"
                  : p.policy?.replies?.[key] === false
                    ? "off"
                    : "on"
              }
              className="rounded border p-2"
            >
              <option value="on">Enabled</option>
              <option value="off">Disabled</option>
            </select>
          </label>
        ))}
      </fieldset>
      <p className="text-sm text-muted-foreground">
        Requests needing your decision appear in your private dashboard. These
        settings let the assistant accept work for you to do; it does not edit
        your website.
      </p>
      <SetupSubmit>{saveLabel ?? "Save automation & continue"}</SetupSubmit>
    </SetupForm>
  );
}
