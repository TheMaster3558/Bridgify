import { z } from "zod";
import { api, checked } from "@/lib/api";
export async function GET(
  request: Request,
  context: { params: Promise<{ proposalId: string }> },
) {
  return api(request, async (client) =>
    checked(
      await client.rpc("shared_proposal", {
        p_proposal: z.uuid().parse((await context.params).proposalId),
        p_revision: z.coerce
          .number()
          .int()
          .positive()
          .parse(new URL(request.url).searchParams.get("revision")),
      }),
    ),
  );
}
