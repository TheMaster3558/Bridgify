import { PageBody, Panel } from "@/components/dashboard/panel";
import { activity } from "@/lib/sample";

export const metadata = { title: "Activity" };

const filters = ["All", "Request", "Acceptance", "Proposal", "Policy", "Integration"];

export default function ActivityPage() {
  return (
    <PageBody>
      <div className="flex flex-wrap gap-2">
        {filters.map((filter, index) => (
          <span
            key={filter}
            className={`rounded-full border px-3 py-1 text-sm ${index === 0 ? "border-foreground bg-foreground text-background" : "text-muted-foreground"}`}
          >
            {filter}
          </span>
        ))}
      </div>
      <Panel bodyClassName="p-0">
        <ol>
          {activity.map((item) => (
            <li key={item.time + item.text} className="grid grid-cols-[92px_16px_minmax(0,1fr)] gap-3 border-b px-4 py-3 last:border-b-0">
              <time className="text-right text-xs text-muted-foreground">{item.time}</time>
              <span className="mt-1 size-3 rounded-full border-2 border-primary" />
              <div className="text-sm">
                <p>{item.text}</p>
                <p className="text-xs text-muted-foreground">
                  {item.actor} · {item.kind}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Panel>
    </PageBody>
  );
}
