"use client";

import { PartStatus } from "@prisma/client";
import { useMemo, useState } from "react";

type OwnerOption = {
  id: string;
  displayName: string;
};

type PartData = {
  id: string;
  status: PartStatus;
  primaryOwnerId: string | null;
  collaboratorIds: string[];
};

export function PartDetailClient({
  part,
  users
}: {
  part: PartData;
  users: OwnerOption[];
}) {
  const [status, setStatus] = useState(part.status);
  const [toStatus, setToStatus] = useState<PartStatus>(part.status);
  const [primaryOwnerId, setPrimaryOwnerId] = useState(part.primaryOwnerId ?? "");
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>(part.collaboratorIds);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const collaboratorOptions = useMemo(
    () => users.filter((user) => user.id !== primaryOwnerId),
    [users, primaryOwnerId]
  );

  async function updateStatus(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    const response = await fetch(`/api/parts/${part.id}/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-idempotency-key": crypto.randomUUID()
      },
      body: JSON.stringify({ toStatus })
    });
    const data = (await response.json().catch(() => null)) as { error?: string; status?: PartStatus } | null;
    if (!response.ok) {
      setError(data?.error ?? "Unable to update status.");
      return;
    }
    setStatus(data?.status ?? toStatus);
    setMessage(`Status updated to ${data?.status ?? toStatus}.`);
  }

  async function updateOwners(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    const response = await fetch(`/api/parts/${part.id}/owners`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        primaryOwnerId: primaryOwnerId || null,
        collaboratorIds
      })
    });
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setError(data?.error ?? "Unable to update owners.");
      return;
    }
    setMessage("Owners updated.");
  }

  async function uploadPhoto(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    const formData = new FormData(event.currentTarget);
    const response = await fetch(`/api/parts/${part.id}/photos`, {
      method: "POST",
      body: formData
    });
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setError(data?.error ?? "Unable to upload photo.");
      return;
    }
    setMessage("Photo uploaded.");
  }

  return (
    <div className="stack">
      <form className="panel stack" onSubmit={updateStatus}>
        <h3 style={{ margin: 0 }}>Status</h3>
        <p className="muted" style={{ margin: 0 }}>
          Current: {status}
        </p>
        <div className="row">
          <select value={toStatus} onChange={(event) => setToStatus(event.target.value as PartStatus)}>
            {Object.values(PartStatus).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <button type="submit">Update Status</button>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Marking as DONE requires at least one uploaded photo.
        </p>
      </form>

      <form className="panel stack" onSubmit={updateOwners}>
        <h3 style={{ margin: 0 }}>Owners</h3>
        <label className="stack">
          Primary owner
          <select value={primaryOwnerId} onChange={(event) => setPrimaryOwnerId(event.target.value)}>
            <option value="">Unassigned</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="stack">
          Collaborators
          <select
            multiple
            value={collaboratorIds}
            onChange={(event) => {
              const selected = Array.from(event.target.selectedOptions).map((option) => option.value);
              setCollaboratorIds(selected);
            }}
            style={{ minHeight: 120 }}
          >
            {collaboratorOptions.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Save Owners</button>
      </form>

      <form className="panel stack" onSubmit={uploadPhoto}>
        <h3 style={{ margin: 0 }}>Attach Photo</h3>
        <input type="file" name="file" accept="image/*" required />
        <button type="submit">Upload</button>
      </form>

      {message ? <p style={{ color: "var(--success)", margin: 0 }}>{message}</p> : null}
      {error ? <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p> : null}
    </div>
  );
}
