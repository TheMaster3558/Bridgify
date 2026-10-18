import type { adminDb } from "../db/admin";
import { extractAgreement } from "../ai/extract-agreement";
import { AgreementAnalysisError } from "../ai/agreement-errors";
import { textSpans, pdfSpans, UnsupportedAgreement } from "./agreement";
type Client = ReturnType<typeof adminDb>;

// Call only after user-scoped authorization. Every source lookup is scoped to the project.
export async function analyzeAgreementNow(
  client: Client,
  projectId: string,
  documentId: string,
) {
  const { data: job, error: claimError } = await client.rpc(
    "claim_agreement_job",
    { p_project: projectId, p_document: documentId },
  );
  if (claimError)
    throw new AgreementAnalysisError(
      "ANALYSIS_SETUP",
      claimError.code === "PGRST202"
        ? "Apply migration 202610170004_immediate_agreement_analysis.sql to enable immediate analysis."
        : "Unable to start agreement analysis. Check database configuration.",
    );
  if (!job) return { status: "unchanged" as const };
  const heartbeat = setInterval(() => {
    void client
      .from("jobs")
      .update({ lease_until: new Date(Date.now() + 90000).toISOString() })
      .eq("id", job.id)
      .eq("lease_token", job.lease_token)
      .eq("status", "processing")
      .then(({ error }) => {
        if (error) console.error("Agreement lease renewal failed", job.id);
      });
  }, 20000);
  let spans: Awaited<ReturnType<typeof textSpans>> = [];
  let extraction: Awaited<ReturnType<typeof extractAgreement>> | null = null;
  let failure: AgreementAnalysisError | UnsupportedAgreement | null = null;
  try {
    if(job.attempts>3) throw new AgreementAnalysisError("AGREEMENT_INTERRUPTED","Agreement processing was interrupted repeatedly. Retry the saved agreement after checking server health.");
    const { data: doc, error } = await client
      .from("documents")
      .select("kind,original_text,storage_path")
      .eq("id", documentId)
      .eq("project_id", projectId)
      .single();
    if (error || !doc)
      throw new AgreementAnalysisError(
        "AGREEMENT_SOURCE",
        "The saved agreement could not be read. Check project storage and retry.",
      );
    if (doc.kind === "pdf") {
      const { data: file, error } = await client.storage
        .from("agreements")
        .download(doc.storage_path);
      if (error || !file)
        throw new AgreementAnalysisError(
          "AGREEMENT_STORAGE",
          "The private PDF could not be read. Check storage configuration and retry.",
        );
      spans = await pdfSpans(new Uint8Array(await file.arrayBuffer()));
    } else spans = textSpans([doc.original_text]);
    extraction = await extractAgreement(spans);
  } catch (error) {
    failure =
      error instanceof AgreementAnalysisError ||
      error instanceof UnsupportedAgreement
        ? error
        : new AgreementAnalysisError(
            "AGREEMENT_ANALYSIS",
            "Agreement analysis failed. Retry with a text PDF or pasted agreement. No baseline was confirmed.",
          );
  }
  try {
    const { data: committed, error } = await client.rpc(
      "finish_agreement_attempt",
      {
        p_job: job.id,
        p_lease: job.lease_token,
        p_spans: failure ? [] : spans,
        p_extraction: failure ? null : extraction,
        p_error: failure?.message || null,
        p_unsupported: failure instanceof UnsupportedAgreement,
      },
    );
    if (error)
      throw new AgreementAnalysisError(
        "AGREEMENT_SAVE",
        "The analysis result could not be saved. Refresh to check the saved agreement before retrying.",
      );
    if (!committed) return { status: "superseded" as const };
    if (failure) return { status: "failed" as const, error: failure.message };
    return { status: "ready" as const };
  } finally {
    clearInterval(heartbeat);
  }
}
