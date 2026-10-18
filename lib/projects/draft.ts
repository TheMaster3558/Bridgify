export const AGREEMENT_LIMIT = 30_000;

export const STEPS = [
  { id: 1, title: "Basics" },
  { id: 2, title: "Agreement" },
  { id: 3, title: "People and chat" },
  { id: 4, title: "Automation" },
  { id: 5, title: "Review and activate" },
] as const;

export type StepId = (typeof STEPS)[number]["id"];

export const TIMEZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Phoenix",
  "America/Chicago",
  "America/New_York",
  "America/Anchorage",
  "Pacific/Honolulu",
  "UTC",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
] as const;

export type ScopeKind = "inclusion" | "exclusion";

export type ScopeItem = {
  id: string;
  kind: ScopeKind;
  description: string;
  sourceLabel: string;
  sourceQuote: string;
  confirmed: boolean;
};

export type BindingRole = "requester" | "owner" | "assistant";

export type Binding = {
  id: string;
  senderId: string;
  mapsTo: BindingRole;
  confirmed: boolean;
};

export type ProjectStatus = "draft" | "active" | "completed" | "archived";

export type AgreementStatus = "empty" | "processing" | "ready" | "rejected";

export type TestStatus = "idle" | "sending" | "needs_confirmation" | "delivered" | "failed";

export type ProjectDraft = {
  id: string;
  status: ProjectStatus;
  step: StepId;
  savedAt: string | null;
  version: number;
  basics: {
    name: string;
    clientName: string;
    priceText: string;
    currency: "USD";
    timezone: string;
    agreedDate: string;
  };
  agreement: {
    mode: "pdf" | "paste";
    fileName: string;
    text: string;
    status: AgreementStatus;
    error: string;
    items: ScopeItem[];
  };
  people: {
    ownerName: string;
    requesterName: string;
    requesterEmail: string;
    instanceId: string;
    groupName: string;
    chatGuid: string;
    testStatus: TestStatus;
    testDetail: string;
    testedChatGuid: string;
    bindings: Binding[];
  };
  automation: {
    replaceText: boolean;
    changeColor: boolean;
    exclusions: string;
    allowanceMode: "per_accepted_request";
    unitsText: string;
    targetsText: string;
    pauseBehavior: "pause" | "review_only";
    notifyDecisions: boolean;
    notifyCompletions: boolean;
    maxOpenTasksText: string;
    roundReviewAcknowledged: boolean;
  };
  review: {
    disclosureConfirmed: boolean;
  };
  activatedAt: string | null;
};

const DEFAULT_EXCLUSIONS =
  "Checkout, payments, authentication, new pages, integrations, database changes, security settings, and any operation other than replace_text or change_color.";

export function browserTimezone() {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (TIMEZONES as readonly string[]).includes(zone) ? zone : "America/Los_Angeles";
}

export function createDraft(id = crypto.randomUUID()): ProjectDraft {
  return {
    id,
    status: "draft",
    step: 1,
    savedAt: null,
    version: 1,
    basics: {
      name: "",
      clientName: "",
      priceText: "",
      currency: "USD",
      timezone: browserTimezone(),
      agreedDate: "",
    },
    agreement: {
      mode: "pdf",
      fileName: "",
      text: "",
      status: "empty",
      error: "",
      items: [],
    },
    people: {
      ownerName: "",
      requesterName: "",
      requesterEmail: "",
      instanceId: "",
      groupName: "",
      chatGuid: "",
      testStatus: "idle",
      testDetail: "",
      testedChatGuid: "",
      bindings: [
        { id: crypto.randomUUID(), senderId: "", mapsTo: "requester", confirmed: false },
        { id: crypto.randomUUID(), senderId: "", mapsTo: "owner", confirmed: false },
        { id: crypto.randomUUID(), senderId: "", mapsTo: "assistant", confirmed: false },
      ],
    },
    automation: {
      replaceText: true,
      changeColor: true,
      exclusions: DEFAULT_EXCLUSIONS,
      allowanceMode: "per_accepted_request",
      unitsText: "0",
      targetsText: "",
      pauseBehavior: "pause",
      notifyDecisions: true,
      notifyCompletions: false,
      maxOpenTasksText: "10",
      roundReviewAcknowledged: false,
    },
    review: { disclosureConfirmed: false },
    activatedAt: null,
  };
}

export function parseUsdToCents(input: string): number | null {
  const cleaned = input.trim().replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) return null;
  return cents;
}

