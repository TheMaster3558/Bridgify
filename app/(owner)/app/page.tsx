import { HomeOverview } from "@/components/dashboard/home-overview";
import { requireOwner } from "@/lib/auth/session";
import { loadClientPhotos } from "@/lib/clients/photo-urls";
import { homeOverview } from "@/lib/dashboard/home";

function text(metadata: unknown, key: string) {
  const value =
    metadata && typeof metadata === "object"
      ? (metadata as Record<string, unknown>)[key]
      : undefined;
  return typeof value === "string" ? value : "";
}

function validZone(zone: string) {
  if (!zone) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return zone;
  } catch {
    return undefined;
  }
}

function organizationName(value: unknown): string {
  const org = Array.isArray(value) ? value[0] : value;
  return org && typeof org === "object" && "name" in org
    ? String(org.name)
    : "";
}

export default async function Page() {
  const { client, user, membership } = await requireOwner();
  // Charts and dates follow the owner's own timezone from Settings.
  const timeZone = validZone(text(user.user_metadata, "timezone"));
  const data = await homeOverview(client, new Date(), timeZone);
  const clientPhotos = await loadClientPhotos(client, [
    ...data.decisions.items.map((d) => d.project.client_name),
    ...data.handled.map((h) => h.project.client_name),
    ...data.work.map((w) => w.project.client_name),
  ]);
  const firstName = text(user.user_metadata, "display_name")
    .trim()
    .split(/\s+/)[0];
  return (
    <HomeOverview
      data={data}
      clientPhotos={clientPhotos}
      organization={organizationName(membership.organizations)}
      greeting={firstName ? `Welcome ${firstName}` : "Welcome back"}
      refreshedAt={new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone,
      }).format(new Date(data.now))}
    />
  );
}
