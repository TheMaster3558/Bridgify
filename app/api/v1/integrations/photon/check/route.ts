import { api } from "@/lib/api";
import { loadIntegrationHealth } from "@/lib/settings/integrations";
import { requireApiOwner } from "@/lib/settings/owner";

export async function POST(request: Request) {
  return api(request, async (client, user) => {
    await requireApiOwner(client);
    return loadIntegrationHealth(client, user.id, { refresh: true });
  });
}
