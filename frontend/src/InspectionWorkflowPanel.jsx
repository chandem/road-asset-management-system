import { useState } from "react";
import {
  createMaintenance,
  getDefectMaintenance,
  getInspectionWorkflow,
  getMaintenanceHistory,
  updateMaintenance,
} from "./api";
import EmptyState from "./components/EmptyState";

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

const emptyMaintenance = {
  activity_type: "",
  priority: "medium",
  planned_date: "",
  estimated_cost: "",
  description: "",
};

const emptyEditMaintenance = {
  activity_type: "",
  priority: "medium",
  planned_date: "",
  estimated_cost: "",
  actual_cost: "",
  contractor: "",
  status: "planned",
  completed_date: "",
  description: "",
};

export default function InspectionWorkflowPanel() {
  const [inspectionId, setInspectionId] = useState("");
  const [workflow, setWorkflow] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [maintenanceByDefect, setMaintenanceByDefect] = useState({});
  const [maintenanceHistoryById, setMaintenanceHistoryById] = useState({});
  const [openHistoryId, setOpenHistoryId] = useState(null);
  const [openDefect, setOpenDefect] = useState(null);
  const [maintenanceForm, setMaintenanceForm] = useState(emptyMaintenance);
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [editingMaintenanceId, setEditingMaintenanceId] = useState(null);
  const [editForm, setEditForm] = useState(emptyEditMaintenance);
  const [savingEdit, setSavingEdit] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");

  async function loadWorkflow(event) {
    event.preventDefault();
    if (!inspectionId) return;
    setLoading(true);
    setError("");
    setMaintenanceByDefect({});
    setMaintenanceHistoryById({});
    setOpenHistoryId(null);
    setOpenDefect(null);
    setEditingMaintenanceId(null);
    try {
      setWorkflow(await getInspectionWorkflow(Number(inspectionId)));
    } catch (err) {
      setWorkflow(null);
      setError(err.message || "Unable to load inspection workflow");
    } finally {
      setLoading(false);
    }
  }

  async function loadDefectMaintenance(defectId) {
    try {
      const records = await getDefectMaintenance(defectId);
      setMaintenanceByDefect((current) => ({ ...current, [defectId]: records }));
    } catch (err) {
      setMaintenanceMessage(`Maintenance lookup error: ${err.message}`);
    }
  }

  async function toggleMaintenanceHistory(maintenanceId) {
    if (openHistoryId === maintenanceId) {
      setOpenHistoryId(null);
      return;
    }
    if (!maintenanceHistoryById[maintenanceId]) {
      try {
        const history = await getMaintenanceHistory(maintenanceId);
        setMaintenanceHistoryById((current) => ({ ...current, [maintenanceId]: history }));
      } catch (err) {
        setMaintenanceMessage(`History lookup error: ${err.message}`);
        return;
      }
    }
    setOpenHistoryId(maintenanceId);
  }

  function openMaintenanceForm(defect) {
    setOpenDefect(defect.defect_id);
    setEditingMaintenanceId(null);
    setMaintenanceForm({
      ...emptyMaintenance,
      activity_type: `Repair ${defect.defect_type}`,
      priority: defect.severity || "medium",
      description: defect.description || "",
    });
    setMaintenanceMessage("");
  }

  function openEditMaintenance(item) {
    setEditingMaintenanceId(item.maintenance_id);
    setOpenDefect(null);
    setEditForm({
      activity_type: item.activity_type || "",
      priority: item.priority || "medium",
      planned_date: item.planned_date || "",
      estimated_cost: item.estimated_cost ?? "",
      actual_cost: item.actual_cost ?? "",
      contractor: item.contractor || "",
      status: item.status || "planned",
      completed_date: item.completed_date || "",
      description: item.description || "",
    });
    setMaintenanceMessage("");
  }

  function closeEditMaintenance() {
    setEditingMaintenanceId(null);
    setEditForm(emptyEditMaintenance);
  }

  async function saveMaintenanceEdit(event, item, defectId) {
    event.preventDefault();
    if (!editForm.activity_type.trim()) {
      setMaintenanceMessage("Enter a maintenance activity type.");
      return;
    }
    if (editForm.status === "completed" && !editForm.completed_date) {
      setMaintenanceMessage("A completed date is required when status is completed.");
      return;
    }
    setSavingEdit(true);
    setMaintenanceMessage("");
    try {
      await updateMaintenance(item.maintenance_id, {
        activity_type: editForm.activity_type.trim(),
        priority: editForm.priority || null,
        planned_date: editForm.planned_date || null,
        estimated_cost: editForm.estimated_cost === "" ? null : Number(editForm.estimated_cost),
        actual_cost: editForm.actual_cost === "" ? null : Number(editForm.actual_cost),
        contractor: editForm.contractor.trim() || null,
        status: editForm.status,
        completed_date: editForm.completed_date || null,
        description: editForm.description.trim() || null,
      });
      setMaintenanceMessage(`Maintenance #${item.maintenance_id} updated successfully.`);
      setMaintenanceHistoryById((current) => ({ ...current, [item.maintenance_id]: undefined }));
      closeEditMaintenance();
      await loadDefectMaintenance(defectId);
    } catch (err) {
      setMaintenanceMessage(`Maintenance update error: ${err.message}`);
    } finally {
      setSavingEdit(false);
    }
  }

  async function markMaintenanceCompleted(item, defectId) {
    const today = new Date().toISOString().slice(0, 10);
    setSavingEdit(true);
    setMaintenanceMessage("");
    try {
      await updateMaintenance(item.maintenance_id, {
        status: "completed",
        completed_date: item.completed_date || today,
      });
      setMaintenanceMessage(`Maintenance #${item.maintenance_id} marked completed.`);
      setMaintenanceHistoryById((current) => ({ ...current, [item.maintenance_id]: undefined }));
      await loadDefectMaintenance(defectId);
    } catch (err) {
      setMaintenanceMessage(`Maintenance completion error: ${err.message}`);
    } finally {
      setSavingEdit(false);
    }
  }

  async function submitMaintenance(event, defect) {
    event.preventDefault();
    if (!defect.road_id) {
      setMaintenanceMessage("This defect has no road reference, so maintenance cannot be created from this workflow.");
      return;
    }
    if (!maintenanceForm.activity_type.trim()) {
      setMaintenanceMessage("Enter a maintenance activity type.");
      return;
    }
    setSavingMaintenance(true);
    setMaintenanceMessage("");
    try {
      await createMaintenance(defect.road_id, {
        section_id: defect.section_id || null,
        source_defect_id: defect.defect_id,
        activity_type: maintenanceForm.activity_type.trim(),
        priority: maintenanceForm.priority || null,
        planned_date: maintenanceForm.planned_date || null,
        estimated_cost: maintenanceForm.estimated_cost === "" ? null : Number(maintenanceForm.estimated_cost),
        description: maintenanceForm.description || null,
      });
      setMaintenanceMessage(`Maintenance linked to defect #${defect.defect_id} created successfully.`);
      setOpenDefect(null);
      setMaintenanceForm(emptyMaintenance);
      await loadDefectMaintenance(defect.defect_id);
    } catch (err) {
      setMaintenanceMessage(`Maintenance error: ${err.message}`);
    } finally {
      setSavingMaintenance(false);
    }
  }

  const summary = workflow?.summary;
  const inspection = workflow?.inspection;

  return (
    <section className="report-panel" style={{ margin: "24px 0" }}>
      <div className="panel-heading">
        <div>
          <h2>🔎 Inspection Workflow</h2>
          <p>Inspection → defects → maintenance → photos → AI detection in one view.</p>
        </div>
      </div>

      <form onSubmit={loadWorkflow} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end", marginBottom: 18 }}>
        <label style={{ minWidth: 220 }}>
          Inspection ID
          <input type="number" min="1" value={inspectionId} onChange={(event) => setInspectionId(event.target.value)} placeholder="e.g. 1" required />
        </label>
        <button type="submit" disabled={loading}>{loading ? "Loading…" : "Open Inspection"}</button>
      </form>

      {error && <div className="error-banner">{error}</div>}
      {maintenanceMessage && <div className="error-banner" style={{ marginBottom: 12 }}>{maintenanceMessage}</div>}

      {!workflow && !loading && !error && (
        <EmptyState title="Open an inspection to fill this workspace" icon="🔎" tone="info">
          <p>
            Enter an inspection ID above to load defects, maintenance links, photos,
            and AI detections in one view. Without a selection the page stays empty by design —
            open an inspection to populate the panels.
          </p>
        </EmptyState>
      )}

      {workflow && (
        <>
          <div className="cards report-cards">
            <div className="card"><span>Condition</span><strong>{inspection?.condition_rating == null ? "—" : `${inspection.condition_rating}/100`}</strong></div>
            <div className="card"><span>Defects</span><strong>{summary?.defect_count ?? 0}</strong></div>
            <div className="card"><span>Photos</span><strong>{summary?.image_count ?? 0}</strong></div>
            <div className="card"><span>AI Detections</span><strong>{summary?.ai_detection_count ?? 0}</strong></div>
          </div>

          <div className="report-grid">
            <div className="report-box">
              <h3>Inspection</h3>
              <p><strong>ID:</strong> {inspection?.inspection_id}</p>
              <p><strong>Road:</strong> {inspection?.road_id ?? "—"}</p>
              <p><strong>Section:</strong> {inspection?.section_id ?? "—"}</p>
              <p><strong>Date:</strong> {formatDate(inspection?.inspection_date)}</p>
              <p><strong>Weather:</strong> {inspection?.weather || "—"}</p>
              <p><strong>Notes:</strong> {inspection?.notes || "—"}</p>
            </div>

            <div className="report-box">
              <h3>Defects & Maintenance</h3>
              {workflow.defects.length === 0 ? <p>No defects recorded.</p> : workflow.defects.map((defect) => (
                <div key={defect.defect_id} style={{ padding: "10px 0", borderBottom: "1px solid #ddd" }}>
                  <strong>#{defect.defect_id} · {defect.defect_type}</strong>
                  <div>{defect.severity || "severity not set"} · chainage {defect.chainage_km ?? "—"} km</div>
                  <small>{defect.description || "No description"}</small>
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => loadDefectMaintenance(defect.defect_id)}>View Maintenance</button>
                    <button type="button" onClick={() => openMaintenanceForm(defect)}>+ Create Maintenance</button>
                  </div>
                  {maintenanceByDefect[defect.defect_id]?.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      {maintenanceByDefect[defect.defect_id].map((item) => (
                        <div key={item.maintenance_id} style={{ padding: "8px", background: "rgba(0,0,0,0.04)", borderRadius: 6, marginTop: 5 }}>
                          <strong>Maintenance #{item.maintenance_id}</strong> · {item.activity_type} · {item.status}
                          <div>Priority: {item.priority || "—"} · Planned: {item.planned_date || "—"}</div>
                          <div>Estimated: {item.estimated_cost ?? "—"} · Actual: {item.actual_cost ?? "—"} · Contractor: {item.contractor || "—"}</div>
                          {item.completed_date && <div>Completed: {item.completed_date}</div>}
                          <div style={{ marginTop: 7, display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button type="button" onClick={() => toggleMaintenanceHistory(item.maintenance_id)}>
                              {openHistoryId === item.maintenance_id ? "Hide History" : "History"}
                            </button>
                            <button type="button" onClick={() => openEditMaintenance(item)}>Edit</button>
                            {item.status !== "completed" && (
                              <button type="button" disabled={savingEdit} onClick={() => markMaintenanceCompleted(item, defect.defect_id)}>
                                {savingEdit ? "Updating…" : "Mark Completed"}
                              </button>
                            )}
                          </div>
                          {openHistoryId === item.maintenance_id && maintenanceHistoryById[item.maintenance_id] && (
                            <div style={{ marginTop: 10, padding: "10px", border: "1px solid #ddd", borderRadius: 8 }}>
                              <h4>Maintenance History</h4>
                              {maintenanceHistoryById[item.maintenance_id].length === 0 ? (
                                <small>No history recorded.</small>
                              ) : (
                                <div>
                                  {maintenanceHistoryById[item.maintenance_id].map((entry) => (
                                    <div key={entry.history_id} style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>
                                      <strong>{entry.action}</strong> · {formatDate(entry.changed_at)} · user #{entry.changed_by ?? "—"}
                                      {entry.old_values && <pre style={{ margin: "6px 0", whiteSpace: "pre-wrap", fontSize: 12 }}>{JSON.stringify(entry.old_values, null, 2)}</pre>}
                                      {entry.new_values && <pre style={{ margin: "6px 0", whiteSpace: "pre-wrap", fontSize: 12 }}>{JSON.stringify(entry.new_values, null, 2)}</pre>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          {editingMaintenanceId === item.maintenance_id && (
                            <form onSubmit={(event) => saveMaintenanceEdit(event, item, defect.defect_id)} style={{ marginTop: 10, padding: 10, border: "1px solid #ddd", borderRadius: 8 }}>
                              <h4>Edit Maintenance #{item.maintenance_id}</h4>
                              <div className="form-grid">
                                <label>Activity Type<input value={editForm.activity_type} onChange={(e) => setEditForm((c) => ({ ...c, activity_type: e.target.value }))} required /></label>
                                <label>Priority<select value={editForm.priority} onChange={(e) => setEditForm((c) => ({ ...c, priority: e.target.value }))}><option>low</option><option>medium</option><option>high</option><option>critical</option></select></label>
                                <label>Status<select value={editForm.status} onChange={(e) => setEditForm((c) => ({ ...c, status: e.target.value }))}><option>planned</option><option>in progress</option><option>completed</option><option>cancelled</option></select></label>
                                <label>Planned Date<input type="date" value={editForm.planned_date} onChange={(e) => setEditForm((c) => ({ ...c, planned_date: e.target.value }))} /></label>
                                <label>Completed Date<input type="date" value={editForm.completed_date} onChange={(e) => setEditForm((c) => ({ ...c, completed_date: e.target.value }))} /></label>
                                <label>Estimated Cost<input type="number" min="0" step="0.01" value={editForm.estimated_cost} onChange={(e) => setEditForm((c) => ({ ...c, estimated_cost: e.target.value }))} /></label>
                                <label>Actual Cost<input type="number" min="0" step="0.01" value={editForm.actual_cost} onChange={(e) => setEditForm((c) => ({ ...c, actual_cost: e.target.value }))} /></label>
                                <label>Contractor<input value={editForm.contractor} onChange={(e) => setEditForm((c) => ({ ...c, contractor: e.target.value }))} /></label>
                                <label>Description<textarea value={editForm.description} onChange={(e) => setEditForm((c) => ({ ...c, description: e.target.value }))} /></label>
                              </div>
                              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                <button type="submit" disabled={savingEdit}>{savingEdit ? "Saving…" : "Save Changes"}</button>
                                <button type="button" onClick={closeEditMaintenance}>Cancel</button>
                              </div>
                            </form>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {maintenanceByDefect[defect.defect_id]?.length === 0 && <small>No maintenance linked yet.</small>}
                  {openDefect === defect.defect_id && (
                    <form onSubmit={(event) => submitMaintenance(event, defect)} style={{ marginTop: 10, padding: 10, border: "1px solid #ddd", borderRadius: 8 }}>
                      <h4>Create Maintenance for Defect #{defect.defect_id}</h4>
                      <div className="form-grid">
                        <label>Activity Type<input value={maintenanceForm.activity_type} onChange={(e) => setMaintenanceForm((c) => ({ ...c, activity_type: e.target.value }))} required /></label>
                        <label>Priority<select value={maintenanceForm.priority} onChange={(e) => setMaintenanceForm((c) => ({ ...c, priority: e.target.value }))}><option>low</option><option>medium</option><option>high</option><option>critical</option></select></label>
                        <label>Planned Date<input type="date" value={maintenanceForm.planned_date} onChange={(e) => setMaintenanceForm((c) => ({ ...c, planned_date: e.target.value }))} /></label>
                        <label>Estimated Cost<input type="number" min="0" step="0.01" value={maintenanceForm.estimated_cost} onChange={(e) => setMaintenanceForm((c) => ({ ...c, estimated_cost: e.target.value }))} /></label>
                        <label>Description<textarea value={maintenanceForm.description} onChange={(e) => setMaintenanceForm((c) => ({ ...c, description: e.target.value }))} /></label>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button type="submit" disabled={savingMaintenance}>{savingMaintenance ? "Saving…" : "Create Linked Maintenance"}</button>
                        <button type="button" onClick={() => setOpenDefect(null)}>Cancel</button>
                      </div>
                    </form>
                  )}
                </div>
              ))}
            </div>

            <div className="report-box">
              <h3>Photos</h3>
              {workflow.images.length === 0 ? <p>No photos linked.</p> : workflow.images.map((image) => (
                <div key={image.image_id} style={{ padding: "8px 0", borderBottom: "1px solid #ddd" }}>
                  <strong>Image #{image.image_id}</strong>
                  <div>{image.file_name || image.storage_key || "Stored image"}</div>
                </div>
              ))}
            </div>

            <div className="report-box">
              <h3>AI detections</h3>
              {(workflow.ai_detections || []).length === 0 ? <p>No AI detections yet.</p> : workflow.ai_detections.map((d, i) => (
                <div key={i} style={{ padding: "6px 0" }}>{JSON.stringify(d)}</div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
