import { useEffect, useState } from "react";
import App from "./App";
import InspectionWorkflowPanel from "./InspectionWorkflowPanel";
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
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Login failed");
      setToken(data.access_token);
      setUser(data);
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

  if (checking) return <div className="auth-screen"><div className="auth-card"><h1>RAMS</h1><p>Checking session…</p></div></div>;

  if (!user) {
    return (
      <div className="auth-screen">
        <form className="auth-card" onSubmit={handleLogin}>
          <div className="auth-logo">RAMS</div>
          <h1>Road Asset Management System</h1>
          <p className="auth-subtitle">Sign in to continue</p>
          <label>Username<input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required /></label>
          <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
          {error && <div className="auth-error">{error}</div>}
          <button className="auth-button" type="submit" disabled={loggingIn}>{loggingIn ? "Signing in…" : "Sign in"}</button>
        </form>
      </div>
    );
  }

  return (
    <>
      <div className="auth-userbar">
        <span>Signed in as <strong>{user.full_name || user.username}</strong> · {user.role}</span>
        <button type="button" onClick={logout}>Logout</button>
      </div>
      <App />
      <InspectionWorkflowPanel />
    </>
  );
}
