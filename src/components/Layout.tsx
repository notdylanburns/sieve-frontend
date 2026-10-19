import { NavLink, Outlet, useLocation, useMatch, useNavigate } from "react-router-dom";

import { useSession } from "../session";
import { SieveMark } from "./Icons";

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
    >
      {children}
    </NavLink>
  );
}

export function Layout() {
  const { user, workspaces, logout } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const match = useMatch("/w/:workspace/*");

  const workspaceId = match?.params.workspace;
  const workspace = workspaces.find((item) => item.id === workspaceId);
  const base = workspace ? `/w/${workspace.id}` : null;

  function switchWorkspace(id: string) {
    // Stay on the same page in the other workspace, unless it's one they can't see there.
    const section = location.pathname.split("/")[3] ?? "sites";
    const target = workspaces.find((item) => item.id === id);
    const ownerOnly = ["devices", "invites", "audit"].includes(section);
    navigate(
      `/w/${id}/${ownerOnly && target?.role !== "owner" ? "sites" : section}`,
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <NavLink to={base ? `${base}/sites` : "/"} className="brand">
            <span className="brand-mark">
              <SieveMark size={18} />
            </span>
            Sieve
          </NavLink>

          {base && (
            <nav className="nav">
              <NavItem to={`${base}/sites`}>Sites</NavItem>
              <NavItem to={`${base}/videos`}>Videos</NavItem>
              {workspace?.role === "owner" && (
                <>
                  <NavItem to={`${base}/devices`}>Devices</NavItem>
                  <NavItem to={`${base}/invites`}>Invites</NavItem>
                  <NavItem to={`${base}/audit`}>Audit log</NavItem>
                </>
              )}
            </nav>
          )}

          <div className="header-end">
            {workspaces.length > 1 && workspace ? (
              <select
                className="workspace-switcher"
                value={workspace.id}
                onChange={(event) => switchWorkspace(event.target.value)}
                aria-label="Workspace"
              >
                {workspaces.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            ) : (
              workspace && <span className="workspace-name">{workspace.name}</span>
            )}

            <span className="header-user">{user.username}</span>

            <button
              type="button"
              className="header-button"
              onClick={() => void logout()}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
