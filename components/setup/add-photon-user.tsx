"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { photonUserInputSchema } from "@/lib/schemas/photon-user";
import type { PhotonUser } from "@/lib/photon/spectrum";

export function AddPhotonUser({
  projectId,
  disabled,
  onAdded,
  onCancel,
  onBusyChange,
}: {
  projectId: string;
  disabled: boolean;
  onAdded: (user: PhotonUser, existing: boolean) => void;
  onCancel: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [fields, setFields] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submitting = useRef(false);
  const parsed = photonUserInputSchema.safeParse(fields);
  return (
    <form
      className="grid gap-4 rounded-lg border bg-card p-4"
      aria-label="Add a Photon user"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!parsed.success || disabled || submitting.current) return;
        submitting.current = true;
        setBusy(true);
        onBusyChange(true);
        setError("");
        try {
          const response = await fetch("/api/v1/integrations/photon/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId, ...parsed.data }),
          });
          const body = await response.json();
          if (!response.ok)
            throw new Error(
              body.error?.message ||
                "The user could not be added. Try again with the same phone number.",
            );
          onAdded(body.data.user, body.data.existing);
        } catch (error) {
          setError(
            error instanceof Error
              ? error.message
              : "The user could not be added. Retry with the same phone number.",
          );
        } finally {
          submitting.current = false;
          setBusy(false);
          onBusyChange(false);
        }
      }}
    >
      <div>
        <h4 className="font-semibold">Add a Photon user</h4>
        <p className="mt-1 text-sm text-muted-foreground">
          Create the client in your Photon project, then connect them to this
          draft. This does not send an introduction.
        </p>
      </div>
      <fieldset
        disabled={disabled || busy}
        className="grid gap-4 sm:grid-cols-2"
      >
        <label className="grid gap-2 text-sm" htmlFor="photon-first-name">
          First name
          <Input
            id="photon-first-name"
            autoComplete="given-name"
            value={fields.firstName}
            onChange={(e) =>
              setFields({ ...fields, firstName: e.target.value })
            }
            maxLength={100}
            required
          />
        </label>
        <label className="grid gap-2 text-sm" htmlFor="photon-last-name">
          Last name (optional)
          <Input
            id="photon-last-name"
            autoComplete="family-name"
            value={fields.lastName}
            onChange={(e) => setFields({ ...fields, lastName: e.target.value })}
            maxLength={100}
          />
        </label>
        <label className="grid gap-2 text-sm" htmlFor="photon-email">
          Email
          <Input
            id="photon-email"
            type="email"
            autoComplete="email"
            value={fields.email}
            onChange={(e) => setFields({ ...fields, email: e.target.value })}
            maxLength={254}
            required
          />
        </label>
        <div className="grid gap-2 text-sm">
          <label htmlFor="photon-phone">Phone number</label>
          <Input
            id="photon-phone"
            type="tel"
            autoComplete="tel"
            placeholder="+14155551234"
            value={fields.phoneNumber}
            onChange={(e) =>
              setFields({ ...fields, phoneNumber: e.target.value })
            }
            maxLength={50}
            required
            aria-describedby="photon-phone-help"
          />
          <span
            id="photon-phone-help"
            className="text-xs text-muted-foreground"
          >
            Include the country code, such as +1 for the US.
          </span>
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={busy || disabled || !parsed.success}>
          {busy ? "Adding user…" : "Create Photon user"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
      {busy && (
        <p role="status" className="text-sm">
          Creating the user in Photon…
        </p>
      )}
    </form>
  );
}
