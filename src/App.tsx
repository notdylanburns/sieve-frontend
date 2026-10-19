import { Navigate, Route, Routes } from "react-router-dom";

import { Layout } from "./components/Layout";
import { AcceptInvite } from "./pages/AcceptInvite";
import { AuditLog } from "./pages/AuditLog";
import { Devices } from "./pages/Devices";
import { Invites } from "./pages/Invites";
import { Login } from "./pages/Login";
import { Sites } from "./pages/Sites";
import { Videos } from "./pages/Videos";
import { SessionProvider } from "./session";
import { DefaultWorkspace, OwnerRoute, WorkspaceRoute } from "./workspace";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/invite/:token"
        element={
          <SessionProvider>
            <AcceptInvite />
          </SessionProvider>
        }
      />

      <Route
        element={
          <SessionProvider>
            <Layout />
          </SessionProvider>
        }
      >
        <Route path="/" element={<DefaultWorkspace />} />

        <Route path="/w/:workspace" element={<WorkspaceRoute />}>
          <Route index element={<Navigate to="sites" replace />} />
          <Route path="sites" element={<Sites />} />
          <Route path="videos" element={<Videos />} />

          <Route element={<OwnerRoute />}>
            <Route path="devices" element={<Devices />} />
            <Route path="invites" element={<Invites />} />
            <Route path="audit" element={<AuditLog />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