export function formatCents(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function parseWholeNumber(input: string): number | null {
  if (!/^\d+$/.test(input.trim())) return null;
  const value = Number(input.trim());
  return Number.isSafeInteger(value) ? value : null;
}

export function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function formatAgreedDate(value: string) {
  if (!value || !isIsoDate(value)) return "No date agreed";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatSavedAt(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
}

export function projectTitle(draft: ProjectDraft) {
  return draft.basics.name.trim() || "Untitled project";
}

export function targetList(draft: ProjectDraft) {
  return draft.automation.targetsText
    .split(",")
    .map((target) => target.trim())
    .filter(Boolean);
}

export function mentionsRevisionRounds(text: string) {
  return /\brounds?\b/i.test(text);
}

export function confirmedItems(draft: ProjectDraft) {
  return draft.agreement.items.filter((item) => item.confirmed && item.description.trim());
}

export function testIsCurrent(draft: ProjectDraft) {
  return draft.people.testStatus === "delivered" && draft.people.testedChatGuid === draft.people.chatGuid.trim();
}

function binding(draft: ProjectDraft, role: BindingRole) {
  return draft.people.bindings.find((item) => item.mapsTo === role);
}

export function basicsErrors(draft: ProjectDraft) {
  const errors: Record<string, string> = {};
  if (!draft.basics.name.trim()) errors.name = "Enter a project name.";
  if (!draft.basics.clientName.trim()) errors.clientName = "Enter the client name.";
  if (parseUsdToCents(draft.basics.priceText) === null) {
    errors.price = "Enter zero or more, with up to two decimal places. The price is stored in cents.";
  }
  if (draft.basics.currency !== "USD") errors.currency = "USD is the only currency in this release.";
  if (!draft.basics.timezone.trim()) errors.timezone = "Choose the project timezone.";
  if (draft.basics.agreedDate && !isIsoDate(draft.basics.agreedDate)) {
    errors.agreedDate = "Use a real calendar date the client already agreed to.";
  }
  return errors;
}

export function agreementErrors(draft: ProjectDraft) {
  const errors: Record<string, string> = {};
  if (draft.agreement.status === "processing") errors.agreement = "Wait until extraction finishes.";
  else if (draft.agreement.status === "rejected") errors.agreement = draft.agreement.error || "This agreement was rejected.";
  else if (!draft.agreement.text.trim()) errors.agreement = "Paste the agreement or upload a text PDF.";
  if (confirmedItems(draft).length < 1) {
    errors.scope = "Confirm at least one scope item before this setup can activate.";
  }
  return errors;
}

export function peopleErrors(draft: ProjectDraft, projects: ProjectDraft[]) {
  const errors: Record<string, string> = {};
  if (!draft.people.ownerName.trim()) errors.ownerName = "Enter the owner on this project.";
  if (!draft.people.requesterName.trim()) errors.requesterName = "Enter the client contact.";
  if (draft.people.requesterEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.people.requesterEmail.trim())) {
    errors.requesterEmail = "Enter a valid contact email or leave it blank. Clients communicate through iMessage.";
  }
  if (!draft.people.instanceId.trim()) errors.instanceId = "Enter the Photon instance id.";
  if (!draft.people.groupName.trim()) errors.groupName = "Enter the group name.";
  if (!draft.people.chatGuid.trim()) errors.chatGuid = "Enter the chat GUID. A display name is not a binding.";
  else if (draft.people.chatGuid.trim() === draft.people.groupName.trim()) {
    errors.chatGuid = "Use the chat GUID returned for this group, not its display name.";
  }

  const conflict = activeGuidConflict(draft, projects);
  if (conflict) {
    errors.chatGuid = `This group is already active on ${projectTitle(conflict)}. One group can belong to one active project.`;
  }

  const requester = binding(draft, "requester");
  const owner = binding(draft, "owner");
  const assistant = binding(draft, "assistant");
  if (!requester?.senderId.trim() || !requester.confirmed) {
    errors.requesterBinding = "Confirm the sender id that maps to the client requester.";
  }
  if (!owner?.senderId.trim() || !owner.confirmed) {
    errors.ownerBinding = "Confirm the sender id that maps to the owner.";
  }
  if (assistant?.senderId.trim() && assistant.confirmed && requester?.senderId.trim() === assistant.senderId.trim()) {
    errors.assistantBinding = "The assistant cannot use the requester’s sender id.";
  }
  const senders = draft.people.bindings.map((item) => item.senderId.trim()).filter(Boolean);
  if (new Set(senders).size !== senders.length) {
    errors.bindings = "Each sender id can map to only one person.";
  }
  if (!testIsCurrent(draft)) {
    errors.test = "Deliver a test to this exact group and confirm it arrived.";
  }
  return errors;
}

export function automationErrors(draft: ProjectDraft) {
  const errors: Record<string, string> = {};
  if (draft.automation.allowanceMode !== "per_accepted_request") {
    errors.mode = "Per accepted request is the only counting mode in this release.";
  }
  if (parseWholeNumber(draft.automation.unitsText) === null) {
    errors.units = "Enter a whole number of units, zero or more. The default is 0 until you set it.";
  }
  if ((parseWholeNumber(draft.automation.maxOpenTasksText) ?? 0) < 1) {
    errors.maxOpenTasks = "Enter a maximum of at least 1 open automatically accepted task.";
  }
  if (mentionsRevisionRounds(draft.agreement.text) && !draft.automation.roundReviewAcknowledged) {
    errors.rounds =
      "This agreement mentions revision rounds. Per-request counting must not stand in for a round. Confirm that revision requests stay in manual review, or that the agreement really counts each accepted request.";
  }
  return errors;
}

export function validateStep(draft: ProjectDraft, step: StepId, projects: ProjectDraft[]) {
  if (step === 1) return basicsErrors(draft);
  if (step === 2) return agreementErrors(draft);
  if (step === 3) return peopleErrors(draft, projects);
  if (step === 4) return automationErrors(draft);
  return {};
}

export type ActivationCheck = {
  id: string;
  label: string;
  ok: boolean;
};

export function activationChecks(draft: ProjectDraft, projects: ProjectDraft[]): ActivationCheck[] {
  const confirmed = confirmedItems(draft);
  const requester = binding(draft, "requester");
  const owner = binding(draft, "owner");
  const units = parseWholeNumber(draft.automation.unitsText);
  const roundsOk = !mentionsRevisionRounds(draft.agreement.text) || draft.automation.roundReviewAcknowledged;
  return [
    {
      id: "scope",
      label: `Scope baseline confirmed (${confirmed.length} ${confirmed.length === 1 ? "item" : "items"})`,
      ok: confirmed.length >= 1 && draft.agreement.status === "ready",
    },
    {
      id: "people",
      label: "Participant bindings confirmed",
      ok: Boolean(
        draft.people.ownerName.trim() &&
          draft.people.requesterName.trim() &&
          requester?.confirmed &&
          requester.senderId.trim() &&
          owner?.confirmed &&
          owner.senderId.trim(),
      ),
    },
    {
      id: "test",
      label: "Group test message delivered",
      ok: testIsCurrent(draft),
    },
    {
      id: "revisions",
      label: "Revision counting defined",
      ok: draft.automation.allowanceMode === "per_accepted_request" && units !== null && roundsOk,
    },
    {
      id: "disclosure",
      label: "Participants told about the assistant",
      ok: draft.review.disclosureConfirmed,
    },
    {
      id: "basics",
      label: "Project basics valid",
      ok: Object.keys(basicsErrors(draft)).length === 0,
    },
    {
      id: "group",
      label: "One active group for this project",
      ok: Boolean(draft.people.chatGuid.trim()) && !activeGuidConflict(draft, projects),
    },
  ];
}

export function canActivate(draft: ProjectDraft, projects: ProjectDraft[]) {
  return (
    draft.status === "draft" &&
    activationChecks(draft, projects).every((check) => check.ok) &&
    Object.keys(peopleErrors(draft, projects)).length === 0 &&
    Object.keys(automationErrors(draft)).length === 0
  );
}

export function activeGuidConflict(draft: ProjectDraft, projects: ProjectDraft[]) {
  const guid = draft.people.chatGuid.trim();
  if (!guid) return null;
  return (
    projects.find(
      (project) => project.id !== draft.id && project.status === "active" && project.people.chatGuid.trim() === guid,
    ) ?? null
  );
}

export function introduction(draft: ProjectDraft) {
  const client = firstName(draft.people.requesterName) || "there";
  const owner = draft.people.ownerName.trim() || "the project owner";
  const project = draft.basics.name.trim() || "this project";
  const units = parseWholeNumber(draft.automation.unitsText);
  const allowance =
    units === null ? "the revision allowance on the project" : units === 1 ? "1 revision" : `${units} revisions`;
  return `Hi ${client}! I'm Bridgify, ${owner}'s project assistant for ${project}. I'll read messages here, confirm included changes, and check with ${owner} on anything new. This project includes ${allowance}, each counted per accepted change. Several changes in one message can use several revisions. Anything about price or dates always comes from ${owner}.`;
}

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] ?? "";
}

