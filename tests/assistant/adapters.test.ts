// Synthetic unit fixtures only. No real Photon webhook payload or live service.
import assert from "node:assert/strict";
import test from "node:test";
import { AuthenticationError, RateLimitError, ValidationError, type Message } from "@photon-ai/advanced-imessage/http";
import { acceptanceCandidateSchema } from "../../lib/assistant/contracts";
import { ingestPhotonWebhook } from "../../lib/assistant/intake";
import { readGeminiConfig, readPhotonConfig } from "../../lib/assistant/config";
import { createPhotonSender } from "../../lib/photon/sender";
import {
  createMessageInterpreter, interpretationContextSchema, validateInterpretation,
  type Interpretation, type InterpretationContext,
} from "../../lib/ai/interpret-messages";

const context: InterpretationContext = {
  projectId: "project-1", scopeVersion: 1, policyVersion: 2, inputWatermark: "event-7",
  messages: [{ revisionId: "m1:r1", text: "Make the heading green", role: "requester" }],
  scope: [{ id: "scope-1", kind: "inclusion", text: "Heading color changes" }],
  targets: [{ id: "home.heading", description: "Existing hero heading", operations: ["change_color"] }],
  unresolvedRequests: [], tasks: [],
};
function output(): Interpretation {
  return { intents: [{
    intent: "new_request", summary: "Change heading color", existingRequestId: null, taskId: null,
    operation: "change_color", targetId: "home.heading",
    payload: { color: "green", locator: null, replacementText: null },
    sources: [{ revisionId: "m1:r1", quote: "heading green" }],
    scopeEvidence: [{ scopeItemId: "scope-1", quote: "color changes" }],
    missingFields: [], ambiguous: false, conflicting: false, requestsNewDeadline: false,
  }] };
}

test("interpretations require exact quotes and project-scoped IDs", () => {
  assert.deepEqual(validateInterpretation(output(), context), output());
  for (const mutate of [
    (x: Interpretation) => { x.intents[0].sources[0].quote = "invented"; },
    (x: Interpretation) => { x.intents[0].targetId = "other-project-target"; },
    (x: Interpretation) => { x.intents[0].scopeEvidence[0].scopeItemId = "other-scope"; },
    (x: Interpretation) => { x.intents[0].taskId = "other-task"; },
    (x: Interpretation) => { x.intents[0].payload.color = null; },
    (x: Interpretation) => { x.intents[0].intent = "clarification_answer"; },
  ]) {
    const data = output(); mutate(data);
    assert.throws(() => validateInterpretation(data, context));
  }
});

test("color requests tolerate descriptive locators without granting policy permission", () => {
  const raw = output();
  raw.intents[0].payload.locator = "heading";
  const result = validateInterpretation(raw, { ...context, targets: [{ ...context.targets[0], operations: [] }] });
  assert.equal(result.intents[0].payload.locator, null);
  assert.equal(result.intents[0].operation, "change_color");
  const mixed = output(); mixed.intents[0].payload.replacementText = "Unrelated text change";
  assert.throws(() => validateInterpretation(mixed,context));
});

test("guidance mode supports actionable owner tasks without inventing a technical target ID", () => {
  const value = output();
  value.intents[0] = { ...value.intents[0], operation: "project_change", targetId: null, policyAssessment: "allowed",
    payload: { color: null, locator: null, replacementText: null, targetDescription: "Homepage heading", instructions: "Increase the heading's spacing to 24px" } };
  expectGuidance(value);
  assert.throws(() => validateInterpretation(value, { ...context, targets: [] }), /invalid_interpretation/);
  value.intents[0].targetId = "invented-id";
  assert.throws(() => expectGuidance(value), /invalid_interpretation/);
});
function expectGuidance(value: Interpretation) {
  return validateInterpretation(value, { ...context, permissionMode: "guidance", acceptanceGuidance: "Accept small visual changes", targets: [] });
}

test("status references are restricted to the same project's saved requests", () => {
  const raw = output(); raw.intents[0].intent = "status_question"; raw.intents[0].statusRequestId = "r1";
  assert.throws(() => validateInterpretation(raw,context));
  assert.equal(validateInterpretation(raw,{ ...context,requestStatuses: [{ id:"r1",title:"Heading",state:"owner_review",taskStatus:null }] }).intents[0].statusRequestId,"r1");
});

test("model output cannot inject recipients, authority or unsupported operations", () => {
  assert.throws(() => validateInterpretation({ ...output(), recipient: "private-chat" }, context));
  const data = output();
  assert.throws(() => validateInterpretation({ intents: [{ ...data.intents[0], accepted: true }] }, context));
  assert.throws(() => validateInterpretation({ intents: [{ ...data.intents[0], operation: "execute_code" }] }, context));
});

