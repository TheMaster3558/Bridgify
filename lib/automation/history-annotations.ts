import { checked } from "@/lib/api";
import type { db } from "@/lib/db/server";

type Client = Awaited<ReturnType<typeof db>>;

/** Read through owner RLS when the optional history RPC has not been installed. */
export async function historyAnnotations(
  client: Client,
  projectId: string,
  requestIds: string[],
  roundIds: string[],
) {
  const result = await client.rpc("automation_history_annotations", {
    p_project: projectId,
    p_requests: requestIds,
    p_rounds: roundIds,
  });
  if (!result.error) return result.data;
  // Only missing-function errors permit fallback. Permission and execution
  // failures must remain visible rather than being mistaken for empty history.
  if (!["PGRST202", "42883"].includes(result.error.code))
    return checked(result);

  const openRound = checked(
    await client
      .from("automation_rounds")
      .select("*")
      .eq("project_id", projectId)
      .eq("state", "open")
      .maybeSingle(),
  );
  const ids = [...new Set([...roundIds, ...(openRound ? [openRound.id] : [])])];
  const rows = async (table: string, column: string, values: string[]) =>
    values.length
      ? checked(
          await client
            .from(table)
            .select("*")
            .eq("project_id", projectId)
            .in(column, values),
        )
      : [];
  const [members, requestRefunds, roundRefunds] = await Promise.all([
    rows("automation_round_members", "request_id", requestIds),
    rows("automation_revision_refunds", "request_id", requestIds),
    rows("automation_round_refunds", "round_id", roundIds),
  ]);
  const roundCounts: Record<string, number> = {};
  // Exact HEAD counts avoid row caps even for rounds with thousands of members.
  // Bound concurrency when reading a full page of historical rounds.
  for (let offset = 0; offset < ids.length; offset += 10) {
    await Promise.all(
      ids.slice(offset, offset + 10).map(async (roundId) => {
        const count = await client
          .from("automation_round_members")
          .select("request_id", { count: "exact", head: true })
          .eq("project_id", projectId)
          .eq("round_id", roundId);
        checked(count);
        roundCounts[roundId] = count.count ?? 0;
      }),
    );
  }
  return { openRound, roundCounts, members, requestRefunds, roundRefunds };
}
