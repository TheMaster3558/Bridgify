import { randomUUID } from "node:crypto";
import { authenticatedUserId } from "@/lib/auth/user";
import { IntakeError } from "@/lib/assistant/intake-error";
import { getConversationHistory } from "@/lib/db/conversation-history";
import { getDatabase } from "@/lib/db/postgres";

export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const requestId = randomUUID();
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const userId = await authenticatedUserId(request);
    if (!userId) throw new IntakeError("unauthenticated", 401);
    const { projectId } = await context.params;
    const cursor = new URL(request.url).searchParams.get("cursor") ?? undefined;
    const data = await getConversationHistory(getDatabase(), { userId, projectId, cursor });
    return Response.json({ data, requestId }, { headers });
  } catch (error) {
    const known = error instanceof IntakeError;
    return Response.json({ error: { code: known ? error.code : "history_unavailable",
      message: known ? error.code : "Conversation history is temporarily unavailable." }, requestId },
    { status: known ? error.status : 503, headers });
  }
}
