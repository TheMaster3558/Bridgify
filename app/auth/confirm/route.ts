import { NextResponse } from "next/server";
import { db } from "@/lib/db/server";
import { safeNext } from "@/lib/domain/security";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));
  const client = await db();
  const token = url.searchParams.get("token_hash"),
    code = url.searchParams.get("code");
  const result = token
    ? await client.auth.verifyOtp({ token_hash: token, type: "email" })
    : code
      ? await client.auth.exchangeCodeForSession(code)
      : { error: true };
  return NextResponse.redirect(
    new URL(
      result.error
        ? `/login?error=expired&next=${encodeURIComponent(next)}`
        : next,
      process.env.APP_BASE_URL || url.origin,
    ),
  );
}
