import { adminDb } from "@/lib/db/admin";
import { analyzeAgreementNow } from "@/lib/domain/process-agreement";
import { AgreementAnalysisError } from "@/lib/ai/agreement-errors";
import { z } from "zod";
import { api, checked, idempotency, ApiError } from "@/lib/api";
import { readJson } from "@/lib/body";
import { reviewDraftSchema } from "@/lib/schemas/agreement";
export const runtime = "nodejs";
export const maxDuration = 60;
const command = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("review"),
    expectedVersion: z.number().int().positive(),
    document_id: z.uuid(),
    expectedReviewVersion: z.number().int().nonnegative(),
    review: reviewDraftSchema,
  }),
  z.object({
    action: z.literal("retry"),
    expectedVersion: z.number().int().positive(),
    document_id: z.uuid(),
  }),
  z.object({
    action: z.literal("analyze"),
    expectedVersion: z.number().int().positive(),
    document_id: z.uuid(),
  }),
]);
export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  return api(request, async (client) => {
    const { action, expectedVersion, ...payload } = command.parse(
      await readJson(request),
    );
    const id = z.uuid().parse((await context.params).projectId);
    // User-session RLS authorization happens before any elevated source access.
    const project = checked(
      await client
        .from("projects")
        .select(
          "id,version,status,activation_cutoff,current_agreement_document_id",
        )
        .eq("id", id)
        .maybeSingle(),
    );
    if (!project)
      throw new ApiError(404, "NOT_FOUND", "Project is unavailable.");
    if (project.status !== "draft" || project.activation_cutoff)
      throw new ApiError(
        422,
        "IMMUTABLE",
        "Agreement setup is only available for draft projects.",
      );
    if (action === "analyze" && project.version !== expectedVersion)
      throw new ApiError(
        409,
        "CONFLICT",
        "Project changed. Refresh before retrying.",
      );
    if (project.current_agreement_document_id !== payload.document_id)
      throw new ApiError(409, "CONFLICT", "Use the current agreement.");
    let result;
    if (action !== "analyze")
      result = checked(
        await client.rpc("onboarding_command", {
          p_project: id,
          p_expected: expectedVersion,
          p_section:
            action === "review" ? "agreement_review" : "agreement_retry",
          p_payload: {
            ...payload,
            ...(action === "retry" ? { processing_mode: "interactive" } : {}),
          },
          p_key: idempotency(request),
        }),
      );
    else idempotency(request);
    if (action === "review") return result;
    try {
      return {
        ...result,
        analysis: await analyzeAgreementNow(adminDb(), id, payload.document_id),
      };
    } catch (error) {
      if (error instanceof AgreementAnalysisError)
        throw new ApiError(503, error.code, error.message);
      throw error;
    }
  });
}
