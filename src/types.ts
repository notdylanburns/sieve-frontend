export interface Video {
  id: number;
  url: string;
  download: boolean;
  title: string | null;
  uploader: string | null;
  duration: number | null;
  thumbnail: string | null;
  fetch_error: string | null;
}

export interface Domain {
  id: number;
  scheme: string;
  domain: string;
  approved: boolean | null;
  title: string | null;
  icon: string | null;
  fetch_error: string | null;
}

export interface DomainPath {
  id: number;
  path: string;
  approved: boolean;
  title: string | null;
  fetch_error: string | null;
}

export type Role = "owner" | "member";

export interface User {
  id: number;
  username: string;
}

export interface Membership {
  id: string;
  name: string;
  role: Role;
}

export interface Session {
  user: User;
  workspaces: Membership[];
}

export interface Device {
  id: string;
  workspace_id: string;
  name: string;
  proxy_username: string;
  revoked_at: string | null;
  created_at: string;
}

export interface CreatedDevice {
  device: Device;
  token: string;
  proxy_password: string;
}

export interface Invite {
  id: string;
  workspace_id: string;
  role: Role;
  created_by: string | null;
  created_at: string;
  expires_at: string;
  max_uses: number | null;
  uses: number;
  revoked_at: string | null;
  token: string;
}

export interface InvitePreview {
  workspace: { id: string; name: string };
  role: Role;
  invited_by: string | null;
  expires_at: string;
  membership: Role | null;
}

export interface AuditEntry {
  id: number;
  occurred_at: string;
  workspace_id: string | null;
  actor_kind: "user" | "device" | "cli" | "anonymous";
  actor_id: string | null;
  actor_label: string;
  action: string;
  target_kind: string | null;
  target_id: string | null;
  details: Record<string, unknown>;
  ip: string | null;
  user_agent: string | null;
}

export interface PaginationParams {
  offset: number;
  limit: number;
  search?: string;
}
