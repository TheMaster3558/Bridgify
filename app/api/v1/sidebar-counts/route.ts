import { api } from "@/lib/api";
import { getSidebarCounts } from "@/lib/dashboard/sidebar-counts";

export async function GET(request: Request) {
  return api(request, (client) => getSidebarCounts(client));
}
