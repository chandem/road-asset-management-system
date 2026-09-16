import { useState } from "react";
import { createMaintenance, getDefectMaintenance, getInspectionWorkflow } from "./api";

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

export default function InspectionWorkflowPanel() {
  const [inspectionId, setInspectionId] = useState("");
  const [workflow, setWorkflow] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [maintenanceByDefect, setMaintenanceByDefect] = useState({});
  const [openDefect, setOpenDefect] = useState(null);
  const [maintenanceForm, setMaintenanceForm] = useState(emptyMaintenance);
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");

  async function loadWorkflow(event) {
    event.preventDefault();
    if (!inspectionId) return;
    setLoading(true);
    setError("");
    setMaintenanceByDefect({});
    setOpenDefect(null);
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

  function openMaintenanceForm(defect) {
    setOpenDefect(defect.defect_id);
    setMaintenanceForm({
      ...emptyMaintenance,
      activity_type: `Repair ${defect.defect_type}`,
      priority: defect.severity || "medium",
      description: defect.description || "",
    });
    setMaintenanceMessage("");
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
                        <div key={item.maintenance_id} style={{ padding: "6px 8px", background: "rgba(0,0,0,0.04)", borderRadius: 6, marginTop: 5 }}>
                          <strong>Maintenance #{item.maintenance_id}</strong> · {item.activity_type} · {item.status}
                          <div>Priority: {item.priority || "—"} · Planned: {item.planned_date || "—"}</div>
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
              {workflow.images.length === 0 ? <p>No photos linked to this inspection.</p> : workflow.images.map((image) => (
                <div key={image.image_id} style={{ padding: "8px 0", borderBottom: "1px solid #ddd" }}>
                  <strong>#{image.image_id} · {image.file_name}</strong>
                  <div>Defect: {image.defect_id ?? "—"}</div>
                  <small>GPS: {image.latitude ?? "—"}, {image.longitude ?? "—"} · {formatDate(image.captured_at)}</small>
                </div>
              ))}
            </div>

            <div className="report-box">
              <h3>🤖 AI Detections</h3>
              {workflow.ai_detections.length === 0 ? <p>No AI detections recorded for these photos.</p> : workflow.ai_detections.map((detection) => (
                <div key={detection.detection_id} style={{ padding: "8px 0", borderBottom: "1px solid #ddd" }}>
                  <strong>{detection.defect_type}</strong>
                  <div>{(Number(detection.confidence) * 100).toFixed(1)}% confidence · image #{detection.image_id}</div>
                  <small>{detection.model_name}{detection.model_version ? ` · ${detection.model_version}` : ""}</small>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
