import { createContext, useContext, useEffect } from "react";
import { Link, Navigate, Outlet, useParams } from "react-router-dom";

import { useSession } from "./session";
import type { Membership } from "./types";

const LAST_WORKSPACE_KEY = "sieve.workspace";

function readLastWorkspace() {
  try {
    return window.localStorage.getItem(LAST_WORKSPACE_KEY);
  } catch {
    return null;
  }
}

function writeLastWorkspace(id: string) {
  try {
    window.localStorage.setItem(LAST_WORKSPACE_KEY, id);
  } catch {
    // Storage can be unavailable (private windows); remembering is only a convenience.
  }
}

const WorkspaceContext = createContext<Membership | null>(null);

export function useWorkspace() {
  const workspace = useContext(WorkspaceContext);

  if (!workspace) {
    throw new Error("useWorkspace must be used inside a workspace route");
  }

  return workspace;
}

/** Sends `/` to the last workspace used, or the first one the user belongs to. */
export function DefaultWorkspace() {
  const { workspaces } = useSession();
  const last = readLastWorkspace();
  const workspace =
    workspaces.find((item) => item.id === last) ?? workspaces[0];

  if (!workspace) {
    return (
      <div className="empty-state">
        You aren't a member of any workspace yet. Ask an administrator to
        add you to one.
      </div>
    );
  }

  return <Navigate to={`/w/${workspace.id}/sites`} replace />;
}

/** Provides the workspace named in the URL to the pages below it. */
export function WorkspaceRoute() {
  const { workspace: id } = useParams();
  const { workspaces } = useSession();
  const workspace = workspaces.find((item) => item.id === id);

  useEffect(() => {
    if (workspace) {
      writeLastWorkspace(workspace.id);
    }
  }, [workspace]);

  if (!workspace) {
    return (
      <div className="empty-state">
        This workspace doesn't exist or you don't have access to it.
        <Link to="/">Go to your workspaces</Link>
      </div>
    );
  }

  return (
    <WorkspaceContext.Provider value={workspace}>
      {/* Keyed so switching workspace starts each page from a clean state. */}
      <Outlet key={workspace.id} />
    </WorkspaceContext.Provider>
  );
}

export function OwnerRoute() {
  const workspace = useWorkspace();

  if (workspace.role !== "owner") {
    return (
      <div className="empty-state">
        Only workspace owners can see this page.
      </div>
    );
  }

  return <Outlet />;
}
