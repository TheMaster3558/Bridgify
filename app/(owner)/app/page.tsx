import { HomeOverview } from "@/components/dashboard/home-overview";
import { requireOwner } from "@/lib/auth/session";
import { homeOverview } from "@/lib/dashboard/home";

function text(metadata: unknown, key: string) {
  const value =
    metadata && typeof metadata === "object"
      ? (metadata as Record<string, unknown>)[key]
      : undefined;
  return typeof value === "string" ? value : "";
}

function validZone(zone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return zone;
  } catch {
    return undefined;
  }
}

export default async function Page() {
  const { client, user } = await requireOwner();
  const data = await homeOverview(client);
  // Greet in the owner's own timezone from Settings, not the server's.
  const timeZone = validZone(text(user.user_metadata, "timezone"));
  const now = new Date(data.now);
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone,
    }).format(now),
  );
  const part =
    hour < 5
      ? "evening"
      : hour < 12
        ? "morning"
        : hour < 17
          ? "afternoon"
          : "evening";
  const firstName = text(user.user_metadata, "display_name")
    .trim()
    .split(/\s+/)[0];
  return (
    <HomeOverview
      data={data}
      greeting={`Good ${part}${firstName ? `, ${firstName}` : ""}`}
      today={new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        timeZone,
      }).format(now)}
      refreshedAt={new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone,
      }).format(now)}
    />
  );
}
