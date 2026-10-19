import { useEffect, useState } from "react";

import { createInvite, getInvites, inviteUrl, revokeInvite } from "../api";
import type { Invite, Role } from "../types";
import { useWorkspace } from "../workspace";

const EXPIRY_OPTIONS = [
  { days: 1, label: "1 day" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
];

const USE_OPTIONS: { uses: number | null; label: string }[] = [
  { uses: 1, label: "Single use" },
  { uses: 5, label: "5 uses" },
  { uses: 25, label: "25 uses" },
  { uses: null, label: "Unlimited uses" },
];

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function CopyLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl(token));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy this invite link:", inviteUrl(token));
    }
  }

  return (
    <button type="button" className="button button-secondary" onClick={() => void copy()}>
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}

export function Invites() {
  const workspace = useWorkspace();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [role, setRole] = useState<Role>("member");
  const [days, setDays] = useState(7);
  const [uses, setUses] = useState<number | null>(1);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<Invite | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    getInvites(workspace.id)
      .then(setInvites)
      .catch((error) =>
        setError(error instanceof Error ? error.message : "Failed to load invites"),
      )
      .finally(() => setLoading(false));
  }, [workspace.id]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const invite = await createInvite(workspace.id, {
        role,
        expires_in_days: days,
        max_uses: uses,
      });
      setInvites((current) => [invite, ...current]);
      setCreated(invite);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to create invite");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(invite: Invite) {
    if (!window.confirm("Revoke this invite? The link will stop working immediately.")) {
      return;
    }

    setRevoking(invite.id);
    setError(null);

    try {
      await revokeInvite(workspace.id, invite.id);
      setInvites((current) => current.filter((item) => item.id !== invite.id));
      if (created?.id === invite.id) {
        setCreated(null);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to revoke invite");
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Invites</h1>
          <p className="page-description">
            Share a link to let someone join {workspace.name}. They'll sign in
            and confirm which account to add.
          </p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}

          <button type="button" className="alert-dismiss" onClick={() => setError(null)}>
            ×
          </button>
        </div>
      )}

      <section className="add-site card">
        <div className="section-heading">
          <div>
            <h2>Create invite link</h2>
            <p>Owners can manage devices, invites and the audit log.</p>
          </div>
        </div>

        <form className="invite-form" onSubmit={handleCreate}>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
            aria-label="Role"
          >
            <option value="member">Member</option>
            <option value="owner">Owner</option>
          </select>

          <select
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
            aria-label="Expires after"
          >
            {EXPIRY_OPTIONS.map((option) => (
              <option key={option.days} value={option.days}>
                Expires in {option.label}
              </option>
            ))}
          </select>

          <select
            value={uses ?? ""}
            onChange={(event) =>
              setUses(event.target.value === "" ? null : Number(event.target.value))
            }
            aria-label="Uses"
          >
            {USE_OPTIONS.map((option) => (
              <option key={option.label} value={option.uses ?? ""}>
                {option.label}
              </option>
            ))}
          </select>

          <button type="submit" className="button button-primary" disabled={creating}>
            {creating ? "Creating…" : "Create link"}
          </button>
        </form>

        {created && (
          <div className="invite-created">
            <input
              readOnly
              value={inviteUrl(created.token)}
              aria-label="New invite link"
              onFocus={(event) => event.target.select()}
            />
            <CopyLinkButton token={created.token} />
          </div>
        )}
      </section>

      <div className="card">
        {loading ? (
          <div className="empty-state">Loading invites…</div>
        ) : invites.length === 0 ? (
          <div className="empty-state">No active invites.</div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Uses</th>
                  <th>Expires</th>
                  <th>Created by</th>
                  <th className="actions-column" />
                </tr>
              </thead>
              <tbody>
                {invites.map((invite) => (
                  <tr key={invite.id}>
                    <td>{invite.role === "owner" ? "Owner" : "Member"}</td>
                    <td>
                      {invite.max_uses === null
                        ? `${invite.uses} (unlimited)`
                        : `${invite.uses} of ${invite.max_uses}`}
                    </td>
                    <td>{formatDate(invite.expires_at)}</td>
                    <td>{invite.created_by ?? <span className="muted">Deleted user</span>}</td>
                    <td className="actions-cell invite-actions">
                      <CopyLinkButton token={invite.token} />
                      <button
                        type="button"
                        className="button button-danger"
                        disabled={revoking === invite.id}
                        onClick={() => void handleRevoke(invite)}
                      >
                        {revoking === invite.id ? "Revoking…" : "Revoke"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
