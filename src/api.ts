import type {
  AuditEntry,
  CreatedDevice,
  Device,
  Domain,
  DomainPath,
  Invite,
  InvitePreview,
  Membership,
  Role,
  Session,
  Video,
} from "./types";

export class UnauthorizedError extends Error {
  constructor() {
    super("Your session has expired. Please sign in again.");
  }
}

export function loginUrl(next = window.location.pathname + window.location.search) {
  return next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`;
}

interface RequestOptions extends RequestInit {
  // The login form handles its own 401s (wrong password) instead of redirecting.
  redirectOnUnauthorized?: boolean;
}

async function request<T>(
  input: RequestInfo | URL,
  { redirectOnUnauthorized = true, ...init }: RequestOptions = {},
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (response.status === 401) {
    if (redirectOnUnauthorized) {
      window.location.assign(loginUrl());
    }
    throw new UnauthorizedError();
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    const text = await response.text().catch(() => "");

    try {
      const body = JSON.parse(text);

      if (typeof body?.message === "string") {
        message = body.message;
      } else if (typeof body?.error === "string") {
        message = body.error;
      }
    } catch {
      if (text) {
        message = text;
      }
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function workspaceUrl(workspace: string, path: string) {
  return `/api/${encodeURIComponent(workspace)}${path}`;
}

export async function login(
  username: string,
  password: string,
): Promise<Session> {
  return request<Session>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
    redirectOnUnauthorized: false,
  });
}

export async function getProviders(): Promise<{ google: boolean }> {
  return request("/api/auth/providers", { redirectOnUnauthorized: false });
}

/** A page navigation, not a fetch: it leaves for Google's sign-in page. */
export function googleSignInUrl(next: string) {
  return `/auth/google?next=${encodeURIComponent(next)}`;
}

export async function logout(): Promise<void> {
  await request<void>("/api/auth/logout", {
    method: "POST",
  });
}

export async function getSession(): Promise<Session> {
  return request<Session>("/api/auth/me");
}

export async function getVideos(workspace: string): Promise<Video[]> {
  return request<Video[]>(workspaceUrl(workspace, "/videos"));
}

export async function createVideo(
  workspace: string,
  url: string,
): Promise<Video> {
  return request<Video>(workspaceUrl(workspace, "/videos"), {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export async function deleteVideo(
  workspace: string,
  id: number,
): Promise<void> {
  await request<void>(workspaceUrl(workspace, `/videos/${id}`), {
    method: "DELETE",
  });
}

export async function getDomains(workspace: string): Promise<Domain[]> {
  return request<Domain[]>(workspaceUrl(workspace, "/sites/domains"));
}

export async function getDomainPaths(
  workspace: string,
  domainId: number,
): Promise<DomainPath[]> {
  return request<DomainPath[]>(
    workspaceUrl(workspace, `/sites/domains/${domainId}/paths`),
  );
}

export async function setDomainApproved(
  workspace: string,
  domainId: number,
  approved: boolean | null,
): Promise<void> {
  await request<void>(workspaceUrl(workspace, `/sites/domains/${domainId}`), {
    method: "PATCH",
    body: JSON.stringify({ approved }),
  });
}

export async function setPathApproved(
  workspace: string,
  domainId: number,
  pathId: number,
  approved: boolean,
): Promise<void> {
  await request<void>(
    workspaceUrl(workspace, `/sites/domains/${domainId}/paths/${pathId}`),
    {
      method: "PATCH",
      body: JSON.stringify({ approved }),
    },
  );
}

export async function createDomain(
  workspace: string,
  scheme: string,
  domain: string,
  approved: boolean | null,
): Promise<Domain> {
  return request<Domain>(workspaceUrl(workspace, "/sites/domains"), {
    method: "POST",
    body: JSON.stringify({
      scheme,
      domain,
      approved,
    }),
  });
}

export async function createDomainPath(
  workspace: string,
  domainId: number,
  path: string,
  approved: boolean,
): Promise<DomainPath> {
  return request<DomainPath>(
    workspaceUrl(workspace, `/sites/domains/${domainId}/paths`),
    {
      method: "POST",
      body: JSON.stringify({
        path,
        approved,
      }),
    },
  );
}

export async function deleteDomain(
  workspace: string,
  domainId: number,
): Promise<void> {
  await request<void>(
    workspaceUrl(workspace, `/sites/domains/${domainId}`),
    {
      method: "DELETE",
    },
  );
}

export async function deleteDomainPath(
  workspace: string,
  domainId: number,
  pathId: number,
): Promise<void> {
  await request<void>(
    workspaceUrl(workspace, `/sites/domains/${domainId}/paths/${pathId}`),
    {
      method: "DELETE",
    },
  );
}

export async function getDevices(workspace: string): Promise<Device[]> {
  return request<Device[]>(workspaceUrl(workspace, "/devices"));
}

export async function createDevice(
  workspace: string,
  name: string,
): Promise<CreatedDevice> {
  return request<CreatedDevice>(workspaceUrl(workspace, "/devices"), {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function revokeDevice(
  workspace: string,
  deviceId: string,
): Promise<Device> {
  return request<Device>(workspaceUrl(workspace, `/devices/${deviceId}`), {
    method: "DELETE",
  });
}

export async function getInvites(workspace: string): Promise<Invite[]> {
  return request<Invite[]>(workspaceUrl(workspace, "/invites"));
}

export interface InviteOptions {
  role: Role;
  expires_in_days: number;
  max_uses: number | null;
}

export async function createInvite(
  workspace: string,
  options: InviteOptions,
): Promise<Invite> {
  return request<Invite>(workspaceUrl(workspace, "/invites"), {
    method: "POST",
    body: JSON.stringify(options),
  });
}

export async function revokeInvite(
  workspace: string,
  inviteId: string,
): Promise<void> {
  await request<unknown>(workspaceUrl(workspace, `/invites/${inviteId}`), {
    method: "DELETE",
  });
}

export async function getInvitePreview(token: string): Promise<InvitePreview> {
  return request<InvitePreview>(`/api/invites/${encodeURIComponent(token)}`);
}

export async function acceptInvite(token: string): Promise<Membership> {
  return request<Membership>(`/api/invites/${encodeURIComponent(token)}/accept`, {
    method: "POST",
  });
}

export function inviteUrl(token: string) {
  return `${window.location.origin}/invite/${token}`;
}

export interface AuditQuery {
  before?: number;
  limit?: number;
  action?: string;
  actor?: string;
}

export async function getAuditLog(
  workspace: string,
  query: AuditQuery = {},
): Promise<AuditEntry[]> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }

  const search = params.size > 0 ? `?${params}` : "";
  return request<AuditEntry[]>(workspaceUrl(workspace, `/audit${search}`));
}

export function eventsUrl(workspace: string) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${workspaceUrl(workspace, "/events")}`;
}