test("owner/assistant text alone cannot be cited as a client request", () => {
  assert.throws(() => validateInterpretation(output(), {
    ...context, messages: [{ ...context.messages[0], role: "owner" }],
  }));
});

test("private context fields and excessive message context are rejected", () => {
  assert.equal(interpretationContextSchema.safeParse({ ...context, privatePricingNote: "SECRET" }).success, false);
  assert.equal(interpretationContextSchema.safeParse({ ...context, messages: Array(21).fill(context.messages[0]) }).success, false);
});

test("Gemini gets bounded structured output config and no tools; malformed output retries once", async () => {
  let calls = 0;
  const interpreter = createMessageInterpreter({ models: { async generateContent(input) {
    calls++;
    assert.equal(input.model, "test-model");
    assert.equal(input.config?.responseMimeType, "application/json");
    assert.equal(input.config?.tools, undefined);
    assert.ok(input.config?.responseJsonSchema);
    assert.equal(JSON.stringify(input.config?.responseJsonSchema).includes('"maxLength"'),false);
    assert.equal(JSON.stringify(input.config?.responseJsonSchema).includes('"$schema"'),false);
    return { text: calls === 1 ? "invalid JSON" : JSON.stringify(output()) };
  } } }, "test-model");
  const result = await interpreter.interpret(context);
  assert.equal(calls, 2);
  assert.equal(result.inputWatermark, "event-7");
  assert.equal(result.policyVersion, 2);
});

test("repeated invalid interpretation requires owner review", async () => {
  let calls = 0;
  const interpreter = createMessageInterpreter({ models: { async generateContent() {
    calls++; return { text: JSON.stringify({ accepted: true }) };
  } } }, "test-model");
  await assert.rejects(interpreter.interpret(context), /interpretation_requires_owner_review/);
  assert.equal(calls, 2);
});

test("Gemini transport failure propagates to durable retry rather than fabricated output", async () => {
  let calls = 0;
  const interpreter = createMessageInterpreter({ models: { async generateContent() {
    calls++; throw new Error("dependency_unavailable");
  } } }, "test-model");
  await assert.rejects(interpreter.interpret(context), /dependency_unavailable/);
  assert.equal(calls, 1);
});

test("Photon sender uses exact destination, stable dedupe key and reply reference", async () => {
  const sender = createPhotonSender({ messages: { async sendText(chat, text, options) {
    assert.equal(chat, "provider-returned-group-guid");
    assert.equal(text, "Queued for the owner to do");
    assert.equal(options?.clientMessageId, "outbox-1");
    assert.equal(options?.replyTo, "source-guid");
    return { guid: "sent-guid" } as Message;
  } } });
  assert.deepEqual(await sender.sendText({ chatGuid: "provider-returned-group-guid",
    text: "Queued for the owner to do", dedupeKey: "outbox-1", replyToMessageGuid: "source-guid" }),
  { state: "sent", providerMessageGuid: "sent-guid" });
});

test("timeout after submission is unknown and sends only once", async () => {
  let calls = 0;
  const sender = createPhotonSender({ messages: { async sendText() {
    calls++; throw new Error("timeout");
  } } });
  assert.deepEqual(await sender.sendText({ chatGuid: "group", text: "Hello", dedupeKey: "outbox-2" }),
    { state: "unknown", code: "submission_uncertain" });
  assert.equal(calls, 1);
});

test("explicit rejections are distinct from uncertain duplicate sends", async () => {
  const cases = [
    { error: new AuthenticationError("sensitive provider detail", { code: "unauthenticated", grpcCode: 16, retryable: false }),
      result: { state: "failed", code: "provider_rejected", retryable: false } },
    { error: new RateLimitError("sensitive provider detail", { code: "burstRateExceeded", grpcCode: 8, retryable: true }),
      result: { state: "failed", code: "provider_rejected", retryable: true } },
    { error: new ValidationError("sensitive provider detail", { code: "duplicateMessage", grpcCode: 9, retryable: false }),
      result: { state: "unknown", code: "submission_uncertain" } },
  ];
  for (const item of cases) {
    const sender = createPhotonSender({ messages: { async sendText() { throw item.error; } } });
    assert.deepEqual(await sender.sendText({ chatGuid: "group", text: "Hello", dedupeKey: "outbox" }), item.result);
  }
});

test("missing/failed webhook verification cannot write an inbox event", async () => {
  let writes = 0;
  const inbox = { async persistVerifiedEvent() { writes++; return { inboxEventId: "inbox-1", duplicate: false }; } };
  await assert.rejects(ingestPhotonWebhook(new Uint8Array(), new Headers(), { inbox }), /not_configured/);
  await assert.rejects(ingestPhotonWebhook(new Uint8Array(), new Headers(), {
    inbox, decoder: { async verifyAndNormalize() { throw new Error("verification_failed"); } },
  }), /verification_failed/);
  assert.equal(writes, 0);
});

