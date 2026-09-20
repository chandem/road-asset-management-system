import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import "./kpi.css";
import AuthGate from "./AuthGate";

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("RAMS service worker registration failed:", error);
    });
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthGate />
  </React.StrictMode>,
);
