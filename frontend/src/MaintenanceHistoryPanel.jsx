import { useState } from "react";
import { getMaintenanceHistory } from "./api";

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function actionLabel(action) {
  return {
    created: "📝 Created",
    updated: "✏️ Updated",
    completed: "✅ Completed",
    cancelled: "❌ Cancelled",
  }[action] || action;
}

export default function MaintenanceHistoryPanel() {
  const [maintenanceId, setMaintenanceId] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadHistory(event) {
    event.preventDefault();
    if (!maintenanceId) return;
    setLoading(true);
    setError("");
    try {
      setHistory(await getMaintenanceHistory(Number(maintenanceId)));
    } catch (err) {
      setHistory([]);
      setError(err.message || "Unable to load maintenance history");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="report-panel maintenance-history-panel" style={{ margin: "24px 0" }}>
      <div className="panel-heading">
        <div>
          <h2>🕐 Maintenance History</h2>
          <p>Audit timeline showing maintenance changes, users, timestamps, and value changes.</p>
        </div>
      </div>

      <form onSubmit={loadHistory} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end", marginBottom: 18 }}>
        <label style={{ minWidth: 220 }}>
          Maintenance ID
          <input type="number" min="1" value={maintenanceId} onChange={(event) => setMaintenanceId(event.target.value)} placeholder="e.g. 1" required />
        </label>
        <button type="submit" disabled={loading}>{loading ? "Loading…" : "View History"}</button>
      </form>

      {error && <div className="error-banner">{error}</div>}

      {!error && maintenanceId && !loading && history.length === 0 && (
        <div className="report-box"><p>No history records found for maintenance #{maintenanceId}.</p></div>
      )}

      {history.length > 0 && (
        <div className="maintenance-history-list">
          {history.map((entry) => {
            const changes = entry.new_values && typeof entry.new_values === "object"
              ? entry.new_values
              : {};
            const isChangedField = Object.values(changes).some((value) => value && typeof value === "object" && ("old" in value || "new" in value));

            return (
              <article className="maintenance-history-item" key={entry.history_id}>
                <div className="maintenance-history-header">
                  <strong>{actionLabel(entry.action)}</strong>
                  <span>{formatDate(entry.changed_at)}</span>
                </div>
                <div className="maintenance-history-meta">
                  Changed by user #{entry.changed_by ?? "unknown"}
                </div>

                {isChangedField ? (
                  <div className="maintenance-history-changes">
                    {Object.entries(changes).map(([field, value]) => (
                      <div className="maintenance-history-change" key={field}>
                        <strong>{field}</strong>
                        <span>{formatValue(value?.old)} → {formatValue(value?.new)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <details>
                    <summary>View recorded values</summary>
                    <pre>{JSON.stringify(entry.new_values, null, 2)}</pre>
                  </details>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
