import { createHash } from "node:crypto";
import { getDatabase } from "../db/postgres";
import { createProjectAutomationInbox } from "./automation";
import { peopleSchema } from "../schemas/onboarding";
import { readPhotonHistory } from "../photon/message-history";

// Imports real provider history, with the same authority/cutoff rules as webhooks.
// Never invents tasks, conversations, clients, agreements or revision balances.
export async function syncProjectAutomationHistory() {
  const database = getDatabase();
  const inbox = createProjectAutomationInbox(database);
  const projects = (
    await database.query<{
      id: string;
      people: unknown;
      activation_cutoff: string;
    }>(
      "select id,people,activation_cutoff from projects where status in ('active','review_only') and activation_cutoff is not null order by id",
    )
  ).rows;
  let imported = 0;
  for (const project of projects) {
    const p = peopleSchema.parse(project.people);
    const connection = {
      projectId: project.id,
      instanceId: p.instance_id,
      userId: p.photon_user_id,
      address: p.client_sender_id,
      agentAddress: p.agent_number,
      chatGuid: p.chat_guid,
    };
    let cursor: string | undefined;
    const messages = [];
    do {
      const page = await readPhotonHistory(connection, cursor);
      messages.push(
        ...page.messages.filter(
          (m) =>
            Date.parse(m.sentAt) >=
            new Date(project.activation_cutoff).getTime(),
        ),
      );
      // Continue through all pages: provider ordering must not be assumed.
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    messages.sort(
      (a, b) => a.sentAt.localeCompare(b.sentAt) || a.id.localeCompare(b.id),
    );
    for (const message of messages) {
      const receipt = await inbox.persistVerifiedEvent({
        instanceId: p.instance_id,
        eventKey: `history:${createHash("sha256")
          .update(
            JSON.stringify([
              p.chat_guid,
              message.id,
              message.editedAt,
              message.deleted,
            ]),
          )
          .digest("hex")}`,
        kind: message.deleted
          ? "delete"
          : message.editedAt
            ? "edit"
            : "message",
        chatGuid: p.chat_guid,
        senderId:
          message.sender === "client"
            ? p.client_sender_id
            : message.sender === "agent"
              ? (p.agent_number ?? "unknown")
              : "unknown",
        messageGuid: message.id,
        direction: message.direction,
        occurredAt: message.sentAt,
        fromBot: false,
        text: message.text ?? "",
        contentType: message.attachments.length ? "attachment" : "text",
      });
      if (!receipt.duplicate) imported++;
    }
  }
  return imported;
}
