// Only fixed messages cross the API boundary. SDK errors may contain private source text.
export class AgreementAnalysisError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function providerFailure(error: unknown): AgreementAnalysisError {
  const value = error as { status?: number; name?: string } | null;
  if (value?.status === 429)
    return new AgreementAnalysisError(
      "GEMINI_QUOTA",
      "Gemini's request limit has been reached. Wait for quota to reset or enable billing for your Gemini project, then retry. Your agreement is saved.",
    );
  if (value?.status === 401 || value?.status === 403)
    return new AgreementAnalysisError(
      "GEMINI_AUTH",
      "Gemini rejected the API key or its permissions. Check the server-side Gemini configuration.",
    );
  if (value?.status === 404)
    return new AgreementAnalysisError(
      "GEMINI_MODEL",
      "The configured Gemini model is unavailable to this account. Check GEMINI_MODEL.",
    );
  if (
    (value?.name && /timeout|abort/i.test(value.name)) ||
    value?.status === 408 ||
    value?.status === 504
  )
    return new AgreementAnalysisError(
      "GEMINI_TIMEOUT",
      "Gemini did not finish in time. Your agreement is saved; retry analysis.",
    );
  if (value?.status && value.status >= 500)
    return new AgreementAnalysisError(
      "GEMINI_UNAVAILABLE",
      "Gemini is temporarily unavailable or experiencing high demand. Your agreement is saved; retry analysis shortly.",
    );
  return new AgreementAnalysisError(
    "GEMINI_REQUEST",
    "Gemini could not analyze the agreement. Check the model configuration and retry. No baseline was confirmed.",
  );
}
export function retryableProviderFailure(error: unknown) {
  const code = providerFailure(error).code;
  return ["GEMINI_QUOTA", "GEMINI_TIMEOUT", "GEMINI_UNAVAILABLE"].includes(
    code,
  );
}
