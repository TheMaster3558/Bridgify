import { api } from "@/lib/api";
import { loadIntegrationHealth } from "@/lib/settings/integrations";
import { requireApiOwner } from "@/lib/settings/owner";

export async function GET(request: Request) {
  return api(request, async (client, user) => {
    await requireApiOwner(client);
    return loadIntegrationHealth(client, user.id);
  });
}
