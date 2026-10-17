import { readJson } from "@/lib/body";
import { api, checked, idempotency } from "@/lib/api";
import { basicsSchema } from "@/lib/schemas/onboarding";
export async function GET(request: Request) {
  return api(request, async (client) =>
    checked(
      await client
        .from("projects")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(25),
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
