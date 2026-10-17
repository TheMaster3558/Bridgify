import { z } from "zod";
import { api, checked, ApiError } from "@/lib/api";
export async function GET(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  return api(request, async (client) => {
    const id = z.uuid().parse((await context.params).documentId);
    const document = checked(
      await client
        .from("documents")
        .select("id,project_id,status,error,extraction")
        .eq("id", id)
        .maybeSingle(),
    );
    if (!document)
      throw new ApiError(404, "NOT_FOUND", "Document unavailable.");
    const spans = checked(
      await client
        .from("document_spans")
        .select("*")
        .eq("document_id", id)
        .order("page"),
    );
    return { document, spans };
  });
}
