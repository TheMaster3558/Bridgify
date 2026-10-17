export const dynamic = "force-dynamic";
import { AppShell } from "@/components/dashboard/app-shell";
import { requireOwner } from "@/lib/auth/session";
export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireOwner();
  return <AppShell email={user.email}>{children}</AppShell>;
}
