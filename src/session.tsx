import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { getSession, loginUrl, logout as apiLogout, UnauthorizedError } from "./api";
import type { Session } from "./types";

interface SessionContextValue extends Session {
  /** Signs out, then shows the login page, returning to `next` after signing in again. */
  logout: (next?: string) => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSession()
      .then(setSession)
      .catch((error) => {
        // A 401 is already redirecting to the login page.
        if (!(error instanceof UnauthorizedError)) {
          setError(error instanceof Error ? error.message : "Failed to load session");
        }
      });
  }, []);

  const logout = useCallback(async (next = "/") => {
    try {
      await apiLogout();
    } finally {
      window.location.assign(loginUrl(next));
    }
  }, []);

  if (error) {
    return <div className="centered-message">{error}</div>;
  }

  if (!session) {
    return <div className="centered-message">Loading…</div>;
  }

  return (
    <SessionContext.Provider value={{ ...session, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const session = useContext(SessionContext);

  if (!session) {
    throw new Error("useSession must be used inside SessionProvider");
  }

  return session;
}
