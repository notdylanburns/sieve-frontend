import { useEffect, useState } from "react";

import { createDevice, getDevices, revokeDevice } from "../api";
import { LaptopIcon } from "../components/Icons";
import type { CreatedDevice, Device } from "../types";
import { useWorkspace } from "../workspace";

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function Secret({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied; the value is still selectable.
    }
  }

  return (
    <div className="secret">
      <span className="secret-label">{label}</span>
      <code className="secret-value">{value}</code>
      <button type="button" className="button button-secondary" onClick={() => void copy()}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function Devices() {
  const workspace = useWorkspace();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedDevice | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    getDevices(workspace.id)
      .then(setDevices)
      .catch((error) =>
        setError(error instanceof Error ? error.message : "Failed to load devices"),
      )
      .finally(() => setLoading(false));
  }, [workspace.id]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const result = await createDevice(workspace.id, name.trim());
      setCreated(result);
      setDevices((current) => [result.device, ...current]);
      setName("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to add device");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(device: Device) {
    if (
      !window.confirm(
        `Revoke ${device.name}? It will lose access to Sieve and the proxy immediately.`,
      )
    ) {
      return;
    }

    setRevoking(device.id);
    setError(null);

    try {
      const revoked = await revokeDevice(workspace.id, device.id);
      setDevices((current) =>
        current.map((item) => (item.id === revoked.id ? revoked : item)),
      );
      if (created?.device.id === device.id) {
        setCreated(null);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to revoke device");
    } finally {
      setRevoking(null);
    }
  }

  const activeCount = devices.filter((device) => !device.revoked_at).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Devices</h1>
          <p className="page-description">
            Computers that use this workspace's sites and videos through the
            Sieve proxy.
          </p>
        </div>

        {!loading && devices.length > 0 && (
          <div className="stats">
            <span className="stat">
              <strong>{activeCount}</strong> active
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="alert alert-error">
          {error}

          <button type="button" className="alert-dismiss" onClick={() => setError(null)}>
            ×
          </button>
        </div>
      )}

      {created && (
        <section className="card credentials">
          <div className="section-heading">
            <div>
              <h2>Credentials for {created.device.name}</h2>
              <p>
                Copy these into the device's configuration now. They aren't
                stored and can't be shown again.
              </p>
            </div>

            <button
              type="button"
              className="button button-secondary"
              onClick={() => setCreated(null)}
            >
              Done
            </button>
          </div>

          <Secret label="Device token" value={created.token} />
          <Secret label="Proxy username" value={created.device.proxy_username} />
          <Secret label="Proxy password" value={created.proxy_password} />
        </section>
      )}

      <section className="add-site card">
        <div className="section-heading">
          <div>
            <h2>Add device</h2>
            <p>Give it a name you'll recognise, like "Living room laptop".</p>
          </div>
        </div>

        <form className="add-video-form" onSubmit={handleCreate}>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Device name"
            aria-label="Device name"
            maxLength={100}
          />

          <button
            type="submit"
            className="button button-primary"
            disabled={creating || name.trim().length === 0}
          >
            {creating ? "Adding…" : "Add"}
          </button>
        </form>
      </section>

      <div className="card">
        {loading ? (
          <div className="empty-state">Loading devices…</div>
        ) : devices.length === 0 ? (
          <div className="empty-state">
            <LaptopIcon size={28} />
            <span>No devices yet.</span>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Proxy username</th>
                  <th>Added</th>
                  <th>Status</th>
                  <th className="actions-column" />
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => (
                  <tr key={device.id} className={device.revoked_at ? "revoked" : ""}>
                    <td>{device.name}</td>
                    <td>
                      <code>{device.proxy_username}</code>
                    </td>
                    <td>{formatDate(device.created_at)}</td>
                    <td>
                      {device.revoked_at ? (
                        <span className="badge badge-denied" title={formatDate(device.revoked_at)}>
                          Revoked
                        </span>
                      ) : (
                        <span className="badge badge-allowed">Active</span>
                      )}
                    </td>
                    <td className="actions-cell">
                      {!device.revoked_at && (
                        <button
                          type="button"
                          className="button button-danger"
                          disabled={revoking === device.id}
                          onClick={() => void handleRevoke(device)}
                        >
                          {revoking === device.id ? "Revoking…" : "Revoke"}
                        </button>
                      )}
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
