import { Banner, Field, PageBody, Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const metadata = { title: "Automation" };

export default function AutomationPage() {
  return (
    <PageBody>
      <Banner tone="info">
        A policy decides what the assistant may accept without asking you. It can never expand the signed scope.
      </Banner>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Mode" description="policy v3">
          <div className="flex gap-2">
            <Button type="button">Enabled</Button>
            <Button type="button" variant="outline">
              Review only
            </Button>
            <Button type="button" variant="outline">
              Paused
            </Button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Paused stops new automatic acceptances. Existing accepted work stays visible.
          </p>
        </Panel>
        <Panel title="Limits">
          <div className="space-y-3">
            <Field label="Maximum open automatically accepted tasks">
              <Input defaultValue="10" className="w-24" />
            </Field>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" defaultChecked disabled className="mt-1" />
              <span>Never promise new deadlines or prices.</span>
            </label>
            <Field label="Where decisions go">
              <Input defaultValue="Dashboard notifications" readOnly />
            </Field>
            <Field label="When I complete a task">
              <Input defaultValue="Ask me each time" readOnly />
            </Field>
          </div>
        </Panel>
      </div>
      <Panel title="Routine operations" description="Only these exact operations.">
        <div className="space-y-3 text-sm">
          <label className="flex gap-2"><input type="checkbox" defaultChecked className="mt-1" /> <span><b className="font-mono">replace_text</b> — confirmed target and exact replacement text</span></label>
          <label className="flex gap-2"><input type="checkbox" defaultChecked className="mt-1" /> <span><b className="font-mono">change_color</b> — confirmed target and one color</span></label>
          <label className="flex gap-2 text-muted-foreground"><input type="checkbox" disabled className="mt-1" /> <span><b className="font-mono">replace_image_reference</b> — not built in this release</span></label>
        </div>
      </Panel>
      <Panel title="Policy history" action={<Button type="button">Save as policy v4</Button>}>
        <ul className="space-y-2 text-sm">
          <li>v3 · current · added home.hero.subtext, max open tasks 10</li>
          <li className="text-muted-foreground">v2 · enabled replace_text and change_color</li>
          <li className="text-muted-foreground">v1 · created in review-only mode</li>
        </ul>
      </Panel>
    </PageBody>
  );
}
