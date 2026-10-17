import { readJson } from "@/lib/body";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/server";
import { safeNext } from "@/lib/domain/security";
export async function POST(request: Request) {
  try {
    const base = process.env.APP_BASE_URL;
    if (!base) throw new Error("configuration");
    if (request.headers.get("origin") !== new URL(base).origin)
      return NextResponse.json(
        { error: "Refresh and try again." },
        { status: 403 },
      );
    const input = z
      .object({
        email: z.email().max(254),
        next: z.string().max(1000).optional(),
      })
      .parse(await readJson(request));
    const client = await db();
    const redirect = new URL("/auth/confirm", base);
    redirect.searchParams.set("next", safeNext(input.next));
    const { error } = await client.auth.signInWithOtp({
      email: input.email,
      options: { emailRedirectTo: redirect.toString() },
    });
    if (error)
      return NextResponse.json(
        {
          error: "Unable to send a sign-in email. Wait a minute and try again.",
        },
        { status: 429 },
      );
    return NextResponse.json({
      message:
        "Check your email for a sign-in link. You can use this same flow whenever you need to recover access.",
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Email sign-in is unavailable. Check the email address and server configuration.",
      },
      { status: 400 },
    );
  }
}
