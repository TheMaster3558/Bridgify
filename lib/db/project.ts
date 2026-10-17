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
  const [documents, scope, members, binding, invitations] = await Promise.all([
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
    client
      .from("project_members")
      .select("user_id,requester,approver")
      .eq("project_id", id),
    client.from("chat_bindings").select("*").eq("project_id", id).maybeSingle(),
    client
      .from("project_invitations")
      .select("id,email,expires_at,accepted_at,revoked_at")
      .eq("project_id", id)
      .is("revoked_at", null),
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
    members: checked(members),
    binding: checked(binding),
    invitations: checked(invitations),
    spans,
  };
}
