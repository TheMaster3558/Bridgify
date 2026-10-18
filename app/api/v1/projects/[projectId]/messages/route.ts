import { api } from "@/lib/api";
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
