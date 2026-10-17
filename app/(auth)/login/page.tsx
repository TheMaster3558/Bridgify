import { LoginScreen } from "@/components/auth/login-screen";
import { safeNext } from "@/lib/domain/security";
export const metadata = { title: "Sign in" };
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; mode?: string }>;
}) {
  const params = await searchParams;
  return (
    <LoginScreen
      next={safeNext(params.next)}
      initialMode={
        params.mode === "recover"
          ? "recover"
          : params.mode === "signup"
            ? "signup"
            : "signin"
      }
      expired={params.error === "expired"}
      configured={
        !!(
          process.env.NEXT_PUBLIC_SUPABASE_URL &&
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        )
      }
    />
  );
}
