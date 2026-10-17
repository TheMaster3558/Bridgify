import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function publicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new Error(
      "Supabase is not configured. Follow docs/ONBOARDING_SETUP.md.",
    );
  return { url, key };
}
export async function db() {
  const jar = await cookies();
  const { url, key } = publicConfig();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (items) => {
        try {
          items.forEach(({ name, value, options }) =>
            jar.set(name, value, options),
          );
        } catch {
          /* Proxy refreshes cookies for Server Components. */
        }
      },
    },
  });
}
