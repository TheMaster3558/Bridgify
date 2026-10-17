import { readJson } from "@/lib/body";
import { z } from "zod";
import { api, checked } from "@/lib/api";
export async function POST(request: Request) {
  return api(request, async (client) =>
    checked(
      await client.rpc("create_workspace", {
        p_name: z
          .object({ name: z.string().trim().min(1).max(120) })
          .parse(await readJson(request)).name,
      }),
    ),
  );
}
