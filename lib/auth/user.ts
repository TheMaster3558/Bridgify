import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { IntakeError } from "../assistant/intake-error";

export async function authenticatedUserId(request?: Request): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new IntakeError("authentication_not_configured", 503);
  const authorization = request?.headers.get("authorization");
  if (authorization) {
    if (!authorization.startsWith("Bearer ") || !authorization.slice(7)) return null;
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.auth.getUser(authorization.slice(7));
    return error ? null : data.user?.id ?? null;
  }
  const store = await cookies();
  const client = createServerClient(url, key, { cookies: {
    getAll: () => store.getAll(),
    setAll: values => {
      // Server Components cannot write cookies; a route handler can. Auth is
      // verified with getUser, never by trusting a decoded getSession response.
      try { for (const { name, value, options } of values) store.set(name, value, options); }
      catch { /* Session refresh persistence belongs to the auth setup/proxy. */ }
    },
  } });
  const { data, error } = await client.auth.getUser();
  return error ? null : data.user?.id ?? null;
}
