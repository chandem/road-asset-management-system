import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import "./kpi.css";
import "./offline-ui.css";
import "./enhanced-ui.css";
import "./auth-ui.css";
import AuthGate from "./AuthGate";
import ErrorBoundary from "./components/ErrorBoundary";

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("RAMS service worker registration failed:", error);
    });
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthGate />
    </ErrorBoundary>
  </React.StrictMode>,
);
