"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SettingsGroup,
  SettingsRow,
  settingsField,
  settingsPrimaryButton,
} from "@/components/settings/settings-ui";
import { TIMEZONES } from "@/lib/projects/draft";

function idempotencyKey() {
  return crypto.randomUUID().replaceAll("-", "");
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="w-full text-sm text-crit sm:text-right" role="alert">
      {message}
    </p>
  ) : null;
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
    <form
      className="grid gap-6"
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
              Record<string, string[]> | undefined;
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
      <SettingsGroup label="Account">
        <SettingsRow title="Email" description="Used to sign in">
          <span className="text-sm text-foreground">{email}</span>
        </SettingsRow>
        <SettingsRow
          title="Name"
          description="Shown to your team"
          htmlFor="profile-name"
        >
          <Input
            id="profile-name"
            name="name"
            autoComplete="name"
            maxLength={80}
            value={draft.name}
            className={settingsField}
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={
              fieldErrors.name ? "profile-name-error" : undefined
            }
            onChange={(event) => edit({ name: event.target.value })}
          />
          <FieldError id="profile-name-error" message={fieldErrors.name} />
        </SettingsRow>
        <SettingsRow
          title="Organization"
          description="Your workspace name"
          htmlFor="profile-organization"
        >
          <Input
            id="profile-organization"
            name="organization"
            autoComplete="organization"
            maxLength={120}
            value={draft.organization}
            className={settingsField}
            aria-invalid={Boolean(fieldErrors.organization)}
            aria-describedby={
              fieldErrors.organization
                ? "profile-organization-error"
                : undefined
            }
            onChange={(event) => edit({ organization: event.target.value })}
          />
          <FieldError
            id="profile-organization-error"
            message={fieldErrors.organization}
          />
        </SettingsRow>
      </SettingsGroup>
      <SettingsGroup label="Preferences">
        <SettingsRow
          title="Timezone"
          description={
            <span id="profile-timezone-hint">
              Used for dates in Settings. Each project keeps its own timezone.
            </span>
          }
          htmlFor="profile-timezone"
        >
          <Select
            value={draft.timezone || undefined}
            onValueChange={(value) => edit({ timezone: value })}
          >
            <SelectTrigger
              id="profile-timezone"
              size="sm"
              className={settingsField}
              aria-invalid={Boolean(fieldErrors.timezone)}
              aria-describedby={
                fieldErrors.timezone
                  ? "profile-timezone-error"
                  : "profile-timezone-hint"
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
          <FieldError
            id="profile-timezone-error"
            message={fieldErrors.timezone}
          />
        </SettingsRow>
      </SettingsGroup>
      <div className="flex flex-wrap items-center justify-end gap-3">
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
        <button
          type="submit"
          disabled={pending}
          className={settingsPrimaryButton}
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
