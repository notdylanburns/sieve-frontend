import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { login, UnauthorizedError } from "../api";
import { SieveMark } from "../components/Icons";

// Only follow same-site paths, so a crafted link can't bounce users elsewhere after login.
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export function Login() {
  const [params] = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await login(username.trim(), password);
      // A full navigation, so the app starts with the new session.
      window.location.assign(safeNext(params.get("next")));
    } catch (error) {
      setError(
        error instanceof UnauthorizedError
          ? "Incorrect username or password."
          : error instanceof Error
            ? error.message
            : "Failed to sign in",
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="login">
      <form className="login-card card" onSubmit={handleSubmit}>
        <div className="login-brand">
          <span className="brand-mark">
            <SieveMark size={18} />
          </span>
          Sieve
        </div>

        <h1>Sign in</h1>

        {error && <div className="alert alert-error">{error}</div>}

        <label className="field">
          <span>Username</span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        <button
          type="submit"
          className="button button-primary"
          disabled={submitting || !username.trim() || !password}
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
