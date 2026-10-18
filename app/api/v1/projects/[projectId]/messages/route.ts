import { readJson } from "@/lib/body";
import {
  ownerMessageSchema,
  sendProjectMessage,
} from "@/lib/db/send-project-message";
import { api, idempotency } from "@/lib/api";
import { getProjectChatHistory } from "@/lib/db/project-chat-history";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  return api(request, async (client) =>
    getProjectChatHistory(
      client,
      (await context.params).projectId,
      new URL(request.url).searchParams.get("cursor") || undefined,
    ),
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  return api(request, async (client, user) =>
    sendProjectMessage(
      client,
      user.id,
      (await context.params).projectId,
      idempotency(request),
      ownerMessageSchema.parse(await readJson(request)),
    ),
  );
}
