import { requireUser } from "@/lib/auth/session";
import { safeNext } from "@/lib/domain/security";
import { ResetPassword } from "@/components/auth/reset-password";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNext((await searchParams).next);
  await requireUser(`/reset-password?next=${encodeURIComponent(next)}`);
  return (
    <main className="mx-auto grid max-w-md gap-5 p-8 py-20">
      <h1 className="text-2xl font-semibold">Choose a new password</h1>
      <p className="text-sm text-muted-foreground">
        Use 8–72 characters. Your workspace destination will be
        preserved.
      </p>
      <ResetPassword next={next} />
    </main>
  );
}
