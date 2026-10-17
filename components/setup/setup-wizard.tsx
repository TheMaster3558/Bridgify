"use client";

import { useState } from "react";
import { Field, PageBody, Panel } from "@/components/dashboard/panel";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const steps = ["Basics", "Agreement", "People and chat", "Automation", "Review and activate"];

export function SetupWizard() {
  const [step, setStep] = useState(0);
  const [disclosed, setDisclosed] = useState(false);

  return (
    <PageBody>
      <div>
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          New project · draft
        </p>
        <h1 className="text-2xl font-semibold">Ferro Cycles landing refresh</h1>
      </div>
      <div className="grid gap-2 sm:grid-cols-5">
        {steps.map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(index)}
            className={cn(
              "border-t-4 border-border px-3 py-2 text-left text-sm text-muted-foreground",
              index < step && "border-ok",
              index === step && "border-primary text-foreground",
            )}
          >
            Step {index + 1}
            <span className="mt-1 block font-semibold text-foreground">{label}</span>
          </button>
        ))}
      </div>
      <Panel title={steps[step]}>
        {step === 0 ? <Basics /> : null}
        {step === 1 ? <Agreement /> : null}
        {step === 2 ? <People /> : null}
        {step === 3 ? <Automation /> : null}
        {step === 4 ? <Review disclosed={disclosed} onDisclose={setDisclosed} /> : null}
      </Panel>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="outline" onClick={() => setStep((value) => Math.max(0, value - 1))}>
          Back
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline">
            Save and exit
          </Button>
          {step < 4 ? (
            <Button type="button" onClick={() => setStep((value) => Math.min(4, value + 1))}>
              Continue
            </Button>
          ) : (
            <Button type="button" disabled={!disclosed}>
              Activate project
            </Button>
          )}
        </div>
      </div>
    </PageBody>
  );
}

function Basics() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Project name">
        <Input defaultValue="Ferro Cycles landing refresh" />
      </Field>
      <Field label="Client name">
        <Input defaultValue="Ferro Cycles" />
      </Field>
      <Field label="Original price" hint="Stored as integer cents. Zero or more.">
        <Input defaultValue="1800.00" />
      </Field>
      <Field label="Currency" hint="USD only in this release">
        <Input defaultValue="USD" readOnly />
      </Field>
      <Field label="Project timezone">
        <Input defaultValue="America/Los_Angeles" />
      </Field>
      <Field label="Agreed completion date (optional)" hint="Only a date the client agreed to.">
        <Input placeholder="No date agreed" />
      </Field>
    </div>
  );
}

function Agreement() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="rounded-lg border border-dashed p-6 text-sm">
        <p className="font-medium">Ferro-Cycles-SOW.pdf</p>
        <p className="text-muted-foreground">1 page · text extracted · ready to confirm</p>
      </div>
      <div className="space-y-3 text-sm">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Extracted items · confirm each
        </p>
        {["Single landing page with hero and features", "One revision per accepted request, 2 total", "E-commerce is excluded"].map(
          (item) => (
            <label key={item} className="flex items-start gap-2">
              <input type="checkbox" defaultChecked className="mt-1" />
              <span>{item}</span>
            </label>
          ),
        )}
      </div>
    </div>
  );
}

function People() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Field label="Client requester and approver" hint="Display names never grant authority.">
        <Input defaultValue="Lena Ferro · lena@ferrocycles.example" />
      </Field>
      <div className="space-y-3 text-sm">
        <p className="font-medium">iMessage group</p>
        <Input defaultValue="Ferro × Landing page" readOnly />
        <Button type="button" variant="outline" size="sm">
          Send test message
        </Button>
        <p className="text-muted-foreground">Map each sender to a person before activation.</p>
      </div>
    </div>
  );
}

function Automation() {
  return (
    <div className="grid gap-4 md:grid-cols-2 text-sm">
      <div className="space-y-2">
        <p className="font-medium">Routine operations</p>
        <label className="flex gap-2"><input type="checkbox" defaultChecked /> replace_text</label>
        <label className="flex gap-2"><input type="checkbox" defaultChecked /> change_color</label>
        <label className="flex gap-2 text-muted-foreground"><input type="checkbox" disabled /> replace_image_reference</label>
      </div>
      <div className="space-y-3">
        <Field label="Revision counting" hint="Per accepted request in this release.">
          <Input defaultValue="Per accepted request" readOnly />
        </Field>
        <Field label="Units" hint="Defaults to 0 until you set it.">
          <Input defaultValue="2" className="w-24" />
        </Field>
      </div>
    </div>
  );
}

function Review({
  disclosed,
  onDisclose,
}: {
  disclosed: boolean;
  onDisclose: (value: boolean) => void;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2 text-sm">
      <div className="space-y-2">
        {["Scope baseline confirmed", "Participant bindings confirmed", "Group test message delivered"].map(
          (item) => (
            <div key={item} className="flex items-center gap-2">
              <StatusPill tone="ok">Done</StatusPill>
              <span>{item}</span>
            </div>
          ),
        )}
        <label className="mt-3 flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-1"
            checked={disclosed}
            onChange={(event) => onDisclose(event.target.checked)}
          />
          <span>Everyone in this group knows an assistant reads and replies to project messages.</span>
        </label>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Assistant introduction
        </p>
        <Textarea
          readOnly
          defaultValue="Hi Lena! I'm Bridgify, Amogh's project assistant. I'll confirm included changes and check with Amogh on anything new. This project includes 2 revisions, counted per accepted change."
        />
      </div>
    </div>
  );
}
