"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TIMEZONES } from "@/lib/projects/draft";

function idempotencyKey() {
  return crypto.randomUUID().replaceAll("-", "");
}

export function ProfileForm({
  email,
  name,
  timezone,
  organization,
}: {
  email: string;
  name: string;
  timezone: string;
  organization: string;
}) {
  const router = useRouter();
  const zones = [
    ...(timezone && !(TIMEZONES as readonly string[]).includes(timezone)
      ? [timezone]
      : []),
    ...TIMEZONES,
  ];
  const [draft, setDraft] = useState({ name, timezone, organization });
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const key = useRef(idempotencyKey());

  function edit(patch: Partial<typeof draft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setNotice("");
    key.current = idempotencyKey();
  }

  return (
    <section className="rounded-xl border bg-card p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Profile</h2>
      <p className="mt-1 text-sm text-muted-foreground">{email}</p>
      <form
        className="mt-5 grid gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setError("");
          setFieldErrors({});
          setNotice("");
          try {
            const response = await fetch("/api/v1/account", {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": key.current,
              },
              body: JSON.stringify(draft),
            });
            const body = await response.json();
            if (!response.ok) {
              const fields = body.error?.fieldErrors?.fieldErrors as
                | Record<string, string[]>
                | undefined;
              setFieldErrors({
                name: fields?.name?.[0] || "",
                timezone: fields?.timezone?.[0] || "",
                organization: fields?.organization?.[0] || "",
              });
              throw new Error(body.error?.message || "Unable to save settings.");
            }
            key.current = idempotencyKey();
            setNotice("Saved.");
            router.refresh();
          } catch (cause) {
            setError((cause as Error).message);
          } finally {
            setPending(false);
          }
        }}
      >
        <div className="grid gap-2">
          <Label htmlFor="profile-name">Name</Label>
          <Input
            id="profile-name"
            name="name"
            autoComplete="name"
            maxLength={80}
            value={draft.name}
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? "profile-name-error" : undefined}
            onChange={(event) => edit({ name: event.target.value })}
          />
          {fieldErrors.name ? (
            <p id="profile-name-error" className="text-sm text-crit" role="alert">
              {fieldErrors.name}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="profile-timezone">Timezone</Label>
          <Select
            value={draft.timezone || undefined}
            onValueChange={(value) => edit({ timezone: value })}
          >
            <SelectTrigger
              id="profile-timezone"
              className="w-full"
              aria-invalid={Boolean(fieldErrors.timezone)}
              aria-describedby={
                fieldErrors.timezone ? "profile-timezone-error" : "profile-timezone-hint"
              }
            >
              <SelectValue placeholder="Choose a timezone" />
            </SelectTrigger>
            <SelectContent>
              {zones.map((zone) => (
                <SelectItem key={zone} value={zone}>
                  {zone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p id="profile-timezone-hint" className="text-xs text-muted-foreground">
            Used for dates in Settings. Each project keeps its own timezone.
          </p>
          {fieldErrors.timezone ? (
            <p id="profile-timezone-error" className="text-sm text-crit" role="alert">
              {fieldErrors.timezone}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="profile-organization">Organization</Label>
          <Input
            id="profile-organization"
            name="organization"
            autoComplete="organization"
            maxLength={120}
            value={draft.organization}
            aria-invalid={Boolean(fieldErrors.organization)}
            aria-describedby={
              fieldErrors.organization ? "profile-organization-error" : undefined
            }
            onChange={(event) => edit({ organization: event.target.value })}
          />
          {fieldErrors.organization ? (
            <p id="profile-organization-error" className="text-sm text-crit" role="alert">
              {fieldErrors.organization}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
        {notice ? (
          <p role="status" className="text-sm text-ok">
            {notice}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-crit">
            {error}
          </p>
        ) : null}
      </form>
      <form method="post" action="/auth/signout" className="mt-4">
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
    </section>
  );
}
