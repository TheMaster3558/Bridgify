import { api } from "@/lib/api";
import { loadPhotonUsers } from "@/lib/photon/people";
import { requireApiOwner } from "@/lib/settings/owner";

export async function GET(request: Request) {
  return api(request, async (client) => {
    await requireApiOwner(client);
    return loadPhotonUsers();
  });
}
