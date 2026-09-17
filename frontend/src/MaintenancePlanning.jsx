import { useEffect, useMemo, useState } from "react";
import {
  assignMaintenanceToPlan,
  createMaintenancePlan,
  getMaintenancePlanActivities,
  getMaintenancePlanOptimization,
  getMaintenancePlanSummary,
  getMaintenancePlans,
  getRoadMaintenance,
  getRoads,
  unassignMaintenanceFromPlan,
} from "./api";

export default function MaintenancePlanning() {
  const [plans, setPlans] = useState([]);
  const [roads, setRoads] = useState([]);
  const [activities, setActivities] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [planActivities, setPlanActivities] = useState([]);
  const [summary, setSummary] = useState(null);
  const [optimization, setOptimization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    plan_year: new Date().getFullYear(),
    name: "Annual Road Maintenance Plan",
    budget: "",
    start_date: `${new Date().getFullYear()}-01-01`,
    end_date: `${new Date().getFullYear()}-12-31`,
    description: "",
  });

  async function load() {
    setLoading(true);
    try {
      const [p, r] = await Promise.all([getMaintenancePlans(), getRoads()]);
      const roadMaintenance = await Promise.all(r.map((road) => getRoadMaintenance(road.road_id)));
      setPlans(p);
      setRoads(r);
      setActivities(roadMaintenance.flat());
      if (!selectedPlanId && p.length) setSelectedPlanId(String(p[0].plan_id));
    } catch (error) {
      setMessage(`Planning load error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function loadPlan(planId) {
    if (!planId) {
      setPlanActivities([]);
      setSummary(null);
      setOptimization(null);
      return;
    }
    try {
      const [pa, s, o] = await Promise.all([
        getMaintenancePlanActivities(Number(planId)),
        getMaintenancePlanSummary(Number(planId)),
        getMaintenancePlanOptimization(Number(planId)),
      ]);
      setPlanActivities(pa);
      setSummary(s);
      setOptimization(o);
    } catch (error) {
      setMessage(`Plan details error: ${error.message}`);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { loadPlan(selectedPlanId); }, [selectedPlanId]);

  const unassigned = useMemo(
    () => activities.filter((activity) => !activity.plan_id),
    [activities],
  );

  async function createPlan(event) {
    event.preventDefault();
    try {
      await createMaintenancePlan({
        ...form,
        plan_year: Number(form.plan_year),
        budget: form.budget === "" ? null : Number(form.budget),
      });
      setMessage("Maintenance plan created.");
      await load();
    } catch (error) {
      setMessage(`Create plan error: ${error.message}`);
    }
  }

  async function assign(activityId) {
    try {
      await assignMaintenanceToPlan(Number(selectedPlanId), activityId);
      setMessage(`Maintenance #${activityId} assigned to the plan.`);
      await load();
      await loadPlan(selectedPlanId);
    } catch (error) {
      setMessage(`Assignment error: ${error.message}`);
    }
  }

  async function unassign(activityId) {
    try {
      await unassignMaintenanceFromPlan(Number(selectedPlanId), activityId);
      setMessage(`Maintenance #${activityId} removed from the plan.`);
      await load();
      await loadPlan(selectedPlanId);
    } catch (error) {
      setMessage(`Unassignment error: ${error.message}`);
    }
  }

  const selectedPlan = plans.find((plan) => String(plan.plan_id) === String(selectedPlanId));

  return (
    <section className="action-panel maintenance-planning">
      <h2>Maintenance Planning</h2>
      <p>Build annual plans, assign maintenance activities, and track budget and priority.</p>

      <form className="form-grid" onSubmit={createPlan}>
        <label>Year<input type="number" min="2000" max="2100" value={form.plan_year} onChange={(e) => setForm({ ...form, plan_year: e.target.value })} /></label>
        <label>Plan name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label>Budget<input type="number" min="0" step="0.01" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></label>
        <label>Start date<input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></label>
        <label>End date<input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></label>
        <label>Description<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        <button type="submit" disabled={loading}>Create Plan</button>
      </form>

      <div className="planning-selector">
        <label>Selected plan
          <select value={selectedPlanId} onChange={(e) => setSelectedPlanId(e.target.value)}>
            <option value="">Select a plan</option>
            {plans.map((plan) => <option key={plan.plan_id} value={plan.plan_id}>{plan.plan_year} — {plan.name}</option>)}
          </select>
        </label>
      </div>

      {selectedPlan && (
        <>
          <div className="summary-grid">
            <div><strong>Budget</strong><span>{selectedPlan.budget ?? "—"}</span></div>
            <div><strong>Estimated</strong><span>{summary?.estimated_cost ?? 0}</span></div>
            <div><strong>Actual</strong><span>{summary?.actual_cost ?? 0}</span></div>
            <div><strong>Remaining</strong><span>{summary?.remaining_budget ?? "—"}</span></div>
            <div><strong>Activities</strong><span>{summary?.activity_count ?? 0}</span></div>
            <div><strong>Completed</strong><span>{summary?.completed_count ?? 0}</span></div>
          </div>

          <h3>Budget Optimization</h3>
          <p>
            Recommendations are ranked using maintenance priority, section condition rating, and timing urgency,
            then selected in rank order until the plan budget is reached.
          </p>
          {optimization && (
            <>
              <div className="summary-grid">
                <div><strong>Candidate cost</strong><span>{optimization.total_candidate_cost}</span></div>
                <div><strong>Recommended cost</strong><span>{optimization.total_recommended_cost}</span></div>
                <div><strong>Budget remaining</strong><span>{optimization.remaining_budget ?? "—"}</span></div>
                <div><strong>Recommended</strong><span>{optimization.recommended_count}</span></div>
                <div><strong>Excluded</strong><span>{optimization.excluded_count}</span></div>
              </div>

              <h4>Recommended activities</h4>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Rank</th><th>ID</th><th>Activity</th><th>Priority</th><th>Condition</th><th>Score</th><th>Cost</th><th>Cumulative</th><th>Overdue</th></tr></thead>
                  <tbody>
                    {optimization.recommended.map((item, index) => (
                      <tr key={item.maintenance_id}>
                        <td>{index + 1}</td>
                        <td>{item.maintenance_id}</td>
                        <td>{item.activity_type}</td>
                        <td>{item.priority}</td>
                        <td>{item.condition_score ?? "—"}</td>
                        <td>{item.score}</td>
                        <td>{item.estimated_cost}</td>
                        <td>{item.cumulative_cost}</td>
                        <td>{item.overdue ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {optimization.excluded.length > 0 && (
                <>
                  <h4>Excluded because of budget</h4>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>ID</th><th>Activity</th><th>Priority</th><th>Condition</th><th>Score</th><th>Cost</th><th>Overdue</th></tr></thead>
                      <tbody>
                        {optimization.excluded.map((item) => (
                          <tr key={item.maintenance_id}>
                            <td>{item.maintenance_id}</td>
                            <td>{item.activity_type}</td>
                            <td>{item.priority}</td>
                            <td>{item.condition_score ?? "—"}</td>
                            <td>{item.score}</td>
                            <td>{item.estimated_cost}</td>
                            <td>{item.overdue ? "Yes" : "No"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}

          <h3>Priority allocation</h3>
          <div className="summary-grid">
            {Object.entries(summary?.priority_counts || {}).map(([priority, count]) => (
              <div key={priority}><strong>{priority}</strong><span>{count}</span></div>
            ))}
          </div>

          <h3>Activities in plan</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Activity</th><th>Priority</th><th>Planned</th><th>Cost</th><th /></tr></thead>
              <tbody>
                {planActivities.map((activity) => (
                  <tr key={activity.maintenance_id}>
                    <td>{activity.maintenance_id}</td>
                    <td>{activity.activity_type}</td>
                    <td>{activity.priority || "—"}</td>
                    <td>{activity.planned_date || "—"}</td>
                    <td>{activity.estimated_cost ?? "—"}</td>
                    <td><button type="button" onClick={() => unassign(activity.maintenance_id)}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3>Unassigned maintenance</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Road</th><th>Activity</th><th>Priority</th><th>Planned</th><th /></tr></thead>
              <tbody>
                {unassigned.map((activity) => (
                  <tr key={activity.maintenance_id}>
                    <td>{activity.maintenance_id}</td>
                    <td>{roads.find((road) => road.road_id === activity.road_id)?.road_name || activity.road_id || "—"}</td>
                    <td>{activity.activity_type}</td>
                    <td>{activity.priority || "—"}</td>
                    <td>{activity.planned_date || "—"}</td>
                    <td><button type="button" onClick={() => assign(activity.maintenance_id)} disabled={!selectedPlanId}>Assign</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {message && <p className="form-message">{message}</p>}
    </section>
  );
}
