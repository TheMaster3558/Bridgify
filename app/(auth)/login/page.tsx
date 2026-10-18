import { Inter } from "next/font/google";
import { LoginScreen } from "@/components/auth/login-screen";
import { safeNext } from "@/lib/domain/security";
import "./boardui.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata = { title: "Sign in" };
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; mode?: string }>;
}) {
  const params = await searchParams;
  const mode =
    params.mode === "recover"
      ? "recover"
      : params.mode === "signup"
        ? "signup"
        : "signin";
  return (
    <div className={`${inter.variable} boardui-auth`}>
      <LoginScreen
        key={mode}
        next={safeNext(params.next)}
        initialMode={mode}
        expired={params.error === "expired"}
        configured={
          !!(
            process.env.NEXT_PUBLIC_SUPABASE_URL &&
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
          )
        }
      />
    </div>
  );
}
