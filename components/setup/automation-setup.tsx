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

export function AutomationSetup({
  project: p,
  bundle,
  locked,
  onSave,
  onContinueState,
}: {
  project: Project;
  bundle: Bundle;
  locked: boolean;
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
      onContinueState={onContinueState}
      disabled={locked}
      onSave={(form) => onSave(policyPayload(form))}
    >
      <SetupField
        label="How should the assistant handle requests?"
        name="mode"
        hint="Manual approval is a good starting point. You can review each request before accepting work."
      >
        <select
          name="mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as typeof mode)}
          className="rounded border p-2"
        >
          <option value="review_only">I approve every request</option>
          <option value="enabled" disabled={manualRequired}>
            Accept permitted small changes automatically
          </option>
        </select>
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
          Advanced settings · permitted changes and limits
        </summary>
        <div className="mt-4 grid gap-5">
          <p className="text-sm text-muted-foreground">
            The default is manual approval for every request. No pages or
            elements are authorized for automatic changes until you choose them.
          </p>
          <SetupField
            label="Types of change the assistant may accept"
            name="operations"
            hint="These permissions apply only when automatic acceptance is enabled."
          >
            <div className="grid gap-3 rounded border p-3" role="group">
              <label className="flex gap-2">
                <input
                  name="operations"
                  type="checkbox"
                  value="replace_text"
                  defaultChecked={(
                    p.policy?.operations ?? DEFAULT_SETUP_POLICY.operations
                  ).includes("replace_text")}
                />
                Replace existing text
              </label>
              <label className="flex gap-2">
                <input
                  name="operations"
                  type="checkbox"
                  value="change_color"
                  defaultChecked={(
                    p.policy?.operations ?? DEFAULT_SETUP_POLICY.operations
                  ).includes("change_color")}
                />
                Change an existing element’s color
              </label>
            </div>
          </SetupField>
          <SetupField
            label="Pages or elements covered by these permissions"
            name="targets"
            hint="Defaults to none. Leave blank for manual approval. To enable automatic acceptance, enter the exact page or element identifiers from your website or design file, one per line (for example, home.hero.heading). Ask your developer or designer if you do not know them."
          >
            <Textarea
              name="targets"
              required={mode === "enabled"}
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
      <p className="text-sm text-muted-foreground">
        Requests needing your decision appear in your private dashboard. These
        settings let the assistant accept work for you to do; it does not edit
        your website.
      </p>
      <SetupSubmit>Save automation &amp; continue</SetupSubmit>
    </SetupForm>
  );
}
