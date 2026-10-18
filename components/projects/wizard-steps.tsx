"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AGREEMENT_LIMIT,
  TIMEZONES,
  formatCents,
  introduction,
  judgeAgreementText,
  mentionsRevisionRounds,
  notificationLabel,
  parseUsdToCents,
  pauseLabel,
  type Binding,
  type ProjectDraft,
  type ScopeItem,
  type ScopeKind,
} from "@/lib/projects/draft";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs text-crit" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, hint: boolean, error?: string) {
  return [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
}

export function BasicsStep({
  draft,
  errors,
  onChange,
}: {
  draft: ProjectDraft;
  errors: Record<string, string>;
  onChange: (draft: ProjectDraft) => void;
}) {
  const cents = parseUsdToCents(draft.basics.priceText);
  const setBasics = (patch: Partial<ProjectDraft["basics"]>) =>
    onChange({ ...draft, basics: { ...draft.basics, ...patch } });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Project name" htmlFor="project-name" error={errors.name}>
        <Input
          id="project-name"
          value={draft.basics.name}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={describedBy("project-name", false, errors.name)}
          onChange={(event) => setBasics({ name: event.target.value })}
        />
      </Field>
      <Field label="Client name" htmlFor="client-name" error={errors.clientName}>
        <Input
          id="client-name"
          value={draft.basics.clientName}
          aria-invalid={Boolean(errors.clientName)}
          aria-describedby={describedBy("client-name", false, errors.clientName)}
          onChange={(event) => setBasics({ clientName: event.target.value })}
        />
      </Field>
      <Field
        label="Original price"
        htmlFor="original-price"
        hint={
          cents === null
            ? "Zero or more. Stored as integer cents. USD only in this release."
            : `Stored as ${cents.toLocaleString()} cents.`
        }
        error={errors.price}
      >
        <Input
          id="original-price"
          inputMode="decimal"
          value={draft.basics.priceText}
          placeholder="0.00"
          aria-invalid={Boolean(errors.price)}
          aria-describedby={describedBy("original-price", true, errors.price)}
          onChange={(event) => setBasics({ priceText: event.target.value })}
        />
      </Field>
      <Field label="Currency" htmlFor="currency" hint="USD only in this release" error={errors.currency}>
        <Select value={draft.basics.currency} onValueChange={() => setBasics({ currency: "USD" })}>
          <SelectTrigger id="currency" className="w-full" aria-describedby={describedBy("currency", true, errors.currency)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="USD">USD</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Project timezone" htmlFor="timezone" error={errors.timezone}>
        <Select value={draft.basics.timezone} onValueChange={(timezone) => setBasics({ timezone })}>
          <SelectTrigger id="timezone" className="w-full" aria-invalid={Boolean(errors.timezone)}>
            <SelectValue placeholder="Choose a timezone" />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((zone) => (
              <SelectItem key={zone} value={zone}>
                {zone}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field
        label="Agreed completion date (optional)"
        htmlFor="agreed-date"
        hint="Only a date the client already agreed to. This is never an assistant prediction."
        error={errors.agreedDate}
      >
        <Input
          id="agreed-date"
          type="date"
          value={draft.basics.agreedDate}
          aria-invalid={Boolean(errors.agreedDate)}
          aria-describedby={describedBy("agreed-date", true, errors.agreedDate)}
          onChange={(event) => setBasics({ agreedDate: event.target.value })}
        />
      </Field>
    </div>
  );
}

export function AgreementStep({
  draft,
  errors,
  onChange,
  onFile,
  onExtract,
  busy,
  activeSpanId,
  onViewSpan,
}: {
  draft: ProjectDraft;
  errors: Record<string, string>;
  onChange: (draft: ProjectDraft) => void;
  onFile: (file: File) => void;
  onExtract: () => void;
  busy: boolean;
  activeSpanId: string | null;
  onViewSpan: (id: string) => void;
}) {
  const setAgreement = (patch: Partial<ProjectDraft["agreement"]>) =>
    onChange({ ...draft, agreement: { ...draft.agreement, ...patch } });

  const updateItem = (id: string, patch: Partial<ScopeItem>) =>
    setAgreement({
      items: draft.agreement.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });

  const addItem = (kind: ScopeKind, description: string) => {
    const trimmed = description.trim();
    if (!trimmed) return;
    const item: ScopeItem = {
      id: crypto.randomUUID(),
      kind,
      description: trimmed,
      sourceLabel: "Added by owner",
      sourceQuote: trimmed,
      confirmed: true,
    };
    if (draft.agreement.text.trim()) {
      const judged = judgeAgreementText(draft.agreement.text);
      if (!judged.ok) {
        setAgreement({ status: "rejected", error: judged.error, items: [] });
        return;
      }
    }
    setAgreement({
      items: [...draft.agreement.items, item],
      status: draft.agreement.text.trim() ? "ready" : draft.agreement.status,
      error: "",
    });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
        <div className="inline-flex w-fit overflow-hidden rounded-md border" role="group" aria-label="Agreement source">
          {(
            [
              ["pdf", "Upload text PDF"],
              ["paste", "Paste text"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={cn(
                "px-3 py-1.5 text-sm text-muted-foreground",
                draft.agreement.mode === mode && "bg-foreground text-background",
              )}
              aria-pressed={draft.agreement.mode === mode}
              onClick={() => setAgreement({ mode })}
            >
              {label}
            </button>
          ))}
        </div>

        {draft.agreement.mode === "pdf" ? (
          <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed px-4 py-6">
            <label htmlFor="agreement-file" className="text-sm font-medium">
              Text PDF or plain text
            </label>
            <input
              id="agreement-file"
              type="file"
              accept="application/pdf,.pdf,text/plain,.txt"
              className="text-sm file:mr-3 file:rounded-md file:border file:bg-card file:px-3 file:py-1.5"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) onFile(file);
              }}
            />
            {draft.agreement.fileName ? <p className="text-sm font-medium">{draft.agreement.fileName}</p> : null}
          </div>
        ) : (
          <Field
            label="Agreement text"
            htmlFor="agreement-text"
            hint="Headings such as Inclusions and Exclusions, with one bullet per term, extract cleanly."
          >
            <Textarea
              id="agreement-text"
              value={draft.agreement.text}
              className="min-h-40"
              onChange={(event) =>
                setAgreement({
                  text: event.target.value,
                  fileName: "",
                  status: "empty",
                  error: "",
                  items: [],
                })
              }
            />
          </Field>
        )}

        <div className="flex flex-wrap items-center gap-2 text-sm">
          {draft.agreement.mode === "paste" ? (
            <Button type="button" size="sm" variant="outline" onClick={onExtract} disabled={busy || !draft.agreement.text.trim()}>
              {busy ? "Extracting…" : "Extract terms"}
            </Button>
          ) : null}
          <StatusLine draft={draft} busy={busy} />
        </div>
        {draft.agreement.status === "rejected" && draft.agreement.error ? (
          <p className="rounded-md border border-crit/30 bg-crit-soft px-3 py-2 text-sm" role="alert">
            {draft.agreement.error}
          </p>
        ) : null}
        {errors.agreement && errors.agreement !== draft.agreement.error ? (
          <p className="rounded-md border border-crit/30 bg-crit-soft px-3 py-2 text-sm" role="alert">
            {errors.agreement}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Scanned PDFs and files over {AGREEMENT_LIMIT.toLocaleString()} characters are rejected with a message. Nothing is
          shortened in silence. Unconfirmed terms cannot authorize work.
        </p>
        {draft.agreement.text ? (
          <div>
            <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Source preview</p>
            <pre className="max-h-56 overflow-auto rounded-md border bg-muted/60 p-3 font-sans text-sm whitespace-pre-wrap">
              {draft.agreement.text}
            </pre>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Extracted terms · confirm each</p>
        {draft.agreement.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No terms yet. Extract the agreement, or add an item manually. A blank extraction does not become scope.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {draft.agreement.items.map((item) => (
              <li key={item.id} className={cn("flex gap-3 px-3 py-3", activeSpanId === item.id && "bg-accent")}>
                <Checkbox
                  id={`scope-${item.id}`}
                  checked={item.confirmed}
                  onCheckedChange={(checked) => updateItem(item.id, { confirmed: checked === true })}
                  aria-label={`Confirm ${item.description}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        item.kind === "inclusion" ? "bg-ok-soft text-ok" : "bg-crit-soft text-crit",
                      )}
                    >
                      {item.kind === "inclusion" ? "Included" : "Excluded"}
                    </span>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                      onClick={() =>
                        updateItem(item.id, { kind: item.kind === "inclusion" ? "exclusion" : "inclusion" })
                      }
                    >
                      Switch to {item.kind === "inclusion" ? "excluded" : "included"}
                    </button>
                  </div>
                  <Label htmlFor={`scope-text-${item.id}`} className="sr-only">
                    Scope item
                  </Label>
                  <Input
                    id={`scope-text-${item.id}`}
                    value={item.description}
                    onChange={(event) => updateItem(item.id, { description: event.target.value })}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Source: {item.sourceLabel}
                    {draft.agreement.text.includes(item.sourceQuote) ? (
                      <>
                        {" "}
                        ·{" "}
                        <button type="button" className="underline-offset-2 hover:underline" onClick={() => onViewSpan(item.id)}>
                          view span
                        </button>
                      </>
                    ) : null}
                  </p>
                  {activeSpanId === item.id ? (
                    <blockquote className="mt-2 border-l-2 border-primary bg-muted/70 px-3 py-2 text-sm">
                      {item.sourceQuote}
                    </blockquote>
                  ) : null}
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={() => setAgreement({ items: draft.agreement.items.filter((entry) => entry.id !== item.id) })}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
        {errors.scope ? (
          <p className="text-xs text-crit" role="alert">
            {errors.scope}
          </p>
        ) : null}
        <ManualItem onAdd={addItem} />
      </div>
    </div>
  );
}

function StatusLine({ draft, busy }: { draft: ProjectDraft; busy: boolean }) {
  if (busy || draft.agreement.status === "processing") return <span className="text-info">Processing…</span>;
  if (draft.agreement.status === "ready") {
    return (
      <span className="text-ok">
        Extraction complete · {draft.agreement.text.length.toLocaleString()} of {AGREEMENT_LIMIT.toLocaleString()} characters
      </span>
    );
  }
  if (draft.agreement.status === "rejected") return <span className="text-crit">Rejected</span>;
  return <span className="text-muted-foreground">Nothing extracted yet</span>;
}

function ManualItem({ onAdd }: { onAdd: (kind: ScopeKind, description: string) => void }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ScopeKind>("inclusion");
  const [description, setDescription] = useState("");

  if (!open) {
    return (
      <Button type="button" size="sm" variant="outline" className="self-start" onClick={() => setOpen(true)}>
        Add item manually
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <Label htmlFor="manual-kind">Kind</Label>
      <Select value={kind} onValueChange={(value) => setKind(value as ScopeKind)}>
        <SelectTrigger id="manual-kind" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="inclusion">Included</SelectItem>
          <SelectItem value="exclusion">Excluded</SelectItem>
        </SelectContent>
      </Select>
      <Label htmlFor="manual-description">Description</Label>
      <Input id="manual-description" value={description} onChange={(event) => setDescription(event.target.value)} />
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => {
            onAdd(kind, description);
            setDescription("");
            setOpen(false);
          }}
          disabled={!description.trim()}
        >
          Add item
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function PeopleStep({
  draft,
  errors,
  onChange,
  onSendTest,
  onConfirmTest,
  sending,
}: {
  draft: ProjectDraft;
  errors: Record<string, string>;
  onChange: (draft: ProjectDraft) => void;
  onSendTest: () => void;
  onConfirmTest: () => void;
  sending: boolean;
}) {
  const setPeople = (patch: Partial<ProjectDraft["people"]>) =>
    onChange({ ...draft, people: { ...draft.people, ...patch } });

  const updateBinding = (id: string, patch: Partial<Binding>) =>
    setPeople({
      bindings: draft.people.bindings.map((binding) => (binding.id === id ? { ...binding, ...patch } : binding)),
    });

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">People</p>
        <Field label="Owner" htmlFor="owner-name" error={errors.ownerName}>
          <Input
            id="owner-name"
            value={draft.people.ownerName}
            aria-invalid={Boolean(errors.ownerName)}
            onChange={(event) => setPeople({ ownerName: event.target.value })}
          />
        </Field>
        <Field
          label="Client contact"
          htmlFor="requester-name"
          hint="This person communicates through iMessage. No client website account is used."
          error={errors.requesterName}
        >
          <Input
            id="requester-name"
            value={draft.people.requesterName}
            aria-invalid={Boolean(errors.requesterName)}
            aria-describedby={describedBy("requester-name", true, errors.requesterName)}
            onChange={(event) => setPeople({ requesterName: event.target.value })}
          />
        </Field>
        <Field label="Contact email (optional)" htmlFor="requester-email" error={errors.requesterEmail}>
          <Input
            id="requester-email"
            type="email"
            autoComplete="off"
            value={draft.people.requesterEmail}
            aria-invalid={Boolean(errors.requesterEmail)}
            onChange={(event) => setPeople({ requesterEmail: event.target.value })}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">iMessage group (Photon)</p>
        <Field label="Photon instance" htmlFor="instance-id" error={errors.instanceId}>
          <Input
            id="instance-id"
            className="font-mono"
            value={draft.people.instanceId}
            aria-invalid={Boolean(errors.instanceId)}
            onChange={(event) =>
              setPeople({
                instanceId: event.target.value,
                testStatus: "idle",
                testDetail: "",
                testedChatGuid: "",
              })
            }
          />
        </Field>
        <Field label="Group name" htmlFor="group-name" hint="A label only. It does not select the chat." error={errors.groupName}>
          <Input
            id="group-name"
            value={draft.people.groupName}
            aria-invalid={Boolean(errors.groupName)}
            onChange={(event) => setPeople({ groupName: event.target.value })}
          />
        </Field>
        <Field
          label="Chat GUID"
          htmlFor="chat-guid"
          hint="One active group per project. The GUID is the binding."
          error={errors.chatGuid}
        >
          <Input
            id="chat-guid"
            className="font-mono"
            placeholder="iMessage;+;chat…"
            value={draft.people.chatGuid}
            aria-invalid={Boolean(errors.chatGuid)}
            aria-describedby={describedBy("chat-guid", true, errors.chatGuid)}
            onChange={(event) => {
              const chatGuid = event.target.value;
              const same = chatGuid.trim() === draft.people.testedChatGuid;
              setPeople({
                chatGuid,
                testStatus: same ? draft.people.testStatus : "idle",
                testDetail: same ? draft.people.testDetail : "",
                testedChatGuid: same ? draft.people.testedChatGuid : "",
              });
            }}
          />
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-info/30 bg-info-soft px-3 py-2.5 text-sm">
          <p>Send a test, then confirm it posted in this exact group. A draft never accepts work on its own.</p>
          <Button type="button" size="sm" variant="outline" onClick={onSendTest} disabled={sending}>
            {sending ? "Sending…" : "Send test"}
          </Button>
        </div>
        {draft.people.testStatus === "needs_confirmation" ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm">
            <p>{draft.people.testDetail}</p>
            <Button type="button" size="sm" onClick={onConfirmTest}>
              The test arrived
            </Button>
          </div>
        ) : null}
        {draft.people.testStatus === "delivered" ? (
          <p className="text-sm text-ok">{draft.people.testDetail}</p>
        ) : null}
        {draft.people.testStatus === "failed" ? (
          <p className="text-sm text-crit" role="alert">
            {draft.people.testDetail}
          </p>
        ) : null}
        {errors.test ? (
          <p className="text-xs text-crit" role="alert">
            {errors.test}
          </p>
        ) : null}

        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Map senders to people</p>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-3 py-2 font-medium">Sender in group</th>
                <th className="px-3 py-2 font-medium">Maps to</th>
                <th className="px-3 py-2 font-medium">Confirmed</th>
              </tr>
            </thead>
            <tbody>
              {draft.people.bindings.map((binding) => (
                <tr key={binding.id} className="border-t">
                  <td className="px-3 py-2">
                    <Label htmlFor={`sender-${binding.id}`} className="sr-only">
                      Sender id for {bindingLabel(binding.mapsTo)}
                    </Label>
                    <Input
                      id={`sender-${binding.id}`}
                      className="font-mono"
                      value={binding.senderId}
                      onChange={(event) => updateBinding(binding.id, { senderId: event.target.value, confirmed: false })}
                    />
                  </td>
                  <td className="px-3 py-2">{bindingLabel(binding.mapsTo)}</td>
                  <td className="px-3 py-2">
                    <Checkbox
                      checked={binding.confirmed}
                      onCheckedChange={(checked) => updateBinding(binding.id, { confirmed: checked === true })}
                      aria-label={`Confirm ${bindingLabel(binding.mapsTo)} mapping`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {errors.requesterBinding || errors.ownerBinding || errors.assistantBinding || errors.bindings ? (
          <p className="text-xs text-crit" role="alert">
            {errors.requesterBinding || errors.ownerBinding || errors.assistantBinding || errors.bindings}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function bindingLabel(role: Binding["mapsTo"]) {
  if (role === "requester") return "Client requester";
  if (role === "owner") return "Owner (never parsed as the client)";
  return "Assistant (echo suppressed)";
}

export function AutomationStep({
  draft,
  errors,
  onChange,
}: {
  draft: ProjectDraft;
  errors: Record<string, string>;
  onChange: (draft: ProjectDraft) => void;
}) {
  const setAutomation = (patch: Partial<ProjectDraft["automation"]>) =>
    onChange({ ...draft, automation: { ...draft.automation, ...patch } });
  const rounds = mentionsRevisionRounds(draft.agreement.text);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Routine operations</p>
        <OperationToggle
          id="op-replace-text"
          checked={draft.automation.replaceText}
          title="replace_text"
          detail="Confirmed page, exact target, and the replacement text."
          onCheckedChange={(checked) => setAutomation({ replaceText: checked })}
        />
        <OperationToggle
          id="op-change-color"
          checked={draft.automation.changeColor}
          title="change_color"
          detail="Confirmed element and one unambiguous color."
          onCheckedChange={(checked) => setAutomation({ changeColor: checked })}
        />
        <OperationToggle
          id="op-replace-image"
          checked={false}
          disabled
          title="replace_image_reference"
          detail="Not available yet."
          onCheckedChange={() => undefined}
        />
        <Field label="Always excluded" htmlFor="exclusions" hint="A policy cannot expand the signed scope.">
          <Textarea
            id="exclusions"
            value={draft.automation.exclusions}
            onChange={(event) => setAutomation({ exclusions: event.target.value })}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Revision allowance</p>
        <Field
          label="Counting"
          htmlFor="allowance-mode"
          hint="Several changes in one message can use several units. The client is told this in the introduction."
          error={errors.mode}
        >
          <Select value={draft.automation.allowanceMode} onValueChange={() => setAutomation({ allowanceMode: "per_accepted_request" })}>
            <SelectTrigger id="allowance-mode" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="per_accepted_request">Per accepted request</SelectItem>
              <SelectItem value="per_round" disabled>
                Per round (later)
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {rounds ? (
          <div className="rounded-lg border border-warn/40 bg-warn-soft px-3 py-2.5 text-sm" role="note">
            This agreement mentions revision rounds. This release counts per accepted request only. Do not use that count as a
            stand-in for a round.
          </div>
        ) : null}
        {rounds ? (
          <label className="flex items-start gap-3 text-sm" htmlFor="round-ack">
            <Checkbox
              id="round-ack"
              checked={draft.automation.roundReviewAcknowledged}
              onCheckedChange={(checked) => setAutomation({ roundReviewAcknowledged: checked === true })}
            />
            <span>Revision requests stay in manual review unless the agreement really counts each accepted request.</span>
          </label>
        ) : null}
        {errors.rounds ? (
          <p className="text-xs text-crit" role="alert">
            {errors.rounds}
          </p>
        ) : null}
        <Field label="Units" htmlFor="units" hint="Defaults to 0 until you set it." error={errors.units}>
          <Input
            id="units"
            className="max-w-28"
            inputMode="numeric"
            value={draft.automation.unitsText}
            aria-invalid={Boolean(errors.units)}
            aria-describedby={describedBy("units", true, errors.units)}
            onChange={(event) => setAutomation({ unitsText: event.target.value })}
          />
        </Field>
        <Field
          label="Eligible targets"
          htmlFor="targets"
          hint="Comma-separated confirmed targets. Automatic edits stay inside this list."
        >
          <Input
            id="targets"
            value={draft.automation.targetsText}
            placeholder="home.hero.heading, home.features.title"
            onChange={(event) => setAutomation({ targetsText: event.target.value })}
          />
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Pause behavior</legend>
          <label className="flex items-start gap-3 text-sm" htmlFor="pause-stop">
            <input
              id="pause-stop"
              type="radio"
              name="pause-behavior"
              className="mt-1"
              checked={draft.automation.pauseBehavior === "pause"}
              onChange={() => setAutomation({ pauseBehavior: "pause" })}
            />
            <span>Pause stops new automatic acceptance. Intake and committed tasks stay.</span>
          </label>
          <label className="flex items-start gap-3 text-sm" htmlFor="pause-review">
            <input
              id="pause-review"
              type="radio"
              name="pause-behavior"
              className="mt-1"
              checked={draft.automation.pauseBehavior === "review_only"}
              onChange={() => setAutomation({ pauseBehavior: "review_only" })}
            />
            <span>Review only keeps reading the group and accepts nothing automatically.</span>
          </label>
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Notifications</legend>
          <label className="flex items-start gap-3 text-sm" htmlFor="notify-decisions">
            <Checkbox
              id="notify-decisions"
              checked={draft.automation.notifyDecisions}
              onCheckedChange={(checked) => setAutomation({ notifyDecisions: checked === true })}
            />
            <span>Show a dashboard alert when a decision is waiting.</span>
          </label>
          <label className="flex items-start gap-3 text-sm" htmlFor="notify-completions">
            <Checkbox
              id="notify-completions"
              checked={draft.automation.notifyCompletions}
              onCheckedChange={(checked) => setAutomation({ notifyCompletions: checked === true })}
            />
            <span>A finished task may offer a client completion note. That checkbox still starts off.</span>
          </label>
        </fieldset>
        <Field
          label="Maximum open automatic tasks"
          htmlFor="max-open-tasks"
          hint="Default 10. New prices and dates always stay with the owner."
          error={errors.maxOpenTasks}
        >
          <Input
            id="max-open-tasks"
            className="max-w-28"
            inputMode="numeric"
            value={draft.automation.maxOpenTasksText}
            aria-invalid={Boolean(errors.maxOpenTasks)}
            onChange={(event) => setAutomation({ maxOpenTasksText: event.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}

function OperationToggle({
  id,
  title,
  detail,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string;
  title: string;
  detail: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label htmlFor={id} className={cn("flex items-start gap-3 border-b py-2.5", disabled && "opacity-60")}>
      <Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={(value) => onCheckedChange(value === true)} />
      <span>
        <span className="block font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
    </label>
  );
}

export function ReviewStep({
  draft,
  checks,
  onChange,
  locked,
}: {
  draft: ProjectDraft;
  checks: { id: string; label: string; ok: boolean }[];
  onChange: (draft: ProjectDraft) => void;
  locked: boolean;
}) {
  const cents = parseUsdToCents(draft.basics.priceText);
  const inclusions = draft.agreement.items.filter((item) => item.confirmed && item.kind === "inclusion");
  const exclusions = draft.agreement.items.filter((item) => item.confirmed && item.kind === "exclusion");

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_minmax(0,1fr)]">
        <Row label="Project" value={draft.basics.name || "Untitled project"} />
        <Row label="Client" value={draft.basics.clientName || "—"} />
        <Row
          label="Original price"
          value={cents === null ? "—" : `${formatCents(cents)} · ${cents.toLocaleString()} cents · ${draft.basics.currency}`}
        />
        <Row label="Timezone" value={draft.basics.timezone} />
        <Row label="Agreed date" value={draft.basics.agreedDate || "No date agreed"} />
        <Row label="Owner" value={draft.people.ownerName || "—"} />
        <Row
          label="Requester"
          value={[draft.people.requesterName, draft.people.requesterEmail].filter(Boolean).join(" · ") || "—"}
        />
        <Row label="Instance" value={draft.people.instanceId || "—"} />
        <Row label="Group" value={draft.people.groupName || "—"} />
        <Row label="Chat GUID" value={draft.people.chatGuid || "—"} mono />
        <Row label="Included" value={inclusions.map((item) => item.description).join("; ") || "None confirmed"} />
        <Row label="Excluded" value={exclusions.map((item) => item.description).join("; ") || "None confirmed"} />
        <Row
          label="Operations"
          value={[draft.automation.replaceText ? "replace_text" : null, draft.automation.changeColor ? "change_color" : null]
            .filter(Boolean)
            .join(", ") || "None"}
        />
        <Row label="Allowance" value={`${draft.automation.unitsText || "0"} per accepted request`} />
        <Row label="Targets" value={draft.automation.targetsText.trim() || "None listed"} />
        <Row label="Pause" value={pauseLabel(draft)} />
        <Row label="Notifications" value={notificationLabel(draft)} />
        <Row label="Exclusions" value={draft.automation.exclusions} />
      </dl>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Checks</p>
          <ul className="flex flex-col gap-2">
            {checks.map((check) => (
              <li key={check.id} className="flex items-center gap-2 text-sm">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    check.ok ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn",
                  )}
                >
                  {check.ok ? "Done" : "Needed"}
                </span>
                <span>{check.label}</span>
              </li>
            ))}
          </ul>
          <label htmlFor="disclosure" className="mt-2 flex items-start gap-3 text-sm">
            <Checkbox
              id="disclosure"
              checked={draft.review.disclosureConfirmed}
              disabled={locked}
              onCheckedChange={(checked) =>
                onChange({ ...draft, review: { disclosureConfirmed: checked === true } })
              }
            />
            <span>I confirm everyone in this group knows an assistant reads and replies to project messages.</span>
          </label>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Assistant introduction (sent on activation)
          </p>
          <div className="rounded-xl border bg-muted/70 px-3 py-2.5 text-sm">{introduction(draft)}</div>
          <p className="text-xs text-muted-foreground">
            Messages sent before activation are kept as context only and are never turned into work. A draft may store this
            intake and still cannot accept automatically.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("min-w-0", mono && "font-mono text-xs")}>{value}</dd>
    </>
  );
}
