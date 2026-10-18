export const dynamic = "force-dynamic";
import { AppShell } from "@/components/dashboard/app-shell";
import { requireOwner } from "@/lib/auth/session";

function organizationName(value: unknown): string {
  if (Array.isArray(value)) return organizationName(value[0]);
  if (
    value &&
    typeof value === "object" &&
    "name" in value &&
    typeof value.name === "string"
  ) {
    return value.name;
  }
  return "";
}

function accountText(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || !(key in metadata)) return "";
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, membership } = await requireOwner();
  return (
    <AppShell
      email={user.email}
      name={accountText(user.user_metadata, "display_name")}
      timezone={accountText(user.user_metadata, "timezone")}
      organization={organizationName(membership.organizations)}
    >
      {children}
    </AppShell>
  );
}
