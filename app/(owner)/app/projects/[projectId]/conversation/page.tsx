import Link from "next/link";
import { PageBody, Panel } from "@/components/dashboard/panel";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Button } from "@/components/ui/button";
import { messages } from "@/lib/sample";
import { cn } from "@/lib/utils";

export const metadata = { title: "Conversation" };

export default function ConversationPage() {
  return (
    <PageBody>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Harbor & Pine × Website</h1>
          <p className="text-sm text-muted-foreground">
            iMessage group via Photon · read-only evidence · activation cutoff Oct 12
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled>
            Send as owner
          </Button>
          <Button variant="outline" asChild>
            <Link href="/preview/imessage">Client view</Link>
          </Button>
        </div>
      </div>
      <Panel bodyClassName="space-y-3">
        {messages.map((message) =>
          "day" in message ? (
            <p key={message.day} className="text-center text-xs tracking-wide text-muted-foreground uppercase">
              {message.day}
            </p>
          ) : (
            <div
              key={`${message.who}-${message.time}-${message.text}`}
              className={cn("grid gap-2 rounded-lg p-3 md:grid-cols-[140px_minmax(0,1fr)_auto]", message.bot && "bg-accent")}
            >
              <div>
                <p className="text-sm font-semibold">{message.who}</p>
                <p className="text-xs text-muted-foreground">{message.role}</p>
              </div>
              <p className="text-sm">{message.text}</p>
              <div className="text-right text-xs text-muted-foreground">
                <p>{message.time}</p>
                {message.bot ? (
                  <StatusPill tone={message.meta === "Delivery unknown" ? "crit" : "ok"}>{message.meta}</StatusPill>
                ) : (
                  <p>{message.meta}</p>
                )}
              </div>
            </div>
          ),
        )}
      </Panel>
    </PageBody>
  );
}
