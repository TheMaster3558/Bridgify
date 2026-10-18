import { queryList, listInput } from "@/lib/dashboard/list-query";
import { readJson } from "@/lib/body";
import { api, checked, idempotency } from "@/lib/api";
import { basicsSchema } from "@/lib/schemas/onboarding";
export async function GET(request: Request) {
  return api(request, async (client) =>
    queryList(
      client,
      "projects",
      listInput(Object.fromEntries(new URL(request.url).searchParams)),
    ),
  );
}
export async function POST(request: Request) {
  return api(request, async (client) =>
    checked(
      await client.rpc("onboarding_command", {
        p_project: null,
        p_expected: null,
        p_section: "basics",
        p_payload: basicsSchema.parse(await readJson(request)),
        p_key: idempotency(request),
      }),
    ),
  );
}
