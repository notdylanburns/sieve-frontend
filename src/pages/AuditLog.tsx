import { Fragment, useEffect, useState } from "react";

import { getAuditLog, type AuditQuery } from "../api";
import type { AuditEntry } from "../types";
import { useWorkspace } from "../workspace";

const PAGE_SIZE = 50;

const ACTIONS = [
  "domain.create",
  "domain.update",
  "domain.delete",
  "path.create",
  "path.update",
  "path.delete",
  "video.create",
  "video.update",
  "video.delete",
  "device.create",
  "device.revoke",
  "invite.create",
  "invite.revoke",
  "invite.accept",
  "workspace.create",
  "member.add",
  "member.remove",
];

function formatTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

/** A one-line description of what changed, from the entry's details. */
function summarise(entry: AuditEntry): string {
  const details = entry.details as {
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    domain?: { scheme?: string; domain?: string };
    name?: string;
    username?: string;
    role?: string;
  };
  const row = details.after ?? details.before;

  if (details.domain && row) {
    return `${details.domain.scheme}://${details.domain.domain}${row.path ?? ""}`;
  }

  if (row?.domain) {
    return `${row.scheme}://${row.domain}`;
  }

  if (row?.url) {
    return String(row.url);
  }

  if (details.username) {
    return details.role ? `${details.username} (${details.role})` : details.username;
  }

  if (entry.action === "invite.create" || entry.action === "invite.revoke") {
    return `${details.role} invite`;
  }

  return details.name ?? "";
}

export function AuditLog() {
  const workspace = useWorkspace();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [appliedActor, setAppliedActor] = useState("");

  async function load(query: AuditQuery, append: boolean) {
    setError(null);

    try {
      const page = await getAuditLog(workspace.id, { ...query, limit: PAGE_SIZE });
      setEntries((current) => (append ? [...current, ...page] : page));
      setHasMore(page.length === PAGE_SIZE);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to load the audit log");
    }
  }

  useEffect(() => {
    setLoading(true);
    void load({ action, actor: appliedActor }, false).finally(() => setLoading(false));
  }, [workspace.id, action, appliedActor]);

  async function loadMore() {
    const last = entries[entries.length - 1];
    if (!last) {
      return;
    }

    setLoadingMore(true);
    await load({ action, actor: appliedActor, before: last.id }, true);
    setLoadingMore(false);
  }

  function toggle(id: number) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Audit log</h1>
          <p className="page-description">
            Every change made to this workspace, newest first.
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

      <form
        className="audit-filters"
        onSubmit={(event) => {
          event.preventDefault();
          setAppliedActor(actor.trim());
        }}
      >
        <select
          value={action}
          onChange={(event) => setAction(event.target.value)}
          aria-label="Filter by action"
        >
          <option value="">All actions</option>
          {ACTIONS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <input
          value={actor}
          onChange={(event) => setActor(event.target.value)}
          onBlur={() => setAppliedActor(actor.trim())}
          placeholder="Filter by user or device"
          aria-label="Filter by actor"
        />
      </form>

      <div className="card">
        {loading ? (
          <div className="empty-state">Loading audit log…</div>
        ) : entries.length === 0 ? (
          <div className="empty-state">No matching entries.</div>
        ) : (
          <div className="table-wrapper">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Who</th>
                  <th>Action</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <Fragment key={entry.id}>
                    <tr className="audit-row" onClick={() => toggle(entry.id)}>
                      <td className="nowrap">{formatTime(entry.occurred_at)}</td>
                      <td>
                        {entry.actor_label}
                        {entry.actor_kind !== "user" && (
                          <span className="muted"> ({entry.actor_kind})</span>
                        )}
                      </td>
                      <td>
                        <code>{entry.action}</code>
                      </td>
                      <td className="url-cell">{summarise(entry)}</td>
                    </tr>

                    {expanded.has(entry.id) && (
                      <tr className="audit-details">
                        <td colSpan={4}>
                          <dl>
                            {entry.ip && (
                              <>
                                <dt>IP address</dt>
                                <dd>{entry.ip}</dd>
                              </>
                            )}
                            {entry.user_agent && (
                              <>
                                <dt>User agent</dt>
                                <dd>{entry.user_agent}</dd>
                              </>
                            )}
                            {entry.target_kind && (
                              <>
                                <dt>Target</dt>
                                <dd>
                                  {entry.target_kind} {entry.target_id}
                                </dd>
                              </>
                            )}
                          </dl>
                          <pre>{JSON.stringify(entry.details, null, 2)}</pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {hasMore && (
        <div className="pagination">
          <button
            type="button"
            className="button button-secondary"
            disabled={loadingMore}
            onClick={() => void loadMore()}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
