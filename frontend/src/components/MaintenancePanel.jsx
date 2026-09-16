import { useEffect, useState } from "react";
import { createMaintenance, getRoadMaintenance } from "../api";

const initialForm = {
  section_id: "",
  activity_type: "Routine maintenance",
  priority: "medium",
  planned_date: "",
  completed_date: "",
  estimated_cost: "",
  actual_cost: "",
  contractor: "",
  status: "planned",
  description: "",
};

export default function MaintenancePanel({ roads = [], sections = [] }) {
  const [roadId, setRoadId] = useState("");
  const [activities, setActivities] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const roadSections = sections.filter((s) => !roadId || String(s.road_id) === String(roadId));

  useEffect(() => {
    if (!roadId) {
      setActivities([]);
      return;
    }
    let active = true;
    setLoading(true);
    getRoadMaintenance(Number(roadId))
      .then((data) => active && setActivities(data))
      .catch((e) => active && setMessage(`Error: ${e.message}`))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [roadId]);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(e) {
    e.preventDefault();
    if (!roadId) {
      setMessage("Select a road first.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const result = await createMaintenance(Number(roadId), {
        section_id: form.section_id ? Number(form.section_id) : null,
        activity_type: form.activity_type,
        priority: form.priority || null,
        planned_date: form.planned_date || null,
        completed_date: form.completed_date || null,
        estimated_cost: form.estimated_cost === "" ? null : Number(form.estimated_cost),
        actual_cost: form.actual_cost === "" ? null : Number(form.actual_cost),
        contractor: form.contractor || null,
        status: form.status,
        description: form.description || null,
      });
      setActivities((current) => [...current, result]);
      setForm(initialForm);
      setMessage(`Maintenance #${result.maintenance_id} created successfully.`);
    } catch (e) {
      setMessage(`Error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="form-panel maintenance-panel">
      <div className="form-header">
        <div><h2>🛠️ Maintenance Management</h2><p>Plan, record and track road maintenance activities and costs.</p></div>
      </div>

      <label>Road
        <select value={roadId} onChange={(e) => { setRoadId(e.target.value); setForm(initialForm); }}>
          <option value="">Select road</option>
          {roads.map((road) => <option key={road.road_id} value={road.road_id}>{road.road_code} — {road.road_name}</option>)}
        </select>
      </label>

      {roadId && <>
        <form onSubmit={submit}>
          <div className="form-grid">
            <label>Section
              <select value={form.section_id} onChange={(e) => update("section_id", e.target.value)}>
                <option value="">Road-level activity</option>
                {roadSections.map((s) => <option key={s.section_id} value={s.section_id}>{s.section_code} ({s.start_chainage}–{s.end_chainage} km)</option>)}
              </select>
            </label>
            <label>Activity Type<input value={form.activity_type} onChange={(e) => update("activity_type", e.target.value)} required /></label>
            <label>Priority<select value={form.priority} onChange={(e) => update("priority", e.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label>
            <label>Status<select value={form.status} onChange={(e) => update("status", e.target.value)}><option value="planned">Planned</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
            <label>Planned Date<input type="date" value={form.planned_date} onChange={(e) => update("planned_date", e.target.value)} /></label>
            <label>Completed Date<input type="date" value={form.completed_date} onChange={(e) => update("completed_date", e.target.value)} /></label>
            <label>Estimated Cost<input type="number" min="0" step="0.01" value={form.estimated_cost} onChange={(e) => update("estimated_cost", e.target.value)} /></label>
            <label>Actual Cost<input type="number" min="0" step="0.01" value={form.actual_cost} onChange={(e) => update("actual_cost", e.target.value)} /></label>
          </div>
          <label>Contractor<input value={form.contractor} onChange={(e) => update("contractor", e.target.value)} /></label>
          <label>Description<textarea value={form.description} onChange={(e) => update("description", e.target.value)} /></label>
          <div className="form-footer"><button type="submit" disabled={saving}>{saving ? "Saving…" : "+ Add Maintenance Activity"}</button>{message && <span>{message}</span>}</div>
        </form>

        <div className="ai-results">
          <div className="form-header"><h3>Maintenance History</h3>{loading && <span>Loading…</span>}</div>
          {!loading && activities.length === 0 && <p>No maintenance activities recorded for this road.</p>}
          {activities.map((a) => (
            <div className="ai-result" key={a.maintenance_id}>
              <strong>#{a.maintenance_id} · {a.activity_type}</strong>
              <span>{a.status} · {a.priority || "No priority"}</span>
              <small>{a.planned_date ? `Planned ${a.planned_date}` : "No planned date"}{a.estimated_cost != null ? ` · Est. ${Number(a.estimated_cost).toLocaleString()} ETB` : ""}{a.contractor ? ` · ${a.contractor}` : ""}</small>
            </div>
          ))}
        </div>
      </>}
    </section>
  );
}
