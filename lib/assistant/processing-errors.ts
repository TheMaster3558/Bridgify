import { ZodError } from "zod";

/** Only allowlisted diagnostics reach the dashboard; never provider bodies. */
export function processingErrorCode(error: unknown): string {
  if (error instanceof ZodError) return "invalid_project_context";
  const e = error as {
    status?: number;
    code?: string;
    message?: string;
    cause?: { message?: string };
  } | null;
  if (e?.status === 401 || e?.status === 403)
    return "gemini_authentication_failed";
  if (e?.status === 429) return "gemini_rate_limited";
  if (e?.status === 404) return "gemini_model_unavailable";
  if (e?.status === 400) return "gemini_invalid_request";
  if (e?.status && e.status >= 500) return "gemini_unavailable";
  if (
    e?.message === "interpretation_requires_owner_review" ||
    e?.message === "invalid_interpretation_evidence"
  )
    return "interpretation_invalid";
  if (
    [
      "stale_snapshot",
      "latest_source_required",
      "interpretation_context_too_large",
      "confirmed_scope_unavailable",
      "project_unavailable",
      "empty_interpretation",
    ].includes(e?.message ?? "")
  )
    return e!.message!;
  if (e?.code && /^[0-9A-Z]{5}$/.test(e.code))
    return "database_operation_failed";
  return "processing_failed";
}

const labels: Record<string, string> = {
  interpretation_invalid: "The AI result did not pass request validation.",
  gemini_authentication_failed:
    "Gemini access was rejected. Check the API key and model permissions.",
  gemini_rate_limited: "Gemini quota or rate limit was reached.",
  gemini_model_unavailable: "The configured Gemini model is unavailable.",
  gemini_invalid_request: "Gemini rejected the interpretation request.",
  gemini_unavailable: "Gemini is temporarily unavailable.",
  invalid_project_context: "The saved project context could not be read.",
  database_operation_failed: "The workflow records could not be saved.",
  stale_snapshot: "The project changed during analysis.",
  latest_source_required:
    "The AI result did not reference the current message.",
  interpretation_context_too_large:
    "The conversation exceeds the interpretation limit.",
  empty_interpretation: "The AI returned no request classification.",
};
export function processingErrorLabel(code: string | null) {
  return code ? (labels[code] ?? "Automatic processing could not finish.") : "";
}
