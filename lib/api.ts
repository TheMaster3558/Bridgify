import { BodyLimitError } from "@/lib/body";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/lib/db/server";
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function api(
  request: Request,
  run: (
    client: Awaited<ReturnType<typeof db>>,
    user: { id: string; email?: string },
  ) => Promise<unknown>,
) {
  const requestId = crypto.randomUUID();
  try {
    if (
      request.method !== "GET" &&
      request.headers.get("origin") !==
        new URL(process.env.APP_BASE_URL || request.url).origin
    )
      throw new ApiError(403, "ORIGIN", "Refresh the page and try again.");
    const client = await db();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) throw new ApiError(401, "AUTH_REQUIRED", "Sign in to continue.");
    const data = await run(client, user);
    return NextResponse.json(
      { data, requestId },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const validation = error instanceof ZodError;
    const status =
      error instanceof ApiError
        ? error.status
        : validation ||
            error instanceof SyntaxError ||
            error instanceof BodyLimitError
          ? 400
          : 503;
    return NextResponse.json(
      {
        error: {
          code:
            error instanceof ApiError
              ? error.code
              : validation
                ? "VALIDATION"
                : "UNAVAILABLE",
          message:
            error instanceof ApiError
              ? error.message
              : validation
                ? error.issues
                    .map((i) => `${i.path.join(".")}: ${i.message}`)
                    .join("; ")
                : "Unable to complete this operation. Check configuration and retry.",
          ...(validation ? { fieldErrors: error.flatten() } : {}),
        },
        requestId,
      },
      { status },
    );
  }
}
export function checked<T>(result: {
  data: T;
  error: { code?: string; message: string } | null;
}): T {
  if (result.error) {
    const code = result.error.code;
    if (code === "42501")
      throw new ApiError(
        404,
        "NOT_FOUND",
        "This record is unavailable to your account.",
      );
    if (code === "40001" || code === "23505")
      throw new ApiError(
        409,
        "CONFLICT",
        "This record changed. Refresh before retrying.",
      );
    if (code === "P0001" || code === "23514" || code === "22023")
      throw new ApiError(422, "SETUP_REQUIRED", result.error.message);
    // Missing tables/columns usually mean the Supabase migrations have not
    // been applied (or the PostgREST schema cache has not refreshed).
    if (code === "42P01" || code === "42703" || code === "PGRST204" || code === "PGRST205")
      throw new ApiError(
        503,
        "SETUP_REQUIRED",
        "The database schema is out of date. Apply the Supabase migrations and retry.",
      );
    throw new ApiError(
      503,
      "DATABASE",
      "Database operation failed. Check setup and retry.",
    );
  }
  return result.data;
}
export function idempotency(request: Request) {
  const key = request.headers.get("Idempotency-Key");
  if (!key || !/^[a-zA-Z0-9_-]{16,100}$/.test(key))
    throw new ApiError(
      400,
      "IDEMPOTENCY",
      "A valid Idempotency-Key is required.",
    );
  return key;
}

// Keep action endpoints and the resumable wizard on the same guarded transaction.
export async function projectCommand(
  request: Request,
  projectId: string,
  section: string,
  expectedVersion: number,
  payload: unknown,
  client: Awaited<ReturnType<typeof db>>,
) {
  return checked(
    await client.rpc("onboarding_command", {
      p_project: projectId,
      p_expected: expectedVersion,
      p_section: section,
      p_payload: payload,
      p_key: idempotency(request),
    }),
  );
}
