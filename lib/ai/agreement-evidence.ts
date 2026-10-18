import type { Span } from "../schemas/onboarding";
import type { AgreementExtraction } from "../schemas/agreement";
import { validateEvidence } from "../domain/security";
import { AgreementAnalysisError } from "./agreement-errors";

/** Restore exact source excerpts without accepting paraphrases or changed words. */
export function repairAgreementEvidence(
  extraction: AgreementExtraction,
  spans: Span[],
) {
  const citations = [
    ...extraction.terms,
    ...Object.values(extraction.commercial).filter(
      (field) => field.span_id || field.quote,
    ),
  ];
  for (const citation of citations) {
    if (!citation.quote?.trim()) continue;
    const pattern = citation.quote
      .trim()
      .split(/\s+/u)
      .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("\\s+");
    const find = (span: Span) => {
      const quote = span.text.includes(citation.quote!)
        ? citation.quote!
        : span.text.match(new RegExp(pattern, "u"))?.[0];
      return quote && quote.length <= 4000 ? { span_id: span.id, quote } : null;
    };
    const cited = spans.find((span) => span.id === citation.span_id);
    const direct = cited && find(cited);
    if (direct) {
      Object.assign(citation, direct);
      continue;
    }
    // A wrong page ID can be repaired only when the excerpt identifies one page.
    const matches = spans.map(find).filter((match) => match !== null);
    if (matches.length === 1) Object.assign(citation, matches[0]);
  }
  const evidence = citations.filter(
    (field): field is typeof field & { span_id: string; quote: string } =>
      !!field.span_id && !!field.quote?.trim(),
  );
  if (
    evidence.length !== citations.length ||
    !validateEvidence(evidence, spans)
  )
    throw new AgreementAnalysisError(
      "GEMINI_INVALID_EVIDENCE",
      "Extraction cited invalid source evidence. Retry; no baseline was confirmed.",
    );
  for (const field of Object.values(extraction.commercial)) {
    const present =
      ("amount_cents" in field && field.amount_cents !== null) ||
      ("currency" in field && field.currency !== null) ||
      ("value" in field && field.value !== null) ||
      ("unit" in field && field.unit !== "not_specified");
    if (present && (!field.span_id || !field.quote?.trim()))
      throw new AgreementAnalysisError(
        "GEMINI_INVALID_EVIDENCE",
        "Extraction is missing commercial source evidence. Retry; no baseline was confirmed.",
      );
  }
  return extraction;
}
