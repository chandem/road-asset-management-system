import { useEffect, useState } from "react";
import { getMaintenanceDecisionSupport, getRoads } from "./api";
import EmptyState from "./components/EmptyState";

function money(value) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return `${n.toLocaleString()} ETB`;
}

export default function MaintenanceDecisionSupport() {
  const [roads, setRoads] = useState([]);
  const [roadId, setRoadId] = useState("");
  const [data, setData] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getRoads().then(setRoads).catch((error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    if (!roadId) {
      setData(null);
      return;
    }
    setMessage("");
    setLoading(true);
    getMaintenanceDecisionSupport(Number(roadId))
      .then(setData)
      .catch((error) => {
        setData(null);
        setMessage(error.message);
      })
      .finally(() => setLoading(false));
  }, [roadId]);

  return (
    <section className="action-panel insight-page">
      <div className="insight-hero">
        <div>
          <span className="eyebrow">INSIGHTS</span>
          <h2>Maintenance Decision Support</h2>
          <p>
            Combine recorded condition outcomes and maintenance costs to support
            evidence-based maintenance planning. Metrics are descriptive and depend
            on the inspections recorded in RoadMI.
          </p>
        </div>
      </div>

      <div className="insight-selector panel">
        <div className="insight-selector-copy">
          <strong>Select a road</strong>
          <span>Decision metrics use completed maintenance and inspection outcomes.</span>
        </div>
        <label className="insight-select-label">
          Road
          <select value={roadId} onChange={(event) => setRoadId(event.target.value)}>
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
        <EmptyState
          title="Select a road to open decision support"
          icon="◎"
          tone="info"
        >
          <p>
            Choose a road above to see measured outcomes, cost efficiency, and
            high-cost activities with weak recorded results.
          </p>
        </EmptyState>
      )}

      {roadId && loading && (
        <EmptyState title="Loading decision support…" icon="⟳" tone="info">
          <p>Computing efficiency and outcome metrics for this road.</p>
        </EmptyState>
      )}

      {roadId && !loading && !data && message && (
        <EmptyState title="Could not load decision support" icon="!" tone="info">
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
              <small>finished</small>
            </div>
            <div className="insight-kpi">
              <span>Measured outcomes</span>
              <strong>{data.measurable_outcomes ?? 0}</strong>
              <small>with evidence</small>
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
              <span>Avg improvement</span>
              <strong>{data.average_condition_improvement ?? "—"}</strong>
              <small>condition points</small>
            </div>
            <div className="insight-kpi">
              <span>Avg cost / point</span>
              <strong>
                {data.average_cost_per_condition_point == null
                  ? "—"
                  : money(data.average_cost_per_condition_point)}
              </strong>
              <small>efficiency</small>
            </div>
          </div>

          <div className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">EFFICIENCY</span>
                <h3>Activities by measured efficiency</h3>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Activity</th>
                    <th>Priority</th>
                    <th>Actual cost</th>
                    <th>Improvement</th>
                    <th>Cost / point</th>
                    <th>Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.by_efficiency || []).map((item) => (
                    <tr key={item.maintenance_id}>
                      <td>{item.maintenance_id}</td>
                      <td>{item.activity_type}</td>
                      <td>{item.priority || "—"}</td>
                      <td>{money(item.actual_cost)}</td>
                      <td>{item.condition_improvement ?? "—"}</td>
                      <td>
                        {item.cost_per_condition_point == null
                          ? "—"
                          : money(item.cost_per_condition_point)}
                      </td>
                      <td>{item.evidence_status}</td>
                    </tr>
                  ))}
                  {!(data.by_efficiency || []).length && (
                    <tr>
                      <td colSpan="7">
                        No activities have enough recorded outcome data for an efficiency measure.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">FLAGS</span>
                <h3>High cost with no positive measured outcome</h3>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Activity</th>
                    <th>Estimated</th>
                    <th>Actual</th>
                    <th>Variance</th>
                    <th>Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.high_cost_low_outcome || []).map((item) => (
                    <tr key={item.maintenance_id}>
                      <td>{item.maintenance_id}</td>
                      <td>{item.activity_type}</td>
                      <td>{money(item.estimated_cost)}</td>
                      <td>{money(item.actual_cost)}</td>
                      <td>{money(item.cost_variance)}</td>
                      <td>{item.evidence_status}</td>
                    </tr>
                  ))}
                  {!(data.high_cost_low_outcome || []).length && (
                    <tr>
                      <td colSpan="6">No activities currently match this factual flag.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {message && data && <p className="form-message">{message}</p>}
    </section>
  );
}
