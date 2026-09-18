import { useEffect, useMemo, useState } from "react";
import {
  getMaintenanceHistory,
  getRoadMaintenance,
  getRoads,
  getWorkOrderHistory,
  getWorkOrders,
} from "./api";

function formatWhen(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function formatVal(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function actionLabel(action) {
  const map = {
    created: "Created",
    updated: "Updated",
    completed: "Completed",
    cancelled: "Cancelled",
    issued: "Issued",
    "in progress": "In progress",
  };
  return map[action] || action || "—";
}

function ChangeTable({ oldValues, newValues }) {
  const keys = useMemo(() => {
    const set = new Set([
      ...Object.keys(oldValues || {}),
      ...Object.keys(newValues || {}),
    ]);
    return Array.from(set).sort();
  }, [oldValues, newValues]);

  if (!keys.length) return <span className="muted">No field details</span>;

  return (
    <table className="audit-change-table">
      <thead>
        <tr>
          <th>Field</th>
          <th>Before</th>
          <th>After</th>
        </tr>
      </thead>
      <tbody>
        {keys.map((key) => (
          <tr key={key}>
            <td>{key}</td>
            <td>{formatVal(oldValues?.[key])}</td>
            <td>{formatVal(newValues?.[key])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function AuditHistory() {
  const [entityType, setEntityType] = useState("work_order");
  const [workOrders, setWorkOrders] = useState([]);
  const [activities, setActivities] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [history, setHistory] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingList(true);
      setMessage("");
      try {
        const [orders, roads] = await Promise.all([getWorkOrders(), getRoads()]);
        if (cancelled) return;
        setWorkOrders(orders || []);
        const maintLists = await Promise.all(
          (roads || []).map((r) => getRoadMaintenance(r.road_id).catch(() => [])),
        );
        if (cancelled) return;
        setActivities(maintLists.flat());
      } catch (err) {
        if (!cancelled) setMessage(err.message || String(err));
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSelectedId("");
    setHistory([]);
  }, [entityType]);

  const options = useMemo(() => {
    if (entityType === "work_order") {
      return (workOrders || []).map((o) => ({
        id: o.work_order_id,
        label: `${o.order_number || o.work_order_id} · ${o.status || ""}`,
      }));
    }
    return (activities || []).map((a) => ({
      id: a.maintenance_id,
      label: `#${a.maintenance_id} · ${a.activity_type || "activity"} · ${a.status || ""}`,
    }));
  }, [entityType, workOrders, activities]);

  async function loadHistory(event) {
    event?.preventDefault?.();
    if (!selectedId) return;
    setLoadingHistory(true);
    setMessage("");
    try {
      const rows =
        entityType === "work_order"
          ? await getWorkOrderHistory(Number(selectedId))
          : await getMaintenanceHistory(Number(selectedId));
      setHistory(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setHistory([]);
      setMessage(err.message || String(err));
    } finally {
      setLoadingHistory(false);
    }
  }

  return (
    <section className="panel audit-history">
      <div className="panel-heading">
        <h2>Audit history</h2>
        <p>Who changed work orders and maintenance activities, and what changed.</p>
      </div>

      <form className="form-grid" onSubmit={loadHistory} style={{ marginBottom: 16 }}>
        <label>
          Entity
          <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
            <option value="work_order">Work order</option>
            <option value="maintenance">Maintenance activity</option>
          </select>
        </label>
        <label>
          Record
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            disabled={loadingList}
            required
          >
            <option value="">{loadingList ? "Loading…" : "Select…"}</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <div className="button-row" style={{ alignItems: "end" }}>
          <button type="submit" disabled={!selectedId || loadingHistory}>
            {loadingHistory ? "Loading…" : "View history"}
          </button>
        </div>
      </form>

      {message && <p className="form-message">{message}</p>}

      {!loadingHistory && selectedId && history.length === 0 && !message && (
        <p>No history records for this item.</p>
      )}

      {history.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>User ID</th>
                <th>Changes</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.history_id}>
                  <td>{formatWhen(entry.changed_at)}</td>
                  <td>{actionLabel(entry.action)}</td>
                  <td>{entry.changed_by ?? "—"}</td>
                  <td>
                    <ChangeTable
                      oldValues={entry.old_values}
                      newValues={entry.new_values}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
