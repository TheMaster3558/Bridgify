export const dynamic = "force-dynamic";
import { AppShell } from "@/components/dashboard/app-shell";
import { requireOwner } from "@/lib/auth/session";
import { getSidebarCounts } from "@/lib/dashboard/sidebar-counts";

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
  if (!metadata || typeof metadata !== "object" || !(key in metadata))
    return "";
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { client, user, membership } = await requireOwner();
  // Badges are a convenience; never block the app shell on them.
  const counts = await getSidebarCounts(client).catch(() => null);
  return (
    <AppShell
      counts={counts}
      email={user.email}
      name={accountText(user.user_metadata, "display_name")}
      timezone={accountText(user.user_metadata, "timezone")}
      organization={organizationName(membership.organizations)}
    >
      {children}
    </AppShell>
  );
}
