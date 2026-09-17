export default function MaintenanceSection({
  roads,
  sections,
  maintenanceRoadId,
  setMaintenanceRoadId,
  maintenance,
  maintenanceLoading,
  maintenanceForm,
  updateMaintenance,
  submitMaintenance,
  loadMaintenance,
  saving,
  message,
  completedCount,
  estimatedTotal,
  actualTotal,
}) {
  const selectedMaintenanceSections = sections.filter((s) => String(s.road_id) === String(maintenanceRoadId));

  return (
    <section className="form-panel">
      <div className="form-header">
        <div>
          <h2>🛠️ Maintenance Management</h2>
          <p>Plan, track and review road maintenance activities and costs.</p>
        </div>
        <button type="button" onClick={() => loadMaintenance()}>Refresh</button>
      </div>
      <div className="form-grid">
        <label>Road<select value={maintenanceRoadId} onChange={(e) => setMaintenanceRoadId(e.target.value)}><option value="">Select road</option>{roads.map((r) => <option key={r.road_id} value={r.road_id}>{r.road_code} · {r.road_name}</option>)}</select></label>
        <div className="card"><span>Activities</span><strong>{maintenanceLoading ? "…" : maintenance.length}</strong></div>
        <div className="card"><span>Completed</span><strong>{completedCount}</strong></div>
        <div className="card"><span>Estimated Cost</span><strong>{estimatedTotal.toLocaleString()}</strong></div>
        <div className="card"><span>Actual Cost</span><strong>{actualTotal.toLocaleString()}</strong></div>
      </div>
      <form onSubmit={submitMaintenance}>
        <h3>New Maintenance Activity</h3>
        <div className="form-grid">
          <label>Section<select value={maintenanceForm.section_id} onChange={(e) => updateMaintenance("section_id", e.target.value)}><option value="">Whole road</option>{selectedMaintenanceSections.map((s) => <option key={s.section_id} value={s.section_id}>{s.section_code} ({s.start_chainage}–{s.end_chainage} km)</option>)}</select></label>
          <label>Chainage (km)<input type="number" min="0" step="0.001" value={maintenanceForm.chainage_km} onChange={(e) => updateMaintenance("chainage_km", e.target.value)} placeholder="e.g. 12.500" disabled={!maintenanceForm.section_id} /></label>
          <label>Activity Type<input value={maintenanceForm.activity_type} onChange={(e) => updateMaintenance("activity_type", e.target.value)} placeholder="Routine grading, pothole repair…" required /></label>
          <label>Priority<select value={maintenanceForm.priority} onChange={(e) => updateMaintenance("priority", e.target.value)}><option>low</option><option>medium</option><option>high</option><option>critical</option></select></label>
          <label>Status<select value={maintenanceForm.status} onChange={(e) => updateMaintenance("status", e.target.value)}><option>planned</option><option>in progress</option><option>completed</option><option>cancelled</option></select></label>
          <label>Planned Date<input type="date" value={maintenanceForm.planned_date} onChange={(e) => updateMaintenance("planned_date", e.target.value)} /></label>
          <label>Completed Date<input type="date" value={maintenanceForm.completed_date} onChange={(e) => updateMaintenance("completed_date", e.target.value)} /></label>
          <label>Estimated Cost<input type="number" min="0" step="0.01" value={maintenanceForm.estimated_cost} onChange={(e) => updateMaintenance("estimated_cost", e.target.value)} /></label>
          <label>Actual Cost<input type="number" min="0" step="0.01" value={maintenanceForm.actual_cost} onChange={(e) => updateMaintenance("actual_cost", e.target.value)} /></label>
          <label>Contractor<input value={maintenanceForm.contractor} onChange={(e) => updateMaintenance("contractor", e.target.value)} /></label>
          <label>Description<textarea value={maintenanceForm.description} onChange={(e) => updateMaintenance("description", e.target.value)} /></label>
        </div>
        <div className="form-footer"><button type="submit" disabled={saving || !maintenanceRoadId}>{saving ? "Saving…" : "Create Maintenance"}</button>{message && <span>{message}</span>}</div>
      </form>
      <div className="maintenance-list">
        <h3>Maintenance History</h3>
        {maintenanceLoading ? <p>Loading maintenance records…</p> : maintenance.length === 0 ? <p>No maintenance activities recorded for this road.</p> : (
          <div className="table-wrap"><table><thead><tr><th>Activity</th><th>Section</th><th>Chainage</th><th>Priority</th><th>Status</th><th>Planned</th><th>Completed</th><th>Estimated</th><th>Actual</th><th>Contractor</th></tr></thead>
            <tbody>{maintenance.map((m) => { const section = sections.find((s) => s.section_id === m.section_id); return <tr key={m.maintenance_id}><td>{m.activity_type}</td><td>{section?.section_code || m.section_id || "Whole road"}</td><td>{m.chainage_km ?? "—"}</td><td>{m.priority || "—"}</td><td>{m.status}</td><td>{m.planned_date || "—"}</td><td>{m.completed_date || "—"}</td><td>{m.estimated_cost == null ? "—" : Number(m.estimated_cost).toLocaleString()}</td><td>{m.actual_cost == null ? "—" : Number(m.actual_cost).toLocaleString()}</td><td>{m.contractor || "—"}</td></tr>; })}</tbody>
          </table></div>
        )}
      </div>
    </section>
  );
}
