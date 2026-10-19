import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { acceptInvite, getInvitePreview } from "../api";
import { SieveMark } from "../components/Icons";
import { useSession } from "../session";
import type { InvitePreview, Role } from "../types";

function roleName(role: Role) {
  return role === "owner" ? "an owner" : "a member";
}

export function AcceptInvite() {
  const { token = "" } = useParams();
  const { user, logout } = useSession();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getInvitePreview(token)
      .then(setPreview)
      .catch(() => setInvalid(true));
  }, [token]);

  async function join() {
    setJoining(true);
    setError(null);

    try {
      const membership = await acceptInvite(token);
      // A full navigation, so the session reloads with the new workspace in it.
      window.location.assign(`/w/${membership.id}/sites`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to join the workspace");
      setJoining(false);
    }
  }

  let content: React.ReactNode;

  if (invalid) {
    content = (
      <>
        <h1>Invite unavailable</h1>
        <p className="invite-text">
          This invite link is invalid or has expired. Ask the person who sent
          it for a new one.
        </p>
        <Link to="/" className="button button-secondary invite-button">
          Go to Sieve
        </Link>
      </>
    );
  } else if (!preview) {
    content = <p className="invite-text">Checking invite…</p>;
  } else if (preview.membership) {
    content = (
      <>
        <h1>You're already in {preview.workspace.name}</h1>
        <p className="invite-text">
          <strong>{user.username}</strong> is {roleName(preview.membership)} of
          this workspace.
        </p>
        <Link
          to={`/w/${preview.workspace.id}/sites`}
          className="button button-primary invite-button"
        >
          Open {preview.workspace.name}
        </Link>
      </>
    );
  } else {
    content = (
      <>
        <h1>Join {preview.workspace.name}</h1>
        <p className="invite-text">
          {preview.invited_by ?? "Someone"} invited you to join{" "}
          <strong>{preview.workspace.name}</strong> as{" "}
          {roleName(preview.role)}.
        </p>

        <div className="invite-account">
          <span className="muted">Joining as</span>
          <strong>{user.username}</strong>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <button
          type="button"
          className="button button-primary"
          disabled={joining}
          onClick={() => void join()}
        >
          {joining ? "Joining…" : `Join ${preview.workspace.name}`}
        </button>

        <button
          type="button"
          className="button button-secondary"
          disabled={joining}
          onClick={() => void logout(`/invite/${token}`)}
        >
          Use a different account
        </button>

        <p className="invite-expiry muted">
          This invite expires{" "}
          {new Date(preview.expires_at).toLocaleDateString(undefined, {
            dateStyle: "medium",
          })}
          .
        </p>
      </>
    );
  }

  return (
    <div className="login">
      <div className="login-card card">
        <div className="login-brand">
          <span className="brand-mark">
            <SieveMark size={18} />
          </span>
          Sieve
        </div>

        {content}
      </div>
    </div>
  );
}
