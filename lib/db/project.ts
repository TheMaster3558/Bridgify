import { checked, ApiError } from "@/lib/api";
import type { db } from "@/lib/db/server";
export async function projectBundle(
  client: Awaited<ReturnType<typeof db>>,
  id: string,
) {
  const project = checked(
    await client.from("projects").select("*").eq("id", id).maybeSingle(),
  );
  if (!project)
    throw new ApiError(
      404,
      "NOT_FOUND",
      "Project is unavailable to your account.",
    );
  const [documents, scope, binding] = await Promise.all([
    client
      .from("documents")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
    client
      .from("scope_versions")
      .select("*")
      .eq("project_id", id)
      .order("version", { ascending: false }),
    client.from("chat_bindings").select("*").eq("project_id", id).maybeSingle(),
  ]);
  const docs = checked(documents) || [];
  const spans = docs.length
    ? checked(
        await client
          .from("document_spans")
          .select("*")
          .in(
            "document_id",
            docs.map((d) => d.id),
          )
          .order("page"),
      )
    : [];
  return {
    project,
    documents: docs,
    scope: checked(scope),
    binding: checked(binding),
    spans,
  };
}
