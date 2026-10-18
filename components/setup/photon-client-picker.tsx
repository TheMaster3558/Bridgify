"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Project } from "@/lib/domain/types";

type PhotonUser = {
  id: string;
  name: string;
  email: string | null;
  phoneNumber: string;
  assignedPhoneNumber: string | null;
};
type PhotonUsersResult =
  | { ok: true; users: PhotonUser[] }
  | { ok: false; message: string };

async function fetchPhotonUsers(): Promise<PhotonUsersResult> {
  const unavailable = "Photon users could not be loaded.";
  try {
    const response = await fetch("/api/v1/integrations/photon/users", {
      cache: "no-store",
    });
    const body = await response.json();
    return response.ok
      ? body.data
      : { ok: false, message: body.error?.message || unavailable };
  } catch {
    return { ok: false, message: unavailable };
  }
}

export function PhotonClientPicker({
  people,
  disabled,
  onConnect,
}: {
  people: Project["people"];
  disabled: boolean;
  onConnect: (photonUserId: string) => void;
}) {
  const [result, setResult] = useState<PhotonUsersResult | null>(null),
    [loading, setLoading] = useState(true),
    [selected, setSelected] = useState(people?.photon_user_id || "");
  const show = useCallback((next: PhotonUsersResult) => {
    setResult(next);
    setLoading(false);
  }, []);
  useEffect(() => {
    void fetchPhotonUsers().then(show);
  }, [show]);
  const refresh = () => {
    setLoading(true);
    void fetchPhotonUsers().then(show);
  };
  return (
    <div className="grid gap-4">
      <h3 className="font-semibold">1. Connect your client on iMessage</h3>
      <p className="text-sm text-muted-foreground">
        Add your client on the Users page of your{" "}
        <a
          className="underline"
          href="https://app.photon.codes"
          target="_blank"
          rel="noreferrer"
        >
          Photon project
        </a>{" "}
        with their phone number, then refresh this list and choose them. That
        Photon user is the project client. Photon Pro gives each user their own
        number for texting the assistant.
      </p>
      {people && (
        <p className="rounded border p-3 text-sm">
          Connected: <strong>{people.client_name}</strong> ·{" "}
          {people.client_sender_id}
          {people.agent_number
            ? ` · texts the assistant at ${people.agent_number}`
            : ""}
        </p>
      )}
      {loading && (
        <p role="status" className="text-sm">
          Loading Photon users…
        </p>
      )}
      {!loading && result && !result.ok && (
        <p role="alert" className="rounded border border-destructive p-3 text-sm">
          {result.message}
        </p>
      )}
      {!loading && result?.ok && result.users.length === 0 && (
        <p className="text-sm">
          No users yet. Add your client on the Photon Users page, then refresh.
        </p>
      )}
      {!loading && result?.ok && result.users.length > 0 && (
        <fieldset
          disabled={disabled}
          className="grid gap-2"
          aria-label="Photon users"
        >
          {result.users.map((user) => (
            <label
              key={user.id}
              className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${selected === user.id ? "border-primary bg-accent" : ""}`}
            >
              <input
                className="mt-1"
                type="radio"
                name="photon_user"
                value={user.id}
                checked={selected === user.id}
                onChange={() => setSelected(user.id)}
              />
              <span className="grid gap-0.5">
                <span className="font-medium">{user.name}</span>
                <span className="text-muted-foreground">
                  {user.phoneNumber}
                  {user.email ? ` · ${user.email}` : ""}
                </span>
                {user.assignedPhoneNumber && (
                  <span className="text-muted-foreground">
                    Texts the assistant at {user.assignedPhoneNumber}
                  </span>
                )}
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={loading}
          onClick={refresh}
        >
          Refresh Photon users
        </Button>
        <Button
          type="button"
          disabled={disabled || !selected || !result?.ok}
          onClick={() => onConnect(selected)}
        >
          {!people
            ? "Connect this client"
            : selected === people.photon_user_id
              ? "Reconnect this client"
              : "Switch to this client"}
        </Button>
      </div>
    </div>
  );
}
