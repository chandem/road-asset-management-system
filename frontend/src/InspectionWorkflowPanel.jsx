import { useState } from "react";
import { getInspectionWorkflow } from "./api";

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default function InspectionWorkflowPanel() {
  const [inspectionId, setInspectionId] = useState("");
  const [workflow, setWorkflow] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadWorkflow(event) {
    event.preventDefault();
    if (!inspectionId) return;
    setLoading(true);
    setError("");
    try {
      setWorkflow(await getInspectionWorkflow(Number(inspectionId)));
    } catch (err) {
      setWorkflow(null);
      setError(err.message || "Unable to load inspection workflow");
    } finally {
      setLoading(false);
    }
  }

  const summary = workflow?.summary;
  const inspection = workflow?.inspection;

  return (
    <section className="report-panel" style={{ margin: "24px 0" }}>
      <div className="panel-heading">
        <div>
          <h2>🔎 Inspection Workflow</h2>
          <p>Inspection → defects → photos → AI detection in one view.</p>
        </div>
      </div>

      <form onSubmit={loadWorkflow} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end", marginBottom: 18 }}>
        <label style={{ minWidth: 220 }}>
          Inspection ID
          <input
            type="number"
            min="1"
            value={inspectionId}
            onChange={(event) => setInspectionId(event.target.value)}
            placeholder="e.g. 1"
            required
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Loading…" : "Open Inspection"}
        </button>
      </form>

      {error && <div className="error-banner">{error}</div>}

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
              <p><strong>Section:</strong> {inspection?.section_id ?? "—"}</p>
              <p><strong>Date:</strong> {formatDate(inspection?.inspection_date)}</p>
              <p><strong>Weather:</strong> {inspection?.weather || "—"}</p>
              <p><strong>Notes:</strong> {inspection?.notes || "—"}</p>
            </div>

            <div className="report-box">
              <h3>Defects</h3>
              {workflow.defects.length === 0 ? <p>No defects recorded.</p> : workflow.defects.map((defect) => (
                <div key={defect.defect_id} style={{ padding: "8px 0", borderBottom: "1px solid #ddd" }}>
                  <strong>#{defect.defect_id} · {defect.defect_type}</strong>
                  <div>{defect.severity || "severity not set"} · chainage {defect.chainage_km ?? "—"} km</div>
                  <small>{defect.description || "No description"}</small>
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
