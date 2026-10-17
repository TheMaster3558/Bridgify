import type { Span } from "../schemas/onboarding";
export class UnsupportedAgreement extends Error {}
export function textSpans(pages: string[]): Span[] {
  const total = pages.reduce((sum, page) => sum + page.length, 0);
  if (total > 30000)
    throw new UnsupportedAgreement(
      "Agreement exceeds 30,000 characters. Nothing was truncated.",
    );
  if (!total || pages.some((page) => page.trim().length === 0))
    throw new UnsupportedAgreement(
      "This PDF contains a scanned or empty page. Paste the complete agreement text instead; OCR is unsupported.",
    );
  return pages.map((text, index) => ({
    id: crypto.randomUUID(),
    page: index + 1,
    start_offset: 0,
    end_offset: text.length,
    text,
  }));
}
export async function pdfSpans(bytes: Uint8Array): Promise<Span[]> {
  if (bytes.byteLength > 5242880)
    throw new UnsupportedAgreement("PDF exceeds 5 MB.");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({
    data: bytes,
    useSystemFonts: false,
    disableFontFace: true,
  });
  const pdf = await task.promise;
  try {
    if (pdf.numPages > 50)
      throw new UnsupportedAgreement(
        "PDF exceeds 50 pages. Paste complete text within 30,000 characters.",
      );
    const pages: string[] = [];
    for (let page = 1; page <= pdf.numPages; page++) {
      const content = await (await pdf.getPage(page)).getTextContent();
      pages.push(
        content.items
          .map((item) =>
            "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "",
          )
          .join(""),
      );
    }
    if (pages.some((page) => page.trim().length < 10))
      throw new UnsupportedAgreement(
        "A PDF page contains insufficient text and may be scanned. Paste the complete agreement text instead.",
      );
    return textSpans(pages);
  } finally {
    await task.destroy();
  }
}
