import { NextResponse } from "next/server";
import { db } from "@/lib/db/server";
import { safeNext } from "@/lib/domain/security";
export async function GET(request: Request) {
  const url = new URL(request.url),
    next = safeNext(url.searchParams.get("next"));
  const base = process.env.APP_BASE_URL || url.origin;
  const failed = new URL(
    `/login?mode=recover&error=expired&next=${encodeURIComponent(next)}`,
    base,
  );
  const token = url.searchParams.get("token_hash"),
    code = url.searchParams.get("code");
  if (url.searchParams.get("flow") !== "recovery")
    return NextResponse.redirect(failed);
  const client = await db();
  const result =
    token && url.searchParams.get("type") === "recovery"
      ? await client.auth.verifyOtp({ token_hash: token, type: "recovery" })
      : code
        ? await client.auth.exchangeCodeForSession(code)
        : { error: true };
  return NextResponse.redirect(
    result.error
      ? failed
      : new URL(`/reset-password?next=${encodeURIComponent(next)}`, base),
  );
}
