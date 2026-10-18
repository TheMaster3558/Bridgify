import { adminDb } from "../lib/db/admin";
import { extractAgreement } from "../lib/ai/extract-agreement";
import { AgreementAnalysisError } from "../lib/ai/agreement-errors";
import {
  pdfSpans,
  textSpans,
  UnsupportedAgreement,
} from "../lib/domain/agreement";
import { setTimeout as sleep } from "node:timers/promises";
const client = adminDb();
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
async function once() {
  const { data: job, error } = await client.rpc("claim_document_job");
  if (error)
    throw new Error("Cannot claim document job. Check database configuration.");
  if (!job) return false;
  // Renew only this lease; expired workers cannot commit over newer attempts.
  const heartbeat = setInterval(() => {
    void client
      .from("jobs")
      .update({ lease_until: new Date(Date.now() + 60000).toISOString() })
      .eq("id", job.id)
      .eq("lease_token", job.lease_token)
      .eq("status", "processing")
      .then(({ error }) => {
        if (error) console.error("Lease renewal failed", job.id);
      });
  }, 20000);
  try {
    if (job.attempts > 3)
      throw new UnsupportedAgreement(
        "Processing lease expired repeatedly. Upload the agreement again after checking the worker.",
      );
    const { data: doc, error } = await client
      .from("documents")
      .select("*")
      .eq("id", job.document_id)
      .single();
    if (error || !doc) throw new Error("Agreement record unavailable.");
    let spans;
    if (doc.kind === "pdf") {
      const { data, error } = await client.storage
        .from("agreements")
        .download(doc.storage_path);
      if (error || !data)
        throw new Error("Unable to read private agreement PDF.");
      spans = await pdfSpans(new Uint8Array(await data.arrayBuffer()));
    } else spans = textSpans([doc.original_text]);
    const extraction = await extractAgreement(spans);
    const { error: finishError } = await client.rpc("finish_document_job", {
      p_job: job.id,
      p_lease: job.lease_token,
      p_spans: spans,
      p_extraction: extraction,
      p_error: null,
    });
    if (finishError) console.error("Document commit failed", job.id);
  } catch (error) {
    // Provider errors can contain source content: never log them or expose raw responses.
    const unsupported = error instanceof UnsupportedAgreement;
    const safeMessage = unsupported
      ? error.message
      : error instanceof AgreementAnalysisError
        ? error.message
        : "Agreement extraction failed. Check worker/Gemini configuration and retry. No scope has been confirmed.";
    await client.rpc("finish_document_job", {
      p_job: job.id,
      p_lease: job.lease_token,
      p_spans: [],
      p_extraction: null,
      p_error: safeMessage,
      p_unsupported: unsupported,
    });
  } finally {
    clearInterval(heartbeat);
  }
  return true;
}
if (process.env.WORKER_ENABLED !== "true")
  throw new Error("Set WORKER_ENABLED=true to run the document worker.");
for (const key of ["GEMINI_API_KEY", "GEMINI_MODEL"])
  if (!process.env[key])
    throw new Error(`${key} is required by the document worker.`);
async function main() {
  while (!stopping) {
    try {
      if (!(await once())) await sleep(2000);
    } catch {
      console.error("Worker dependency unavailable; retrying.");
      await sleep(5000);
    }
  }
}
void main().catch(() => {
  console.error(
    "Document worker stopped unexpectedly. Check worker configuration.",
  );
  process.exitCode = 1;
});
