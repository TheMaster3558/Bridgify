import { timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { runAutomationBatch } from "@/lib/assistant/run-batch";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  const secret = process.env.AUTOMATION_RUNNER_SECRET;
  const supplied = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (
    !secret ||
    secret.length < 32 ||
    Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  after(() => runAutomationBatch());
  return Response.json(
    { accepted: true },
    {
      status: 202,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
export async function GET(request: Request) {
  const secret = process.env.AUTOMATION_RUNNER_SECRET;
  const supplied = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (
    !secret ||
    secret.length < 32 ||
    Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(
    { version: "webhook-automation-v1", mode: "webhook" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
