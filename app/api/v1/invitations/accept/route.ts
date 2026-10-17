import { readJson } from "@/lib/body";
import { z } from "zod";
import { api, checked } from "@/lib/api";
export async function POST(request: Request) {
  return api(request, async (client) => ({
    next: checked(
      await client.rpc("accept_invitation", {
        p_token: z
          .object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
          .parse(await readJson(request)).token,
      }),
    ),
  }));
}
