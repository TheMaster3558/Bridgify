import { NextResponse } from "next/server";
// Old clients must not silently continue using passwordless sign-in.
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Email-link sign-in has been replaced by email and password. Refresh the sign-in page.",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
