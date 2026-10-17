export function safeNext(value: unknown, fallback = "/app") {
  if (typeof value !== "string" || /[\\\r\n\u0000-\u001f]/.test(value))
    return fallback;
  try {
    const url = new URL(value, "https://bridgify.invalid");
    if (
      url.origin !== "https://bridgify.invalid" ||
      !/^\/(app(?:\/|$)|proposals\/|invitations\/|onboarding(?:\?|$)|access(?:\?|$))/.test(
        url.pathname,
      )
    )
      return fallback;
    return url.pathname + url.search;
  } catch {
    return fallback;
  }
}
export const INTRODUCTION =
  "Bridgify is the project owner's automated assistant. It processes messages in this agreed project group to organize requests against the confirmed agreement. Eligible routine work may be accepted for the owner to do; new scope, prices and dates require explicit approval. Contact the owner to pause processing. No website changes are performed by this assistant.";
export function centsFromInput(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value))
    throw new Error(
      "Enter a non-negative amount with at most two decimal places",
    );
  const [whole, fraction = ""] = value.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(result) || result > 100_000_000)
    throw new Error("Amount is too large");
  return result;
}
export function validateEvidence(
  terms: { span_id: string; quote: string }[],
  spans: { id: string; text: string }[],
) {
  return terms.every(
    (term) =>
      term.quote.length > 0 &&
      spans.some(
        (span) => span.id === term.span_id && span.text.includes(term.quote),
      ),
  );
}
