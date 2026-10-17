import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { readJson, BodyLimitError } from "@/lib/body";
import { db } from "@/lib/db/server";
import { safeNext } from "@/lib/domain/security";
import { passwordAuthSchema } from "@/lib/schemas/auth";
function failure(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  try {
    const base = process.env.APP_BASE_URL;
    if (!base)
      return failure("Authentication needs APP_BASE_URL configuration.", 503);
    if (request.headers.get("origin") !== new URL(base).origin)
      return failure("Refresh the page and try again.", 403);
    const input = passwordAuthSchema.parse(await readJson(request));
    const client = await db();
    if (input.action === "recover") {
      const callback = new URL("/auth/confirm", base);
      callback.searchParams.set("next", safeNext(input.next));
      callback.searchParams.set("flow", "recovery");
      const { error } = await client.auth.resetPasswordForEmail(input.email, {
        redirectTo: callback.toString(),
      });
      if (error)
        return failure(
          "Unable to request a password reset. Wait a minute and try again.",
          error.status === 429 ? 429 : 503,
        );
      return NextResponse.json(
        {
          message:
            "If an account exists for this email, password reset instructions have been sent.",
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (input.action === "update_password") {
      const {
        data: { user },
        error: sessionError,
      } = await client.auth.getUser();
      if (sessionError || !user)
        return failure(
          "Your password reset session expired. Request another reset link.",
          401,
        );
      const { error } = await client.auth.updateUser({
        password: input.password,
      });
      if (error)
        return failure(
          "Unable to update your password. Use a different password or request another reset link.",
          error.status === 429 ? 429 : 400,
        );
    } else if (input.action === "signup") {
      const { data, error } = await client.auth.signUp({
        email: input.email,
        password: input.password,
      });
      if (error)
        return failure(
          "Unable to create your account. Try signing in or resetting your password.",
          error.status === 429 ? 429 : 400,
        );
      if (!data.session)
        return failure(
          "Email confirmation is still enabled in Supabase. Turn off Confirm email in the Email provider settings, then sign in or reset your password.",
          503,
        );
    } else {
      const { data, error } = await client.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });
      if (error || !data.session)
        return failure(
          "Unable to sign in. Check your email and password.",
          error?.status === 429 ? 429 : 401,
        );
    }
    return NextResponse.json(
      { next: safeNext(input.next) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof ZodError)
      return failure(error.issues.map((issue) => issue.message).join(" "), 400);
    if (error instanceof SyntaxError || error instanceof BodyLimitError)
      return failure("Invalid or oversized authentication request.", 400);
    return failure(
      "Authentication is unavailable. Check server configuration and retry.",
      503,
    );
  }
}