test("intake awaits durable commit and exposes duplicate receipt", async () => {
  const event = { instanceId: "instance", eventKey: "event", kind: "message" as const,
    chatGuid: "group", senderId: "sender", messageGuid: "message", fromBot: false };
  const result = await ingestPhotonWebhook(new Uint8Array([1]), new Headers(), {
    decoder: { async verifyAndNormalize() { return event; } },
    inbox: { async persistVerifiedEvent(actual) {
      assert.deepEqual(actual, event); return { inboxEventId: "inbox-1", duplicate: true };
    } },
  });
  assert.equal(result.duplicate, true);
  await assert.rejects(ingestPhotonWebhook(new Uint8Array([1]), new Headers(), {
    decoder: { async verifyAndNormalize() { return event; } },
    inbox: { async persistVerifiedEvent() { throw new Error("commit_failed"); } },
  }), /commit_failed/);
});

test("invalid normalized identity and oversized bodies cannot reach persistence", async () => {
  let writes = 0;
  let decodes = 0;
  const dependencies = {
    decoder: { async verifyAndNormalize() {
      decodes++;
      return { instanceId: "instance", eventKey: "event", kind: "message" as const,
        chatGuid: "group", fromBot: false };
    } },
    inbox: { async persistVerifiedEvent() { writes++; return { inboxEventId: "inbox", duplicate: false }; } },
  };
  await assert.rejects(ingestPhotonWebhook(new Uint8Array(256_001), new Headers(), dependencies), /too_large/);
  assert.equal(decodes, 0);
  await assert.rejects(ingestPhotonWebhook(new Uint8Array(), new Headers(), dependencies));
  assert.equal(writes, 0);
});

test("acceptance contract rejects unsupported and incomplete work", () => {
  const candidate = {
    organizationId: "org", projectId: "project", conversationId: "chat", requestId: "req",
    requestRevision: 1, expectedScopeVersion: 1, expectedPolicyVersion: 1,
    inputWatermark: "event", operation: "replace_text", targetId: "target", scopeItemId: "scope",
    normalizedPayload: { replacementText: "New" }, sourceMessageRevisionIds: ["m1:r1"],
  };
  assert.equal(acceptanceCandidateSchema.safeParse(candidate).success, false);
  assert.equal(acceptanceCandidateSchema.safeParse({ ...candidate, normalizedPayload: { replacementText: "New", locator: "Hero" } }).success, true);
  assert.equal(acceptanceCandidateSchema.safeParse({ ...candidate, operation: "replace_image_reference" }).success, false);
});

test("configuration errors do not expose credential values", () => {
  assert.throws(() => readPhotonConfig({ PHOTON_TOKEN: "SECRET" }), error =>
    error instanceof Error && !error.message.includes("SECRET"));
  assert.throws(() => readGeminiConfig({ GEMINI_API_KEY: "SECRET" }), /configuration_missing_or_invalid/);
});

test("project answers require scoped supporting records and cannot carry work", () => {
  const c: InterpretationContext = {
    ...context,
    project: { name: "Website", timezone: "America/Los_Angeles", agreedDueDate: null },
    scope: [...context.scope, { id: "term-1", kind: "responsibility", text: "Client supplies images." }],
  };
  const value = output();
  value.intents[0] = {
    ...value.intents[0], intent: "project_question", operation: null, targetId: null,
    payload: { color: null, locator: null, replacementText: null },
    answer: {
      text: "The confirmed agreement says the client supplies the images.", basis: "grounded",
      references: [{ kind: "agreement", id: "term-1" }],
    },
  };
  assert.equal(validateInterpretation(value, c).intents[0].answer?.text, value.intents[0].answer?.text);
  for (const mutate of [
    (x: Interpretation) => { x.intents[0].answer!.references[0].id = "another-project-term"; },
    (x: Interpretation) => { x.intents[0].answer!.references = []; },
    (x: Interpretation) => { x.intents[0].answer!.references = [{ kind: "message", id: "m1:r1" }]; },
    (x: Interpretation) => { x.intents[0].operation = "change_color"; },
    (x: Interpretation) => { x.intents[0].payload.color = "green"; },
    (x: Interpretation) => { x.intents[0].intent = "new_request"; },
    (x: Interpretation) => { delete x.intents[0].answer; },
  ]) {
    const copy = structuredClone(value); mutate(copy);
    assert.throws(() => validateInterpretation(copy, c));
  }
  value.intents[0].answer = {
    text: "I don't have a saved reason for the blocker. Which task do you mean?",
    basis: "missing_information", references: [],
  };
  assert.doesNotThrow(() => validateInterpretation(value, c));
  assert.equal(interpretationContextSchema.safeParse({ ...c, project: { ...c.project, internalNote: "SECRET" } }).success, false);
});
