import { useEffect, useMemo, useState } from "react";
import { getMaintenanceEffectiveness, getRoadMaintenanceEffectiveness, getRoads } from "./api";

export default function MaintenanceEffectiveness() {
  const [roads, setRoads] = useState([]);
  const [roadId, setRoadId] = useState("");
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    getRoads().then(setRoads).catch((error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    if (!roadId) { setData(null); return; }
    getRoadMaintenanceEffectiveness(Number(roadId))
      .then(setData)
      .catch((error) => setMessage(error.message));
  }, [roadId]);

  async function showDetails(id) {
    try { setSelected(await getMaintenanceEffectiveness(id)); }
    catch (error) { setMessage(error.message); }
  }

  const visualAnalytics = useMemo(() => {
    const activities = data?.activities || [];
    const maxCost = Math.max(...activities.map((item) => Number(item.estimated_cost) || 0), 1);
    const maxQuantity = Math.max(...activities.map((item) => Number(item.planned_quantity) || 0), 1);
    const maxDelay = Math.max(...activities.map((item) => Number(item.schedule_delay_days) || 0), 1);
    const completed = activities.filter((item) => item.status === "completed").length;
    const verified = activities.filter((item) => item.verification_result).length;

    const byMonth = new Map();
    activities.forEach((item) => {
      const date = item.completed_date || item.planned_date;
      if (!date) return;
      const month = String(date).slice(0, 7);
      const row = byMonth.get(month) || {
        month, activities: 0, completed: 0, verified: 0, estimated: 0, actual: 0, delay: 0,
      };
      row.activities += 1;
      row.completed += item.status === "completed" ? 1 : 0;
      row.verified += item.verification_result ? 1 : 0;
      row.estimated += Number(item.estimated_cost) || 0;
      row.actual += Number(item.actual_cost) || 0;
      row.delay += Number(item.schedule_delay_days) || 0;
      byMonth.set(month, row);
    });

    const trends = [...byMonth.values()]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((row) => ({
        ...row,
        completion: row.activities ? Math.round(row.completed / row.activities * 100) : 0,
        verification: row.activities ? Math.round(row.verified / row.activities * 100) : 0,
        costVariance: Math.round((row.actual - row.estimated) * 100) / 100,
        avgDelay: row.activities ? Math.round(row.delay / row.activities * 10) / 10 : 0,
      }));

    const maxTrendCost = Math.max(...trends.flatMap((row) => [row.estimated, row.actual]), 1);
    return { activities, maxCost, maxQuantity, maxDelay, completed, verified, trends, maxTrendCost };
  }, [data]);

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

      {data && (
        <>
          <div className="summary-grid">
            <div><strong>Activities</strong><span>{data.activity_count}</span></div>
            <div><strong>Completed</strong><span>{data.completed_count}</span></div>
            <div><strong>Estimated cost</strong><span>{data.total_estimated_cost}</span></div>
            <div><strong>Actual cost</strong><span>{data.total_actual_cost}</span></div>
            <div><strong>Cost variance</strong><span>{data.total_cost_variance}</span></div>
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

            {visualAnalytics.trends.length > 0 && (
              <div className="table-wrap">
                <h4>Monthly trend</h4>
                <table>
                  <thead><tr><th>Month</th><th>Completion</th><th>Verification</th><th>Planned cost</th><th>Actual cost</th><th>Avg delay</th></tr></thead>
                  <tbody>
                    {visualAnalytics.trends.map((row) => (
                      <tr key={row.month}>
                        <td>{row.month}</td>
                        <td>
                          <div style={{ minWidth: 120, background: "var(--panel-muted, #eee)", height: 8 }}>
                            <div style={{ width: `${row.completion}%`, height: "100%", background: "currentColor" }} />
                          </div>
                          <small>{row.completion}%</small>
                        </td>
                        <td>
                          <div style={{ minWidth: 120, background: "var(--panel-muted, #eee)", height: 8 }}>
                            <div style={{ width: `${row.verification}%`, height: "100%", background: "currentColor" }} />
                          </div>
                          <small>{row.verification}%</small>
                        </td>
                        <td>{row.estimated.toFixed(2)}</td>
                        <td>{row.actual.toFixed(2)} ({row.costVariance >= 0 ? "+" : ""}{row.costVariance.toFixed(2)})</td>
                        <td>{row.avgDelay} days</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="table-wrap">
              <table>
                <thead><tr><th>Activity</th><th>Cost planned / actual</th><th>Quantity planned / actual</th><th>Schedule delay</th></tr></thead>
                <tbody>
                  {visualAnalytics.activities.map((item) => {
                    const plannedCost = Number(item.estimated_cost) || 0;
                    const actualCost = Number(item.actual_cost) || 0;
                    const plannedQty = Number(item.planned_quantity) || 0;
                    const actualQty = Number(item.actual_quantity) || 0;
                    const delay = Number(item.schedule_delay_days) || 0;
                    return (
                      <tr key={item.maintenance_id}>
                        <td>{item.activity_type}</td>
                        <td>
                          <div title={`Planned: ${plannedCost}; Actual: ${actualCost}`} style={{ minWidth: 150 }}>
                            <div style={{ width: `${Math.min(plannedCost / visualAnalytics.maxCost * 100, 100)}%`, height: 8, background: "currentColor", opacity: 0.35, marginBottom: 3 }} />
                            <div style={{ width: `${Math.min(actualCost / visualAnalytics.maxCost * 100, 100)}%`, height: 8, background: "currentColor" }} />
                          </div>
                          <small>{item.estimated_cost} / {item.actual_cost}</small>
                        </td>
                        <td>
                          <div title={`Planned: ${plannedQty}; Actual: ${actualQty}`} style={{ minWidth: 150 }}>
                            <div style={{ width: `${Math.min(plannedQty / visualAnalytics.maxQuantity * 100, 100)}%`, height: 8, background: "currentColor", opacity: 0.35, marginBottom: 3 }} />
                            <div style={{ width: `${Math.min(actualQty / visualAnalytics.maxQuantity * 100, 100)}%`, height: 8, background: "currentColor" }} />
                          </div>
                          <small>{item.planned_quantity ?? "—"} / {item.actual_quantity ?? "—"} {item.quantity_unit || ""}</small>
                        </td>
                        <td>
                          <div title={`${delay} day delay`} style={{ width: "100%", maxWidth: 150, background: "var(--panel-muted, #eee)", height: 8 }}>
                            <div style={{ width: `${Math.min(delay / visualAnalytics.maxDelay * 100, 100)}%`, height: "100%", background: "currentColor" }} />
                          </div>
                          <small>{delay} days</small>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Activity</th><th>Status</th><th>Priority</th><th>Est. cost</th><th>Actual cost</th><th>Cost variance</th><th>Planned qty</th><th>Actual qty</th><th>Qty variance</th><th>Delay (days)</th><th>Verification</th><th /></tr></thead>
              <tbody>
                {data.activities.map((item) => (
                  <tr key={item.maintenance_id}>
                    <td>{item.maintenance_id}</td><td>{item.activity_type}</td><td>{item.status}</td>
                    <td>{item.priority || "—"}</td><td>{item.estimated_cost}</td><td>{item.actual_cost}</td>
                    <td>{item.cost_variance_percent == null ? item.cost_variance : `${item.cost_variance} (${item.cost_variance_percent}%)`}</td>
                    <td>{item.planned_quantity ?? "—"}</td><td>{item.actual_quantity ?? "—"}</td><td>{item.quantity_variance_percent == null ? (item.quantity_variance ?? "—") : `${item.quantity_variance ?? 0} (${item.quantity_variance_percent}%)`}</td>
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
