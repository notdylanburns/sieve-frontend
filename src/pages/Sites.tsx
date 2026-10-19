import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createDomain,
  createDomainPath,
  deleteDomain,
  deleteDomainPath,
  getDomainPaths,
  getDomains,
  setDomainApproved,
  setPathApproved,
} from "../api";
import {
  GlobeIcon,
  SearchIcon,
  TrashIcon,
} from "../components/Icons";
import { SiteIcon } from "../components/SiteIcon";
import { Toggle } from "../components/Toggle";
import { useApplicationsChanged } from "../events";
import { useWorkspace } from "../workspace";

import type {
  Domain,
  DomainPath,
} from "../types";

type Approval = "allow" | "paths-only" | "deny";

type ParsedSite =
  | { kind: "domain"; scheme: string; domain: string }
  | { kind: "path"; scheme: string; domain: string; path: string }
  | { kind: "error"; message: string };

function parseSite(input: string): ParsedSite | null {
  const value = input.trim();

  if (!value) {
    return null;
  }

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value);

  let url: URL;

  try {
    url = new URL(hasScheme ? value : `https://${value}`);
  } catch {
    return { kind: "error", message: "Not a valid URL" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { kind: "error", message: "Only http and https URLs are supported" };
  }

  if (url.port) {
    return { kind: "error", message: "URLs with a port aren't supported" };
  }

  const scheme = url.protocol.slice(0, -1);
  const afterScheme = hasScheme
    ? value.slice(value.indexOf("://") + 3)
    : value;
  const hasExplicitPath = /^[^/?#]*\//.test(afterScheme);

  if (url.pathname === "/" && !hasExplicitPath) {
    return { kind: "domain", scheme, domain: url.hostname };
  }

  return {
    kind: "path",
    scheme,
    domain: url.hostname,
    path: url.pathname,
  };
}

const APPROVAL_LABELS: Record<Approval, string> = {
  allow: "Allowed",
  "paths-only": "Paths only",
  deny: "Denied",
};

const APPROVAL_CLASSES: Record<Approval, string> = {
  allow: "allowed",
  "paths-only": "paths-only",
  deny: "denied",
};

function toApproval(approved: boolean | null): Approval {
  if (approved === null) {
    return "paths-only";
  }

  return approved ? "allow" : "deny";
}

function fromApproval(approval: Approval): boolean | null {
  if (approval === "paths-only") {
    return null;
  }

  return approval === "allow";
}

interface DomainState {
  paths: DomainPath[];
  loading: boolean;
  error: string | null;
}

export function Sites() {
  const { id: workspace } = useWorkspace();
  const [domains, setDomains] = useState<Domain[]>([]);

  const [expanded, setExpanded] =
    useState<Set<number>>(new Set());

  const [paths, setPaths] =
    useState<Map<number, DomainState>>(new Map());

  const [loading, setLoading] = useState(true);
  const [error, setError] =
    useState<string | null>(null);

  const [updatingDomain, setUpdatingDomain] =
    useState<number | null>(null);

  const [updatingPath, setUpdatingPath] =
    useState<string | null>(null);

  const [deletingDomain, setDeletingDomain] =
    useState<number | null>(null);

  const [deletingPath, setDeletingPath] =
    useState<string | null>(null);

  // Search
  const [search, setSearch] = useState("");

  // Add form
  const [addUrl, setAddUrl] =
    useState("");

  const parsedSite = useMemo(
    () => parseSite(addUrl),
    [addUrl],
  );

  const [addApproval, setAddApproval] =
    useState<Approval>("allow");

  const [adding, setAdding] = useState(false);

  useEffect(() => {
    void loadDomains();
  }, []);

  async function loadDomains() {
    setLoading(true);
    setError(null);

    try {
      const result = await getDomains(workspace);
      setDomains(result);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to load domains",
      );
    } finally {
      setLoading(false);
    }
  }

  // Picks up fetched titles and icons, and changes made elsewhere, without a loading flash.
  useApplicationsChanged(workspace, () => {
    getDomains(workspace)
      .then(setDomains)
      .catch(() => {});
  });

  /*
   * Filter domains locally.

   * We deliberately don't filter against the API.
   *
   * A domain is visible if:
   *   - its domain name matches
   *   - OR one of its already-loaded paths matches
   *
   * We don't fetch paths just for searching.
   */
  const visibleDomains = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return domains;
    }

    const matches = (...values: (string | null)[]) =>
      values.some((value) =>
        value?.toLowerCase().includes(query),
      );

    return domains.filter((domain) => {
      if (matches(domain.domain, domain.title)) {
        return true;
      }

      const state = paths.get(domain.id);

      return state?.paths.some((path) =>
        matches(path.path, path.title),
      );
    });
  }, [domains, paths, search]);

  const allowedCount = domains.filter(
    (domain) => domain.approved === true,
  ).length;

  const pathsOnlyCount = domains.filter(
    (domain) => domain.approved === null,
  ).length;

  async function setDomainApproval(
    domain: Domain,
    approved: boolean | null,
  ) {
    setUpdatingDomain(domain.id);

    // Optimistic update
    setDomains((current) =>
      current.map((item) =>
        item.id === domain.id
          ? {
              ...item,
              approved,
            }
          : item,
      ),
    );

    try {
      await setDomainApproved(
        workspace,
        domain.id,
        approved,
      );
    } catch (error) {
      // Roll back
      setDomains((current) =>
        current.map((item) =>
          item.id === domain.id
            ? {
                ...item,
                approved: domain.approved,
              }
            : item,
        ),
      );

      setError(
        error instanceof Error
          ? error.message
          : "Failed to update domain",
      );
    } finally {
      setUpdatingDomain(null);
    }
  }

  async function togglePath(
    domainId: number,
    path: DomainPath,
  ) {
    const approved = !path.approved;
    const key = `${domainId}:${path.id}`;

    setUpdatingPath(key);

    // Optimistic update
    setPaths((current) => {
      const domainState = current.get(domainId);

      if (!domainState) {
        return current;
      }

      return new Map(current).set(domainId, {
        ...domainState,
        paths: domainState.paths.map((item) =>
          item.id === path.id
            ? {
                ...item,
                approved,
              }
            : item,
        ),
      });
    });

    try {
      await setPathApproved(
        workspace,
        domainId,
        path.id,
        approved,
      );
    } catch (error) {
      // Roll back
      setPaths((current) => {
        const domainState =
          current.get(domainId);

        if (!domainState) {
          return current;
        }

        return new Map(current).set(domainId, {
          ...domainState,
          paths: domainState.paths.map(
            (item) =>
              item.id === path.id
                ? {
                    ...item,
                    approved: path.approved,
                  }
                : item,
          ),
        });
      });

      setError(
        error instanceof Error
          ? error.message
          : "Failed to update path",
      );
    } finally {
      setUpdatingPath(null);
    }
  }

  async function toggleExpanded(
    domainId: number,
  ) {
    const isExpanded =
      expanded.has(domainId);

    setExpanded((current) => {
      const next = new Set(current);

      if (isExpanded) {
        next.delete(domainId);
      } else {
        next.add(domainId);
      }

      return next;
    });

    if (
      isExpanded ||
      paths.has(domainId)
    ) {
      return;
    }

    setPaths((current) =>
      new Map(current).set(domainId, {
        paths: [],
        loading: true,
        error: null,
      }),
    );

    try {
      const result =
        await getDomainPaths(workspace, domainId);

      setPaths((current) =>
        new Map(current).set(domainId, {
          paths: result,
          loading: false,
          error: null,
        }),
      );
    } catch (error) {
      setPaths((current) =>
        new Map(current).set(domainId, {
          paths: [],
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to load paths",
        }),
      );
    }
  }

  async function handleAdd(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    const site = parsedSite;

    if (!site || site.kind === "error") {
      return;
    }

    setAdding(true);
    setError(null);

    const approved =
      addApproval === "allow";

    try {
      let domainResponse =
        await createDomain(
          workspace,
          site.scheme,
          site.domain,
          site.kind === "domain"
            ? fromApproval(addApproval)
            : null,
        );

      if (
        site.kind === "domain" &&
        addApproval === "paths-only" &&
        domainResponse.approved !== null
      ) {
        await setDomainApproved(
          workspace,
          domainResponse.id,
          null,
        );

        domainResponse = {
          ...domainResponse,
          approved: null,
        };
      }

      setDomains((current) =>
        current.map((item) =>
          item.id === domainResponse.id
            ? domainResponse
            : item,
        ),
      );

      if (domains.find(d => d.id === domainResponse.id) === undefined) {
        setDomains((current) => [
          ...current,
          domainResponse ,
        ]);
      }

      if (site.kind === "domain") return;

      const pathResponse =
        await createDomainPath(
          workspace,
          domainResponse.id,
          site.path,
          approved,
        );

      setPaths((current) => {
        const existing =
          current.get(domainResponse.id);

        if (!existing) {
          return new Map(current).set(
            domainResponse.id,
            {
              paths: [pathResponse],
              loading: false,
              error: null,
            },
          );
        }

        return new Map(current).set(
          domainResponse.id,
          {
            ...existing,
            paths: [
              ...existing.paths,
              pathResponse,
            ],
          },
        );
      });

      // Make the domain visible/open.
      setExpanded((current) => {
        const next = new Set(current);
        next.add(domainResponse.id);
        return next;
      });
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to add site",
      );
    } finally {
      setAddUrl("");
      setAdding(false);
    }
  }

  async function handleDeleteDomain(
    domain: Domain,
  ) {
    if (
      !window.confirm(
        `Delete ${domain.domain}? This will also delete all of its paths.`,
      )
    ) {
      return;
    }

    setDeletingDomain(domain.id);
    setError(null);

    try {
      await deleteDomain(workspace, domain.id);

      setDomains((current) =>
        current.filter(
          (item) => item.id !== domain.id,
        ),
      );

      setExpanded((current) => {
        const next = new Set(current);
        next.delete(domain.id);
        return next;
      });

      setPaths((current) => {
        const next = new Map(current);
        next.delete(domain.id);
        return next;
      });
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to delete domain",
      );
    } finally {
      setDeletingDomain(null);
    }
  }

  async function handleDeletePath(
    domainId: number,
    path: DomainPath,
  ) {
    if (
      !window.confirm(
        `Delete ${path.path}?`,
      )
    ) {
      return;
    }

    const key = `${domainId}:${path.id}`;

    setDeletingPath(key);
    setError(null);

    try {
      await deleteDomainPath(
        workspace,
        domainId,
        path.id,
      );

      setPaths((current) => {
        const state = current.get(domainId);

        if (!state) {
          return current;
        }

        return new Map(current).set(
          domainId,
          {
            ...state,
            paths: state.paths.filter(
              (item) => item.id !== path.id,
            ),
          },
        );
      });
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to delete path",
      );
    } finally {
      setDeletingPath(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Sites</h1>

          <p className="page-description">
            Manage approved and denied domains
            and paths.
          </p>
        </div>

        {!loading && domains.length > 0 && (
          <div className="stats">
            <span className="stat">
              <strong>{domains.length}</strong>
              {domains.length === 1
                ? " domain"
                : " domains"}
            </span>
            <span className="stat stat-allowed">
              <strong>{allowedCount}</strong> allowed
            </span>
            <span className="stat stat-paths-only">
              <strong>{pathsOnlyCount}</strong> paths only
            </span>
            <span className="stat stat-denied">
              <strong>
                {domains.length -
                  allowedCount -
                  pathsOnlyCount}
              </strong>{" "}
              denied
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="alert alert-error">
          {error}

          <button
            type="button"
            className="alert-dismiss"
            onClick={() =>
              setError(null)
            }
          >
            ×
          </button>
        </div>
      )}

      {/* Add site */}

      <section className="add-site card">
        <div className="section-heading">
          <div>
            <h2>Add site</h2>

            <p>
              Add a domain or a path to the
              allow or deny list.
            </p>
          </div>
        </div>

        <form
          className="add-site-form"
          onSubmit={handleAdd}
        >
          <input
            type="text"
            value={addUrl}
            onChange={(event) => {
              const value = event.target.value;

              setAddUrl(value);

              if (
                parseSite(value)?.kind === "path" &&
                addApproval === "paths-only"
              ) {
                setAddApproval("allow");
              }
            }}
            placeholder="https://example.com or https://example.com/page"
            aria-label="URL"
            aria-invalid={parsedSite?.kind === "error"}
            aria-describedby="add-site-hint"
          />

          <select
            value={addApproval}
            onChange={(event) => {
              setAddApproval(
                event.target.value as Approval,
              );
            }}
            aria-label="Access policy"
          >
            <option value="allow">
              Allow
            </option>

            {parsedSite?.kind !== "path" && (
              <option value="paths-only">
                Paths only
              </option>
            )}

            <option value="deny">
              Deny
            </option>
          </select>

          <button
            type="submit"
            className="button button-primary"
            disabled={
              adding ||
              !parsedSite ||
              parsedSite.kind === "error"
            }
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </form>

        <p
          id="add-site-hint"
          className={`add-site-hint ${
            parsedSite?.kind === "error"
              ? "add-site-hint-error"
              : ""
          }`}
        >
          {!parsedSite
            ? "Enter a domain (example.com) to add the whole site, or a URL with a path (example.com/ or example.com/page) to add a single page."
            : parsedSite.kind === "error"
              ? parsedSite.message
              : parsedSite.kind === "domain"
                ? `Domain: ${parsedSite.scheme}://${parsedSite.domain}`
                : `Path: ${parsedSite.path} on ${parsedSite.scheme}://${parsedSite.domain}`}
        </p>
      </section>

      {/* Search */}

      <div className="sites-search">
        <span className="search-icon">
          <SearchIcon />
        </span>

        <input
          type="search"
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          placeholder="Search sites…"
          aria-label="Search sites"
        />

        {search && (
          <button
            type="button"
            className="clear-search"
            onClick={() => setSearch("")}
          >
            Clear
          </button>
        )}
      </div>

      {/* Domains */}

      <div className="card">
        {loading ? (
          <div className="empty-state">
            Loading domains…
          </div>
        ) : visibleDomains.length === 0 ? (
          <div className="empty-state">
            <GlobeIcon size={28} />
            <span>
              {search
                ? "No sites matched your search."
                : "No sites yet. Add a domain above to get started."}
            </span>
          </div>
        ) : (
          <div className="domain-list">
            {visibleDomains.map(
              (domain) => {
                const isExpanded =
                  expanded.has(domain.id);

                const domainPaths =
                  paths.get(domain.id);

                return (
                  <div
                    className="domain"
                    key={domain.id}
                  >
                    <div className="domain-row">
                      <button
                        type="button"
                        className="expand-button"
                        aria-expanded={
                          isExpanded
                        }
                        aria-label={
                          isExpanded
                            ? `Collapse ${domain.domain}`
                            : `Expand ${domain.domain}`
                        }
                        onClick={() =>
                          void toggleExpanded(
                            domain.id,
                          )
                        }
                      >
                        <span
                          className={`chevron ${
                            isExpanded
                              ? "expanded"
                              : ""
                          }`}
                        >
                          ›
                        </span>
                      </button>

                      <SiteIcon
                        icon={domain.icon}
                        domain={domain.domain}
                        error={domain.fetch_error}
                      />

                      <div className="domain-name">
                        <div className="site-url">
                          <span className="scheme">
                            {domain.scheme}://
                          </span>

                          <span>
                            {domain.domain}
                          </span>
                        </div>

                        {domain.title && (
                          <div className="site-title">
                            {domain.title}
                          </div>
                        )}
                      </div>

                      <select
                        className={`policy-select ${
                          APPROVAL_CLASSES[
                            toApproval(domain.approved)
                          ]
                        }`}
                        value={toApproval(
                          domain.approved,
                        )}
                        disabled={
                          updatingDomain === domain.id ||
                          deletingDomain === domain.id
                        }
                        aria-label={`Access policy for ${domain.domain}`}
                        title="Paths only: only listed paths can be opened, but they can load any resources they need from this domain"
                        onChange={(event) =>
                          void setDomainApproval(
                            domain,
                            fromApproval(
                              event.target
                                .value as Approval,
                            ),
                          )
                        }
                      >
                        {(
                          Object.keys(
                            APPROVAL_LABELS,
                          ) as Approval[]
                        ).map((approval) => (
                          <option
                            key={approval}
                            value={approval}
                          >
                            {APPROVAL_LABELS[approval]}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        className="delete-button"
                        disabled={
                          deletingDomain === domain.id
                        }
                        onClick={() =>
                          void handleDeleteDomain(domain)
                        }
                        aria-label={`Delete ${domain.domain}`}
                        title="Delete"
                      >
                        {deletingDomain === domain.id
                          ? "…"
                          : <TrashIcon />}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="path-list">
                        {!domainPaths ||
                        domainPaths.loading ? (
                          <div className="path-status">
                            Loading paths…
                          </div>
                        ) : domainPaths.error ? (
                          <div className="path-status path-error">
                            {
                              domainPaths.error
                            }
                          </div>
                        ) : domainPaths
                            .paths.length ===
                          0 ? (
                          <div className="path-status">
                            No paths found.
                          </div>
                        ) : (
                          domainPaths.paths.map(
                            (path) => {
                              const key = `${domain.id}:${path.id}`;

                              return (
                                <div
                                  className="path-row"
                                  key={
                                    path.id
                                  }
                                >
                                  <div
                                    className="path-name"
                                    title={
                                      path.fetch_error
                                        ? `Couldn't fetch page details: ${path.fetch_error}`
                                        : undefined
                                    }
                                  >
                                    <div className="path-url">
                                      {
                                        path.path
                                      }
                                    </div>

                                    {path.title && (
                                      <div className="site-title">
                                        {
                                          path.title
                                        }
                                      </div>
                                    )}
                                  </div>

                                  <span
                                    className={`policy-label ${
                                      path.approved
                                        ? "allowed"
                                        : "denied"
                                    }`}
                                  >
                                    {path.approved
                                      ? "Allowed"
                                      : "Denied"}
                                  </span>

                                  <Toggle
                                    checked={path.approved}
                                    disabled={
                                      updatingPath === key ||
                                      deletingPath === key
                                    }
                                    label={`Toggle ${path.path}`}
                                    onChange={() =>
                                      void togglePath(
                                        domain.id,
                                        path,
                                      )
                                    }
                                  />

                                  <button
                                    type="button"
                                    className="delete-button"
                                    disabled={deletingPath === key}
                                    onClick={() =>
                                      void handleDeletePath(
                                        domain.id,
                                        path,
                                      )
                                    }
                                    aria-label={`Delete ${path.path}`}
                                    title="Delete"
                                  >
                                    {deletingPath === key
                                      ? "…"
                                      : <TrashIcon />}
                                  </button>
                                </div>
                              );
                            },
                          )
                        )}
                      </div>
                    )}
                  </div>
                );
              },
            )}
          </div>
        )}
      </div>
    </div>
  );
}
