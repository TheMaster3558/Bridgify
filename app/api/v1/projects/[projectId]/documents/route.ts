import { readAgreementForm } from "@/lib/body";
import { z } from "zod";
import { api, checked, idempotency, ApiError } from "@/lib/api";
import { analyzeAgreementNow } from "@/lib/domain/process-agreement";
import { AgreementAnalysisError } from "@/lib/ai/agreement-errors";
import { adminDb } from "@/lib/db/admin";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  return api(request, async (client) => {
    const id = z.uuid().parse((await context.params).projectId);
    const key = idempotency(request);
    const project = checked(
      await client
        .from("projects")
        .select("id,status,activation_cutoff")
        .eq("id", id)
        .maybeSingle(),
    );
    if (!project)
      throw new ApiError(404, "NOT_FOUND", "Project is unavailable.");
    if (project.status !== "draft" || project.activation_cutoff)
      throw new ApiError(
        422,
        "IMMUTABLE",
        "Use an amendment for changes to an activated agreement.",
      );
    if (Number(request.headers.get("content-length")) > 5_242_880 + 8192)
      throw new ApiError(400, "TOO_LARGE", "PDF limit is 5 MB.");
    const form = await readAgreementForm(request);
    const expected = z.coerce
      .number()
      .int()
      .positive()
      .parse(form.get("expectedVersion"));
    const file = form.get("file");
    let payload: { kind: string; text?: string; storage_path?: string };
    if (file instanceof File && file.size) {
      if (file.size > 5_242_880)
        throw new ApiError(400, "TOO_LARGE", "PDF limit is 5 MB.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (
        file.type !== "application/pdf" ||
        new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-"
      )
        throw new ApiError(
          400,
          "UNSUPPORTED",
          "Upload a text PDF or paste agreement text.",
        );
      const path = `${id}/${key}.pdf`;
      const { error } = await adminDb()
        .storage.from("agreements")
        .upload(path, bytes, { contentType: "application/pdf", upsert: false });
      if (
        error &&
        !String(error.message).toLowerCase().includes("already exists")
      )
        throw new ApiError(
          503,
          "STORAGE",
          "Private upload failed. Retry using the same submission.",
        );
      payload = { kind: "pdf", storage_path: path };
    } else
      payload = {
        kind: "text",
        text: z
          .string()
          .trim()
          .min(1)
          .max(
            30000,
            "Agreement limit is 30,000 characters; no text will be truncated.",
          )
          .parse(form.get("text")),
      };
    const result = checked(
      await client.rpc("onboarding_command", {
        p_project: id,
        p_expected: expected,
        p_section: "document",
        p_payload: { ...payload, processing_mode: "interactive" },
        p_key: key,
      }),
    );
    try {
      return {
        ...result,
        analysis: await analyzeAgreementNow(adminDb(), id, result.documentId),
      };
    } catch (error) {
      if (error instanceof AgreementAnalysisError)
        throw new ApiError(503, error.code, error.message);
      throw error;
    }
  });
}