export function automationLabel(draft: ProjectDraft) {
  if (draft.status === "draft") return `off (setup step ${draft.step} of 5)`;
  if (draft.status === "active") return "Enabled";
  return "off";
}

export function approvedValueLabel(draft: ProjectDraft) {
  if (draft.status === "draft") return "—";
  const cents = parseUsdToCents(draft.basics.priceText);
  return cents === null ? "—" : formatCents(cents);
}

export function extractScopeItems(text: string): ScopeItem[] {
  const lines = text.split(/\r?\n/);
  let kind: ScopeKind | null = null;
  const items: ScopeItem[] = [];

  const push = (description: string, sourceQuote: string, line: number, forced?: ScopeKind) => {
    const clean = description.trim().replace(/\s+/g, " ").replace(/[.;]+$/, "");
    if (!clean) return;
    items.push({
      id: crypto.randomUUID(),
      kind: forced ?? kind ?? "inclusion",
      description: clean,
      sourceLabel: `Line ${line}`,
      sourceQuote,
      confirmed: false,
    });
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      kind = null;
      return;
    }
    const heading = trimmed
      .toLowerCase()
      .replace(/^#{1,3}\s*/, "")
      .replace(/[:*#]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (/^(revisions?|revision allowance|change allowance)\b/.test(heading)) {
      kind = null;
      return;
    }
    if (/^(exclusions?|not included|out of scope|excluded)\b/.test(heading)) {
      kind = "exclusion";
      return;
    }
    if (/^(inclusions?|included|in scope|scope of work|deliverables?|what you get|scope)\b/.test(heading)) {
      kind = "inclusion";
      return;
    }

    const bullet = trimmed.match(/^(?:[-*•]|\d+[.)])\s+(.+)$/);
    if (!bullet) return;
    const body = bullet[1];
    const forced: ScopeKind | undefined = /\b(not included|excluded|exclusion|out of scope)\b/i.test(body)
      ? "exclusion"
      : undefined;
    push(body, trimmed, index + 1, forced);
  });

  return items;
}

