import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    if (request.nextUrl.pathname.startsWith("/app")) {
      const destination = request.nextUrl.clone();
      destination.pathname = "/login";
      destination.search = "";
      destination.searchParams.set(
        "next",
        request.nextUrl.pathname + request.nextUrl.search,
      );
      return NextResponse.redirect(destination);
    }
    return NextResponse.next();
  }
  let response = NextResponse.next({ request });
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user && request.nextUrl.pathname.startsWith("/app")) {
    const destination = request.nextUrl.clone();
    destination.pathname = "/login";
    destination.search = "";
    destination.searchParams.set(
      "next",
      request.nextUrl.pathname + request.nextUrl.search,
    );
    const redirected = NextResponse.redirect(destination);
    response.cookies
      .getAll()
      .forEach((cookie) => redirected.cookies.set(cookie));
    return redirected;
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: [
    "/app/:path*",
    "/proposals/:path*",
    "/invitations/:path*",
    "/onboarding",
    "/reset-password",
    "/api/auth/:path*",
    "/api/v1/:path*",
    "/auth/:path*",
  ],
};
