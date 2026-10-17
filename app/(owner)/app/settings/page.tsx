import Link from "next/link";
import { Field, PageBody, Panel } from "@/components/dashboard/panel";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <PageBody>
      <h1 className="text-2xl font-semibold">Settings</h1>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Profile">
          <div className="space-y-3">
            <Field label="Name">
              <Input defaultValue="Amogh" />
            </Field>
            <Field label="Timezone">
              <Input defaultValue="America/Los_Angeles" />
            </Field>
            <Field label="Organization">
              <Input defaultValue="Northlight Web Studio" />
            </Field>
            <div className="flex gap-2">
              <Button type="button">Save</Button>
              <Button variant="outline" asChild>
                <Link href="/login">Sign out</Link>
              </Button>
            </div>
          </div>
        </Panel>
        <Panel title="Photon · iMessage" action={<StatusPill tone="ok">Configured</StatusPill>}>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Instance</dt>
            <dd className="font-mono">inst_••••7d2</dd>
            <dt className="text-muted-foreground">Webhook</dt>
            <dd>Signature verified</dd>
            <dt className="text-muted-foreground">Last inbound event</dt>
            <dd>Oct 16, 9:14 AM</dd>
            <dt className="text-muted-foreground">Outbox</dt>
            <dd>1 delivery unknown</dd>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm">
              Check connection
            </Button>
            <Button type="button" variant="outline" size="sm">
              Send test message
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Reachable means the API answered. It does not prove a client message was delivered.
          </p>
        </Panel>
        <Panel title="Gemini" action={<StatusPill tone="ok">Available</StatusPill>}>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Model</dt>
            <dd>Pinned sponsor account model</dd>
            <dt className="text-muted-foreground">Status</dt>
            <dd>Available · not rate-limited</dd>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            Keys live in server environment variables and are never shown here.
          </p>
        </Panel>
      </div>
    </PageBody>
  );
}
