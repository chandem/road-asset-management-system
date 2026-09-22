import { useEffect, useMemo, useState } from "react";
import { getRoadMaintenance, getRoads } from "./api";
import MaintenanceTrends from "./MaintenanceTrends";

function money(value) {
  return `${(Number(value) || 0).toLocaleString()} ETB`;
}

const STATUS_META = {
  planned: { label: "Planned", tone: "planned", icon: "○" },
  "in progress": { label: "In progress", tone: "progress", icon: "◐" },
  completed: { label: "Completed", tone: "completed", icon: "✓" },
  cancelled: { label: "Cancelled", tone: "cancelled", icon: "×" },
  other: { label: "Other", tone: "other", icon: "•" },
};

const PRIORITY_META = {
  low: { label: "Low", tone: "low", icon: "↓" },
  medium: { label: "Medium", tone: "medium", icon: "→" },
  high: { label: "High", tone: "high", icon: "↑" },
  critical: { label: "Critical", tone: "critical", icon: "!" },
  other: { label: "Other", tone: "other", icon: "•" },
};

function CountRow({ name, value, metadata }) {
  const meta = metadata[name] || { label: name, tone: "other", icon: "•" };
  return (
    <div className="analytics-count-row">
      <span className={`analytics-count-icon ${meta.tone}`} aria-hidden="true">{meta.icon}</span>
      <span className="analytics-count-label">{meta.label}</span>
      <strong className={`analytics-count-badge ${meta.tone}`}>{value.toLocaleString()}</strong>
    </div>
  );
}

function CountCard({ title, values, metadata }) {
  const entries = Object.entries(values).filter(([key, value]) => key !== "other" || value);
  return (
    <div className="report-box analytics-count-card">
      <div className="analytics-count-card-heading">
        <h3>{title}</h3>
        <span className="analytics-count-total">
          {Object.values(values).reduce((sum, value) => sum + value, 0).toLocaleString()} total
        </span>
      </div>
      <div className="analytics-count-list">
        {entries.map(([key, value]) => (
          <CountRow key={key} name={key} value={value} metadata={metadata} />
        ))}
      </div>
    </div>
  );
}

export default function MaintenanceAnalytics() {
  const [roads, setRoads] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const roadList = await getRoads();
      const records = (await Promise.all(roadList.map((road) => getRoadMaintenance(road.road_id)))).flat();
      setRoads(roadList);
      setMaintenance(records);
    } catch (e) {
      setError(e.message || "Unable to load maintenance analytics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const report = useMemo(() => {
    const today = new Date();
    const status = { planned: 0, "in progress": 0, completed: 0, cancelled: 0, other: 0 };
    const priority = { low: 0, medium: 0, high: 0, critical: 0, other: 0 };
    const byType = {};
    const byRoad = {};
    let estimated = 0;
    let actual = 0;
    let overdue = 0;

    maintenance.forEach((item) => {
      const s = String(item.status || "other").toLowerCase();
      status[s] = (status[s] ?? 0) + 1;
      const p = String(item.priority || "other").toLowerCase();
      priority[p] = (priority[p] ?? 0) + 1;
      const type = item.activity_type || "Unknown";
      byType[type] = (byType[type] || 0) + 1;
      byRoad[item.road_id] = (byRoad[item.road_id] || 0) + 1;
      estimated += Number(item.estimated_cost) || 0;
      actual += Number(item.actual_cost) || 0;
      if (item.planned_date && s !== "completed" && s !== "cancelled" && new Date(item.planned_date) < today) overdue += 1;
    });

    const roadRows = roads.map((road) => ({
      ...road,
      count: byRoad[road.road_id] || 0,
      completed: maintenance.filter((x) => x.road_id === road.road_id && String(x.status).toLowerCase() === "completed").length,
      estimated: maintenance.filter((x) => x.road_id === road.road_id).reduce((sum, x) => sum + (Number(x.estimated_cost) || 0), 0),
      actual: maintenance.filter((x) => x.road_id === road.road_id).reduce((sum, x) => sum + (Number(x.actual_cost) || 0), 0),
    }));

    return { status, priority, byType, roadRows, estimated, actual, overdue };
  }, [maintenance, roads]);

  const maxType = Math.max(1, ...Object.values(report.byType));
  const completionRate = maintenance.length ? (report.status.completed / maintenance.length) * 100 : 0;
  const variance = report.actual - report.estimated;

  return (
    <section className="report-panel maintenance-analytics">
      <div className="panel-heading">
        <div>
          <h2>🛠️ Maintenance Analytics</h2>
          <p>Planned work, completion, costs, priorities and overdue activities across all roads.</p>
        </div>
        <button type="button" onClick={load} disabled={loading}>{loading ? "Loading…" : "Refresh Analytics"}</button>
      </div>

      {error && <div className="error-banner">Analytics error: {error}</div>}

      <div className="cards report-cards">
        <div className="card"><span>Total Activities</span><strong>{maintenance.length}</strong></div>
        <div className="card"><span>Completion Rate</span><strong>{completionRate.toFixed(1)}%</strong></div>
        <div className="card"><span>Overdue</span><strong>{report.overdue}</strong></div>
        <div className="card"><span>Estimated Cost</span><strong>{money(report.estimated)}</strong></div>
        <div className="card"><span>Actual Cost</span><strong>{money(report.actual)}</strong></div>
        <div className="card"><span>Cost Variance</span><strong>{money(variance)}</strong></div>
      </div>

      <div className="report-grid">
        <CountCard title="Status" values={report.status} metadata={STATUS_META} />
        <CountCard title="Priority" values={report.priority} metadata={PRIORITY_META} />
        <div className="report-box analytics-wide">
          <h3>Maintenance by Activity Type</h3>
          {Object.entries(report.byType).length === 0 && <p>No maintenance activities recorded.</p>}
          {Object.entries(report.byType).map(([type, value]) => (
            <div className="analytics-bar-row" key={type}>
              <span>{type}</span>
              <div className="analytics-bar"><i style={{ width: `${(value / maxType) * 100}%` }} /></div>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </div>

      <MaintenanceTrends maintenance={maintenance} />

      <div className="report-box">
        <h3>Road-by-Road Maintenance</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Road</th><th>Activities</th><th>Completed</th><th>Estimated</th><th>Actual</th></tr></thead>
            <tbody>
              {report.roadRows.map((road) => (
                <tr key={road.road_id}>
                  <td>{road.road_code} — {road.road_name}</td>
                  <td>{road.count}</td>
                  <td>{road.completed}</td>
                  <td>{money(road.estimated)}</td>
                  <td>{money(road.actual)}</td>
                </tr>
              ))}
              {!report.roadRows.length && <tr><td colSpan="5">No roads available.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
