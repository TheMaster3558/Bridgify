import { after } from "next/server";
import { z } from "zod";
import { api, checked, idempotency, ApiError } from "@/lib/api";
import { readJson } from "@/lib/body";
import { runAutomationBatch } from "@/lib/assistant/run-batch";
export const maxDuration = 60;
export async function POST(
  request: Request,
  context: { params: Promise<{ proposalId: string }> },
) {
  return api(request, async (client) => {
    const id = z.uuid().parse((await context.params).proposalId);
    const input = z
      .object({
        revision: z.number().int().positive(),
        expectedVersion: z.number().int().positive(),
        expectedProjectVersion: z.number().int().positive(),
        termsHash: z.string().regex(/^[a-f0-9]{64}$/),
        outcome: z.enum(["approved", "declined", "changes_requested"]),
        evidenceMessageIds: z.array(z.uuid()).min(1).max(10),
        confirmed: z.literal(true),
        note: z.string().trim().min(3).max(2000),
      })
      .strict()
      .parse(await readJson(request));
    const row = checked(
      await client
        .from("proposal_revisions")
        .select("project_id")
        .eq("proposal_id", id)
        .eq("revision", input.revision)
        .maybeSingle(),
    );
    if (!row) throw new ApiError(404, "NOT_FOUND", "Proposal unavailable.");
    const result = checked(
      await client.rpc("record_proposal_response", {
        p_project: row.project_id,
        p_proposal: id,
        p_revision: input.revision,
        p_expected: input.expectedVersion,
        p_project_version: input.expectedProjectVersion,
        p_hash: input.termsHash,
        p_outcome: input.outcome,
        p_evidence: input.evidenceMessageIds,
        p_confirmed: input.confirmed,
        p_note: input.note,
        p_key: idempotency(request),
      }),
    );
    after(() => runAutomationBatch(row.project_id));
    return result;
  });
}
