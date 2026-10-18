import type { adminDb } from "./admin";

// Idempotent cleanup: a failed Storage request leaves the receipt pending.
// The route handles its own project immediately; the worker retries pending rows.
export async function cleanupDeletedProject(
  client: ReturnType<typeof adminDb>,
  projectId?: string,
) {
  let query = client
    .from("project_deletion_cleanup")
    .select("project_id,storage_paths")
    .eq("status", "pending")
    .order("updated_at")
    .limit(1);
  if (projectId) query = query.eq("project_id", projectId);
  const { data, error } = await query;
  if (error) throw new Error("Project file cleanup unavailable.");
  const row = data?.[0];
  if (!row) return { pending: false };
  try {
    const paths = row.storage_paths as string[];
    if (
      !Array.isArray(paths) ||
      paths.some(
        (p) => typeof p !== "string" || !p.startsWith(`${row.project_id}/`),
      )
    )
      throw new Error("Invalid private file path");
    for (let i = 0; i < paths.length; i += 100) {
      const result = await client.storage
        .from("agreements")
        .remove(paths.slice(i, i + 100));
      if (result.error) throw new Error("Storage cleanup failed");
    }
    const saved = await client
      .from("project_deletion_cleanup")
      .update({
        status: "done",
        storage_paths: [],
        updated_at: new Date().toISOString(),
      })
      .eq("project_id", row.project_id);
    return { pending: !!saved.error };
  } catch {
    // Rotate failed rows so one unavailable file does not starve other projects.
    await client
      .from("project_deletion_cleanup")
      .update({ updated_at: new Date().toISOString() })
      .eq("project_id", row.project_id);
    return { pending: true };
  }
}
