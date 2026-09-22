import { useEffect, useState } from "react";
import App from "./App";
import { API_BASE } from "./api";
import { clearToken, getToken, setToken } from "./auth";

export default function AuthGate() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setChecking(false);
      return;
    }
    fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error("Session expired");
        return response.json();
      })
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setChecking(false));
  }, []);

  async function handleLogin(event) {
    event.preventDefault();
    setLoggingIn(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = typeof data.detail === "string" ? data.detail : "Login failed";
        throw new Error(detail);
      }
      if (!data.access_token) {
        throw new Error("Login response missing access token");
      }
      setToken(data.access_token);
      // LoginResponse is flat: access_token + user fields (not nested under .user)
      setUser({
        user_id: data.user_id,
        username: data.username,
        full_name: data.full_name,
        role: data.role,
      });
      setPassword("");
    } catch (err) {
      setError(err.message || "Unable to log in");
    } finally {
      setLoggingIn(false);
    }
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  if (checking) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-logo">RAMS</div>
          <h1>Road Asset Management System</h1>
          <p className="auth-subtitle">Restoring your session…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="auth-screen">
        <form className="auth-card" onSubmit={handleLogin}>
          <div className="auth-logo">RAMS</div>
          <h1>Road Asset Management System</h1>
          <p className="auth-subtitle">Sign in to manage roads, assets, and field work</p>
          <label>
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              placeholder="admin"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              placeholder="••••••••"
            />
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button className="auth-button" type="submit" disabled={loggingIn}>
            {loggingIn ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    );
  }

  // App owns chrome (topbar + userbar). Pass authUser + logout handler.
  return <App authUser={user} onLogout={logout} />;
}
