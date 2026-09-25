import { useEffect, useMemo, useState } from "react";
import { getMaintenanceEffectiveness, getRoadMaintenanceEffectiveness, getRoads } from "./api";
import EmptyState from "./components/EmptyState";

function money(value) {
  if (value == null || value === "") return "—";
  return `${Number(value).toLocaleString()} ETB`;
}

export default function MaintenanceEffectiveness() {
  const [roads, setRoads] = useState([]);
  const [roadId, setRoadId] = useState("");
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getRoads().then(setRoads).catch((err) => setMessage(err.message || String(err)));
  }, []);

  useEffect(() => {
    if (!roadId) {
      setData(null);
      return;
    }
    setLoading(true);
    setMessage("");
    getRoadMaintenanceEffectiveness(Number(roadId))
      .then(setData)
      .catch((err) => {
        setData(null);
        setMessage(err.message || String(err));
      })
      .finally(() => setLoading(false));
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

  const completionPct = data?.activity_count
    ? Math.round((data.completed_count / data.activity_count) * 100)
    : 0;
  const verificationPct = data?.activity_count
    ? Math.round((visualAnalytics.verified / data.activity_count) * 100)
    : 0;

  return (
    <section className="action-panel insight-page">
      <div className="insight-hero">
        <div>
          <span className="eyebrow">INSIGHTS</span>
          <h2>Maintenance Effectiveness</h2>
          <p>
            Compare planned versus actual cost and quantity, schedule performance,
            condition improvement, and verification results.
          </p>
        </div>
      </div>

      <div className="insight-selector panel">
        <div className="insight-selector-copy">
          <strong>Select a road</strong>
          <span>Effectiveness metrics are calculated from recorded maintenance on that road.</span>
        </div>
        <label className="insight-select-label">
          Road
          <select value={roadId} onChange={(e) => setRoadId(e.target.value)}>
            <option value="">Select a road</option>
            {roads.map((road) => (
              <option key={road.road_id} value={road.road_id}>
                {road.road_code ? `${road.road_code} — ` : ""}{road.road_name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!roadId && (
        <EmptyState title="Select a road to review effectiveness" icon="📈" tone="info">
          <p>
            Choose a road above to compare planned vs actual cost and quantity,
            schedule performance, condition improvement, and verification results.
          </p>
        </EmptyState>
      )}

      {roadId && loading && (
        <EmptyState title="Loading effectiveness…" icon="⟳" tone="info">
          <p>Fetching maintenance outcomes for this road.</p>
        </EmptyState>
      )}

      {roadId && !loading && !data && message && (
        <EmptyState title="Could not load effectiveness" icon="!" tone="info">
          <p>{message}</p>
        </EmptyState>
      )}

      {data && !loading && (
        <>
          <div className="insight-kpi-grid">
            <div className="insight-kpi">
              <span>Activities</span>
              <strong>{data.activity_count ?? 0}</strong>
              <small>recorded</small>
            </div>
            <div className="insight-kpi">
              <span>Completed</span>
              <strong>{data.completed_count ?? 0}</strong>
              <small>{completionPct}% done</small>
            </div>
            <div className="insight-kpi">
              <span>Estimated cost</span>
              <strong>{money(data.total_estimated_cost)}</strong>
              <small>planned</small>
            </div>
            <div className="insight-kpi">
              <span>Actual cost</span>
              <strong>{money(data.total_actual_cost)}</strong>
              <small>spent</small>
            </div>
            <div className="insight-kpi">
              <span>Cost variance</span>
              <strong>{money(data.total_cost_variance)}</strong>
              <small>actual − estimated</small>
            </div>
            <div className="insight-kpi">
              <span>Avg condition Δ</span>
              <strong>{data.average_condition_improvement ?? "—"}</strong>
              <small>improvement</small>
            </div>
            <div className="insight-kpi">
              <span>Measurable outcomes</span>
              <strong>{data.measurable_outcomes ?? 0}</strong>
              <small>with evidence</small>
            </div>
            <div className="insight-kpi">
              <span>Verification</span>
              <strong>{verificationPct}%</strong>
              <small>{visualAnalytics.verified} verified</small>
            </div>
          </div>

          <div className="insight-progress panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">EXECUTION</span>
                <h3>Completion & verification</h3>
              </div>
            </div>
            <div className="insight-progress-bars">
              <div className="insight-progress-row">
                <span>Completion</span>
                <div className="insight-bar-track" role="img" aria-label={`${completionPct}% complete`}>
                  <div className="insight-bar-fill" style={{ width: `${completionPct}%` }} />
                </div>
                <strong>{completionPct}%</strong>
              </div>
              <div className="insight-progress-row">
                <span>Verification</span>
                <div className="insight-bar-track" role="img" aria-label={`${verificationPct}% verified`}>
                  <div className="insight-bar-fill verified" style={{ width: `${verificationPct}%` }} />
                </div>
                <strong>{verificationPct}%</strong>
              </div>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Activity</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Est. cost</th>
                  <th>Actual cost</th>
                  <th>Cost variance</th>
                  <th>Planned qty</th>
                  <th>Actual qty</th>
                  <th>Qty variance</th>
                  <th>Delay (days)</th>
                  <th>Verification</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(data.activities || []).length === 0 ? (
                  <tr>
                    <td colSpan={13}>No activities match this road yet.</td>
                  </tr>
                ) : (
                  (data.activities || []).map((item) => (
                    <tr key={item.maintenance_id}>
                      <td>{item.maintenance_id}</td>
                      <td>{item.activity_type}</td>
                      <td>{item.status}</td>
                      <td>{item.priority || "—"}</td>
                      <td>{money(item.estimated_cost)}</td>
                      <td>{money(item.actual_cost)}</td>
                      <td>
                        {item.cost_variance_percent == null
                          ? item.cost_variance ?? "—"
                          : `${item.cost_variance} (${item.cost_variance_percent}%)`}
                      </td>
                      <td>{item.planned_quantity ?? "—"}</td>
                      <td>{item.actual_quantity ?? "—"}</td>
                      <td>
                        {item.quantity_variance_percent == null
                          ? item.quantity_variance ?? "—"
                          : `${item.quantity_variance ?? 0} (${item.quantity_variance_percent}%)`}
                      </td>
                      <td>{item.schedule_delay_days ?? 0}</td>
                      <td>{item.verification_result ?? "Not verified"}</td>
                      <td>
                        <button type="button" onClick={() => showDetails(item.maintenance_id)}>
                          Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selected && (
        <div className="action-panel insight-detail">
          <h3>Maintenance #{selected.maintenance_id}</h3>
          <p>
            <strong>Condition improvement:</strong>{" "}
            {selected.condition_improvement ?? "No measurable outcome"}
          </p>
          <p>
            <strong>Cost variance:</strong> {selected.cost_variance}{" "}
            ({selected.cost_variance_percent ?? "—"}%)
          </p>
          <p>
            <strong>Quantity:</strong> {selected.actual_quantity ?? "—"} /{" "}
            {selected.planned_quantity ?? "—"} {selected.quantity_unit || ""}
          </p>
          <p>
            <strong>Schedule delay:</strong> {selected.schedule_delay_days ?? 0} days
          </p>
          <p>
            <strong>Verification:</strong> {selected.verification_result ?? "Not verified"}
          </p>
          <button type="button" onClick={() => setSelected(null)}>
            Close
          </button>
        </div>
      )}

      {message && data && <p className="form-message">{message}</p>}
    </section>
  );
}
