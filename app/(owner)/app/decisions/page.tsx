import { decisionReasonSchema } from "@/lib/assistant/contracts";
import { checked } from "@/lib/api";
import { requireOwner } from "@/lib/auth/session";
import {
  queryList,
  listInput,
  projectOptions,
  optionCounts,
  PAGE_SIZE,
  type SearchParams,
} from "@/lib/dashboard/list-query";
import { ListToolbar } from "@/components/dashboard/list-toolbar";
import { NeedsAttention } from "@/components/dashboard/needs-attention";
import type { OwnerDecisionRecord } from "@/lib/dashboard/work-management-types";
import { loadClientPhotos } from "@/lib/clients/photo-urls";
import { clientKey } from "@/lib/clients/photos";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { client } = await requireOwner();
  const raw = await searchParams;
  const input = listInput({ status: "open", ...raw });
  const reasons = ["all", ...decisionReasonSchema.options];
  const [result, projects, reasonCounts] = await Promise.all([
    queryList(client, "decisions", input),
    projectOptions(client),
    optionCounts(client, "decisions", input, "reason", reasons),
  ]);
  // The project filter lists active projects only, with their open counts.
  const activeProjects = projects.filter((p) =>
    ["active", "review_only"].includes(p.status),
  );
  const [projectCounts, projectPhotos] = await Promise.all([
    activeProjects.length <= 40
      ? optionCounts(
          client,
          "decisions",
          { ...input, reason: "all" },
          "project",
          activeProjects.map((p) => p.id),
        )
      : Promise.resolve({} as Record<string, number>),
    loadClientPhotos(
      client,
      activeProjects.map((p) => p.client_name),
    ),
  ]);
  const statusLabels: Record<string, string> = {
    open: "Open",
    all: "Any status",
    resolved: "Resolved",
    dismissed: "Dismissed",
  };
  const rows = result.items as unknown as OwnerDecisionRecord[];
  const selectedId =
    typeof raw.decision === "string" ? raw.decision : undefined;
  if (selectedId && !rows.some((r) => r.id === selectedId)) {
    const selected = checked(
      await client
        .from("owner_decisions")
        .select("*,projects!inner(name,client_name)")
        .eq("id", selectedId)
        .maybeSingle(),
    );
    if (selected)
      rows.unshift({
        ...selected,
        project_name: selected.projects.name,
        client_name: selected.projects.client_name,
      } as OwnerDecisionRecord);
  }
  return (
    <NeedsAttention
      key={JSON.stringify(input)}
      initialDecisionId={selectedId}
      decisions={rows}
      serverManaged
      toolbar={
        <ListToolbar
          values={input}
          pills={{
            param: "reason",
            label: "Filter decisions",
            // Only reasons that have decisions, plus the one selected.
            options: reasons
              .filter(
                (r) => r === "all" || reasonCounts[r] > 0 || r === input.reason,
              )
              .map((r) => ({
                id: r,
                label:
                  r === "all"
                    ? "All"
                    : r.charAt(0).toUpperCase() +
                      r.slice(1).replaceAll("_", " "),
                count: reasonCounts[r],
              })),
          }}
          search={{ placeholder: "Search decisions" }}
          selects={[
            {
              param: "project",
              label: "Project filter",
              options: [
                { id: "all", label: "All active projects" },
                ...activeProjects.map((p) => ({
                  id: p.id,
                  label: p.name,
                  count: projectCounts[p.id],
                  avatar: {
                    name: p.client_name,
                    src: projectPhotos[clientKey(p.client_name)],
                  },
                })),
              ],
            },
            {
              param: "status",
              label: "Status filter",
              options: Object.entries(statusLabels).map(([id, label]) => ({
                id,
                label,
              })),
            },
          ]}
          page={input.page}
          pageSize={PAGE_SIZE}
          total={result.total}
        />
      }
      clientPhotos={await loadClientPhotos(
        client,
        rows.map((r) => r.client_name),
      )}
    />
  );
}
