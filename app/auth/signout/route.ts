import { NextResponse } from "next/server";
import { db } from "@/lib/db/server";
export async function POST(request: Request) {
  const base = process.env.APP_BASE_URL || new URL(request.url).origin;
  if (request.headers.get("origin") !== new URL(base).origin)
    return new Response("Forbidden", { status: 403 });
  const client = await db();
  const { error } = await client.auth.signOut();
  if (error)
    return new Response("Sign-out failed. Please retry.", { status: 503 });
  return NextResponse.redirect(new URL("/login", base), 303);
}