export function agreementTooLongMessage(length: number) {
  return `This agreement is ${length.toLocaleString()} characters. The limit is ${AGREEMENT_LIMIT.toLocaleString()} characters, so it was rejected and not shortened.`;
}

export function judgeAgreementText(text: string, fileName = "") {
  if (text.length > AGREEMENT_LIMIT) {
    return { ok: false as const, fileName, error: agreementTooLongMessage(text.length) };
  }
  if (!text.trim()) {
    return {
      ok: false as const,
      fileName,
      error: "No text was found. Scanned PDFs are rejected. Paste the agreement or upload a text PDF.",
    };
  }
  return { ok: true as const, fileName, text };
}

function unescapePdfString(value: string) {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "")
    .replace(/\\t/g, " ")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}

export function extractPdfText(bytes: Uint8Array) {
  const raw = new TextDecoder("latin1").decode(bytes);
  if (!raw.includes("%PDF")) {
    return { ok: false as const, error: "That file is not a PDF. Upload a text PDF or paste the agreement." };
  }

  const pieces: string[] = [];
  const pattern = /\(((?:\\.|[^\\)]){2,})\)/g;
  for (const match of raw.matchAll(pattern)) {
    const text = unescapePdfString(match[1]);
    if (/[A-Za-z]{3}/.test(text)) pieces.push(text);
  }
  const text = pieces.join("\n").replace(/[ \t]+\n/g, "\n").trim();
  if (text) return judgeAgreementText(text);

  const scanned = /\/Subtype\s*\/Image/.test(raw) && !/\/Font/.test(raw);
  return {
    ok: false as const,
    error: scanned
      ? "This looks like a scanned PDF. Scanned files are rejected. Paste the agreement text instead. Nothing was shortened or saved."
      : "No extractable text was found in this PDF. Paste the agreement text, or upload a text PDF that is not a scan.",
  };
}

export async function readAgreementFile(file: File) {
  const name = file.name || "agreement";
  const isText = file.type === "text/plain" || name.toLowerCase().endsWith(".txt");
  const isPdf = file.type === "application/pdf" || name.toLowerCase().endsWith(".pdf");
  if (!isText && !isPdf) {
    return {
      ok: false as const,
      fileName: name,
      error: "Upload a text PDF or a plain-text file. Other file types are rejected.",
    };
  }

  try {
    if (isText) {
      const text = await file.text();
      return judgeAgreementText(text, name);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const extracted = extractPdfText(bytes);
    return extracted.ok ? { ...extracted, fileName: name } : { ...extracted, fileName: name };
  } catch {
    return { ok: false as const, fileName: name, error: "The file could not be read. Try again or paste the agreement." };
  }
}

export function operationLabels(draft: ProjectDraft) {
  const enabled = [
    draft.automation.replaceText ? "replace_text" : null,
    draft.automation.changeColor ? "change_color" : null,
  ].filter(Boolean);
  return enabled.length ? enabled.join(", ") : "None selected";
}

export function pauseLabel(draft: ProjectDraft) {
  return draft.automation.pauseBehavior === "review_only"
    ? "Review only — keep reading the group, accept nothing automatically"
    : "Pause — stop new automatic acceptance and keep intake";
}

export function notificationLabel(draft: ProjectDraft) {
  const decision = draft.automation.notifyDecisions
    ? "Dashboard alert when a decision is waiting"
    : "No dashboard decision alert";
  const completion = draft.automation.notifyCompletions
    ? "A finished task may offer a client note, and that checkbox starts off"
    : "Client completion notes are off";
  return `${decision}. ${completion}.`;
}
