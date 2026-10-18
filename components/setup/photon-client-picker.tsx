"use client";
import { useCallback, useEffect, useState } from "react";
import { DeletePhotonUser } from "./delete-photon-user";
import { AddPhotonUser } from "./add-photon-user";
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
  { ok: true; users: PhotonUser[] } | { ok: false; message: string };

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
  projectId,
  people,
  disabled,
  onConnect,
  error,
}: {
  projectId: string;
  people: Project["people"];
  disabled: boolean;
  onConnect: (photonUserId: string) => void;
  error?: string;
}) {
  const [result, setResult] = useState<PhotonUsersResult | null>(null),
    [loading, setLoading] = useState(true),
    [selected, setSelected] = useState(people?.photon_user_id || "");
  const [adding, setAdding] = useState(false),
    [creating, setCreating] = useState(false),
    [deleting, setDeleting] = useState(false),
    [notice, setNotice] = useState("");
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
    <div
      className={`grid gap-4 rounded-lg ${error ? "border border-destructive p-4" : ""}`}
    >
      <h3 className="font-semibold">1. Connect your client on iMessage</h3>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        Choose an existing Photon user or add your client here with their name,
        email and phone number. Then connect the selected user to this project.
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
        <p
          role="alert"
          className="rounded border border-destructive p-3 text-sm"
        >
          {result.message}
        </p>
      )}
      {!loading && result?.ok && result.users.length === 0 && (
        <p className="text-sm">
          No users yet. Use Add user to create your client in Photon.
        </p>
      )}
      {!loading && result?.ok && result.users.length > 0 && (
        <fieldset
          disabled={disabled || creating || deleting}
          className="grid gap-2"
          aria-label="Photon users"
        >
          {result.users.map((user) => (
            <div
              key={user.id}
              className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${selected === user.id ? "border-primary bg-accent" : ""}`}
            >
              <label className="flex min-w-0 flex-1 items-start gap-3">
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
              <DeletePhotonUser
                projectId={projectId}
                user={user}
                disabled={disabled || creating || deleting}
                connected={people?.photon_user_id === user.id}
                onBusyChange={setDeleting}
                onDeleted={(id) => {
                  setResult((previous) =>
                    previous?.ok
                      ? {
                          ...previous,
                          users: previous.users.filter(
                            (user) => user.id !== id,
                          ),
                        }
                      : previous,
                  );
                  setSelected((previous) => (previous === id ? "" : previous));
                  setNotice(
                    "Photon user deleted. Choose another client or add a new user.",
                  );
                }}
              />
            </div>
          ))}
        </fieldset>
      )}
      {adding && (
        <AddPhotonUser
          projectId={projectId}
          disabled={disabled || deleting}
          onBusyChange={setCreating}
          onCancel={() => setAdding(false)}
          onAdded={(user, existing) => {
            setResult((previous) => ({
              ok: true,
              users: [
                ...(previous?.ok
                  ? previous.users.filter(
                      (item) =>
                        item.id !== user.id &&
                        item.phoneNumber !== user.phoneNumber,
                    )
                  : []),
                user,
              ],
            }));
            setSelected(user.id);
            setAdding(false);
            setNotice(
              `${existing ? "This phone number is already in Photon. The existing user is selected." : "Photon user added and selected."} Connect the selected client below to save the project connection.`,
            );
          }}
        />
      )}
      {notice && (
        <p role="status" className="rounded border p-3 text-sm">
          {notice}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={disabled || creating || deleting || loading || adding}
          onClick={() => {
            setAdding(true);
            setNotice("");
          }}
        >
          Add user
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={loading || creating || deleting}
          onClick={refresh}
        >
          Refresh Photon users
        </Button>
        <Button
          type="button"
          disabled={
            disabled ||
            creating ||
            deleting ||
            loading ||
            !selected ||
            !result?.ok ||
            !result.users.some((user) => user.id === selected)
          }
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
