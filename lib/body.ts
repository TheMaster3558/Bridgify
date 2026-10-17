// Bound streams as they are read; Content-Length alone is not trustworthy.
export class BodyLimitError extends Error {}
export async function readBody(request: Request, limit: number) {
  if (Number(request.headers.get("content-length")) > limit)
    throw new BodyLimitError("Request is too large.");
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new BodyLimitError("Request is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
export async function readJson(request: Request) {
  return JSON.parse(new TextDecoder().decode(await readBody(request, 300_000)));
}
export async function readAgreementForm(request: Request) {
  const bytes = await readBody(request, 5_242_880 + 8192);
  return new Response(bytes, {
    headers: { "Content-Type": request.headers.get("content-type") || "" },
  }).formData();
}
