import { useEffect, useMemo, useState } from "react";
import { getMaintenanceEffectiveness, getRoadMaintenanceEffectiveness, getRoads } from "./api";
import EmptyState from "./components/EmptyState";

export default function MaintenanceEffectiveness() {
  const [roads, setRoads] = useState([]);
  const [roadId, setRoadId] = useState("");
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    getRoads().then(setRoads).catch((err) => setMessage(err.message || String(err)));
  }, []);

  useEffect(() => {
    if (!roadId) { setData(null); return; }
    getRoadMaintenanceEffectiveness(Number(roadId))
      .then(setData)
      .catch((err) => {
        setData(null);
        setMessage(err.message || String(err));
      });
  }, [roadId]);

  const visualAnalytics = useMemo(() => {
    const activities = data?.activities || [];
    const verified = activities.filter((a) => a.verification_result).length;
    return { verified };
  }, [data]);

  async function showDetails(id) {
    try {
      const row = await getMaintenanceEffectiveness(id);
      setSelected(row);
    } catch (err) {
      setMessage(err.message || String(err));
    }
  }

  return (
    <section className="action-panel">
      <h2>Maintenance Effectiveness</h2>
      <p>Compare planned versus actual cost and quantity, schedule performance, condition improvement, and verification results.</p>
      <label>Road
        <select value={roadId} onChange={(e) => setRoadId(e.target.value)}>
          <option value="">Select a road</option>
          {roads.map((road) => <option key={road.road_id} value={road.road_id}>{road.road_name}</option>)}
        </select>
      </label>

      {!roadId && (
        <EmptyState title="Select a road to review effectiveness" icon="📈" tone="info">
          <p>
            Choose a road above to compare planned vs actual cost and quantity,
            schedule performance, condition improvement, and verification results.
          </p>
        </EmptyState>
      )}

      {roadId && !data && message && (
        <EmptyState title="Could not load effectiveness" icon="!" tone="info">
          <p>{message}</p>
        </EmptyState>
      )}

      {data && (
        <>
          <div className="summary-grid">
            <div><strong>Activities</strong><span>{data.activity_count}</span></div>
            <div><strong>Completed</strong><span>{data.completed_count}</span></div>
            <div><strong>Estimated cost</strong><span>{data.total_estimated_cost == null ? "—" : `${Number(data.total_estimated_cost).toLocaleString()} ETB`}</span></div>
            <div><strong>Actual cost</strong><span>{data.total_actual_cost == null ? "—" : `${Number(data.total_actual_cost).toLocaleString()} ETB`}</span></div>
            <div><strong>Cost variance</strong><span>{data.total_cost_variance == null ? "—" : `${Number(data.total_cost_variance).toLocaleString()} ETB`}</span></div>
            <div><strong>Avg condition improvement</strong><span>{data.average_condition_improvement ?? "—"}</span></div>
            <div><strong>Measurable outcomes</strong><span>{data.measurable_outcomes}</span></div>
          </div>

          <div className="action-panel">
            <h3>Visual analytics</h3>
            <p>Quick view of execution, cost, quantity, schedule, verification, and monthly performance trends for this road.</p>
            <div className="summary-grid">
              <div>
                <strong>Completion</strong>
                <span>{data.activity_count ? Math.round(data.completed_count / data.activity_count * 100) : 0}%</span>
                <div role="img" aria-label="Maintenance completion bar" style={{ background: "var(--panel-muted, #eee)", height: 10, borderRadius: 5, overflow: "hidden" }}>
                  <div style={{ width: `${data.activity_count ? Math.round(data.completed_count / data.activity_count * 100) : 0}%`, height: "100%", background: "currentColor" }} />
                </div>
              </div>
              <div>
                <strong>Verification</strong>
                <span>{data.activity_count ? Math.round(visualAnalytics.verified / data.activity_count * 100) : 0}%</span>
                <div role="img" aria-label="Maintenance verification bar" style={{ background: "var(--panel-muted, #eee)", height: 10, borderRadius: 5, overflow: "hidden" }}>
                  <div style={{ width: `${data.activity_count ? Math.round(visualAnalytics.verified / data.activity_count * 100) : 0}%`, height: "100%", background: "currentColor" }} />
                </div>
              </div>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Activity</th><th>Status</th><th>Priority</th><th>Est. cost</th><th>Actual cost</th><th>Cost variance</th><th>Planned qty</th><th>Actual qty</th><th>Qty variance</th><th>Delay (days)</th><th>Verification</th><th /></tr></thead>
              <tbody>
                {(data.activities || []).length === 0 ? (
                  <tr><td colSpan={13}>No activities match this road yet.</td></tr>
                ) : (data.activities || []).map((item) => (
                  <tr key={item.maintenance_id}>
                    <td>{item.maintenance_id}</td><td>{item.activity_type}</td><td>{item.status}</td>
                    <td>{item.priority || "—"}</td>
                    <td>{item.estimated_cost == null ? "—" : `${Number(item.estimated_cost).toLocaleString()} ETB`}</td>
                    <td>{item.actual_cost == null ? "—" : `${Number(item.actual_cost).toLocaleString()} ETB`}</td>
                    <td>{item.cost_variance_percent == null ? item.cost_variance : `${item.cost_variance} (${item.cost_variance_percent}%)`}</td>
                    <td>{item.planned_quantity ?? "—"}</td><td>{item.actual_quantity ?? "—"}</td>
                    <td>{item.quantity_variance_percent == null ? (item.quantity_variance ?? "—") : `${item.quantity_variance ?? 0} (${item.quantity_variance_percent}%)`}</td>
                    <td>{item.schedule_delay_days ?? 0}</td><td>{item.verification_result ?? "Not verified"}</td>
                    <td><button type="button" onClick={() => showDetails(item.maintenance_id)}>Details</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selected && <div className="action-panel">
        <h3>Maintenance #{selected.maintenance_id}</h3>
        <p><strong>Condition improvement:</strong> {selected.condition_improvement ?? "No measurable outcome"}</p>
        <p><strong>Cost variance:</strong> {selected.cost_variance} ({selected.cost_variance_percent ?? "—"}%)</p>
        <p><strong>Quantity:</strong> {selected.actual_quantity ?? "—"} / {selected.planned_quantity ?? "—"} {selected.quantity_unit || ""}</p>
        <p><strong>Schedule delay:</strong> {selected.schedule_delay_days ?? 0} days</p>
        <p><strong>Verification:</strong> {selected.verification_result ?? "Not verified"}</p>
        <button type="button" onClick={() => setSelected(null)}>Close</button>
      </div>}

      {message && <p className="form-message">{message}</p>}
    </section>
  );
}
