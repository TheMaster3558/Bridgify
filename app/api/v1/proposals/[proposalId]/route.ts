import { after } from "next/server";
import { z } from "zod";
import { api, checked, idempotency, ApiError } from "@/lib/api";
import { readJson } from "@/lib/body";
import { proposalTermsSchema } from "@/lib/proposals/schema";
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
        action: z.enum(["draft", "send", "replace", "withdraw"]),
        revision: z.number().int().positive(),
        expectedVersion: z.number().int().positive(),
        terms: proposalTermsSchema.optional(),
      })
      .strict()
      .parse(await readJson(request));
    if (input.action === "draft" && !input.terms)
      throw new ApiError(400, "VALIDATION", "Draft terms are required.");
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
      await client.rpc("owner_proposal_command", {
        p_project: row.project_id,
        p_proposal: id,
        p_revision: input.revision,
        p_expected: input.expectedVersion,
        p_action: input.action,
        p_terms: input.terms ?? {},
        p_key: idempotency(request),
      }),
    );
    if (input.action === "send")
      after(() => runAutomationBatch(row.project_id));
    return result;
  });
}
