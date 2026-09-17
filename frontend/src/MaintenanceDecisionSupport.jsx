import { useEffect, useState } from "react";
import { getMaintenanceDecisionSupport, getRoads } from "./api";

export default function MaintenanceDecisionSupport() {
  const [roads, setRoads] = useState([]);
  const [roadId, setRoadId] = useState("");
  const [data, setData] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    getRoads().then(setRoads).catch((error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    if (!roadId) {
      setData(null);
      return;
    }
    setMessage("");
    getMaintenanceDecisionSupport(Number(roadId))
      .then(setData)
      .catch((error) => setMessage(error.message));
  }, [roadId]);

  return (
    <section className="action-panel">
      <h2>Maintenance Decision Support</h2>
      <p>
        Combine recorded condition outcomes and maintenance costs to support
        evidence-based maintenance planning. Metrics are descriptive and depend
        on the inspections recorded in RAMS.
      </p>

      <label>
        Road
        <select value={roadId} onChange={(event) => setRoadId(event.target.value)}>
          <option value="">Select a road</option>
          {roads.map((road) => (
            <option key={road.road_id} value={road.road_id}>{road.road_name}</option>
          ))}
        </select>
      </label>

      {data && (
        <>
          <div className="summary-grid">
            <div><strong>Activities</strong><span>{data.activity_count}</span></div>
            <div><strong>Completed</strong><span>{data.completed_count}</span></div>
            <div><strong>Measured outcomes</strong><span>{data.measurable_outcomes}</span></div>
            <div><strong>Actual cost</strong><span>{data.total_actual_cost}</span></div>
            <div><strong>Cost variance</strong><span>{data.total_cost_variance}</span></div>
            <div><strong>Avg improvement</strong><span>{data.average_condition_improvement ?? "—"}</span></div>
            <div><strong>Avg cost / condition point</strong><span>{data.average_cost_per_condition_point ?? "—"}</span></div>
          </div>

          <h3>Activities by measured efficiency</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>ID</th><th>Activity</th><th>Priority</th><th>Actual cost</th><th>Improvement</th><th>Cost / point</th><th>Evidence</th></tr>
              </thead>
              <tbody>
                {data.by_efficiency.map((item) => (
                  <tr key={item.maintenance_id}>
                    <td>{item.maintenance_id}</td>
                    <td>{item.activity_type}</td>
                    <td>{item.priority || "—"}</td>
                    <td>{item.actual_cost}</td>
                    <td>{item.condition_improvement}</td>
                    <td>{item.cost_per_condition_point}</td>
                    <td>{item.evidence_status}</td>
                  </tr>
                ))}
                {!data.by_efficiency.length && (
                  <tr><td colSpan="7">No activities have enough recorded outcome data for an efficiency measure.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <h3>High cost with no positive measured outcome</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>ID</th><th>Activity</th><th>Estimated</th><th>Actual</th><th>Variance</th><th>Outcome</th></tr>
              </thead>
              <tbody>
                {data.high_cost_low_outcome.map((item) => (
                  <tr key={item.maintenance_id}>
                    <td>{item.maintenance_id}</td>
                    <td>{item.activity_type}</td>
                    <td>{item.estimated_cost}</td>
                    <td>{item.actual_cost}</td>
                    <td>{item.cost_variance}</td>
                    <td>{item.evidence_status}</td>
                  </tr>
                ))}
                {!data.high_cost_low_outcome.length && (
                  <tr><td colSpan="6">No activities currently match this factual flag.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {message && <p className="form-message">{message}</p>}
    </section>
  );
}
