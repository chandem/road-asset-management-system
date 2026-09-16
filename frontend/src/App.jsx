import { useEffect, useState } from "react";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  createDefect,
  createInspection,
  createMaintenance,
  getAIDetections,
  getDefectGeoJSON,
  getGPSTrackGeoJSON,
  getRoadAssetGeoJSON,
  getRoadGeoJSON,
  getRoadMaintenance,
  getRoadSectionGeoJSON,
  getRoadSections,
  getRoads,
  runAIDetection,
  uploadImage,
} from "./api";

const defaultCenter = [8.0, 39.0];

function FitLayers({ layers }) {
  const map = useMap();
  useEffect(() => {
    const layer = L.featureGroup();
    layers.forEach((d) => {
      if (d?.features?.length) layer.addLayer(L.geoJSON(d));
    });
    const bounds = layer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30] });
  }, [layers, map]);
  return null;
}

function App() {
  const [roads, setRoads] = useState([]);
  const [roadGeoJSON, setRoadGeoJSON] = useState(null);
  const [gpsGeoJSON, setGpsGeoJSON] = useState(null);
  const [sectionGeoJSON, setSectionGeoJSON] = useState(null);
  const [assetGeoJSON, setAssetGeoJSON] = useState(null);
  const [defectGeoJSON, setDefectGeoJSON] = useState(null);
  const [sections, setSections] = useState([]);
  const [visible, setVisible] = useState({ roads: true, gps: true, sections: true, assets: true, defects: true });
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState("inspection");
  const [form, setForm] = useState({
    section_id: "", inspection_date: new Date().toISOString().slice(0, 10), condition_rating: "",
    weather: "", notes: "", inspection_id: "", defect_type: "", severity: "", chainage_km: "",
    length_m: "", width_m: "", depth_mm: "", description: "", detected_by: "manual",
  });
  const [photo, setPhoto] = useState({ file: null, inspection_id: "", defect_id: "", latitude: "", longitude: "", captured_at: "" });
  const [uploadedImageId, setUploadedImageId] = useState(null);
  const [aiResults, setAiResults] = useState([]);
  const [aiRunning, setAiRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [maintenanceRoadId, setMaintenanceRoadId] = useState("");
  const [maintenance, setMaintenance] = useState([]);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [maintenanceForm, setMaintenanceForm] = useState({
    section_id: "", activity_type: "", priority: "medium", planned_date: "",
    completed_date: "", estimated_cost: "", actual_cost: "", contractor: "",
    status: "planned", description: "",
  });

  async function loadDashboard() {
    try {
      setError("");
      const [r, g, t, d] = await Promise.all([getRoads(), getRoadGeoJSON(), getGPSTrackGeoJSON(), getDefectGeoJSON()]);
      const ids = r.map((x) => x.road_id);
      const [ss, aa] = await Promise.all([
        Promise.all(ids.map((id) => getRoadSectionGeoJSON(id))),
        Promise.all(ids.map((id) => getRoadAssetGeoJSON(id))),
      ]);
      const combine = (c) => ({ type: "FeatureCollection", features: c.flatMap((x) => x.features || []) });
      setRoads(r);
      setRoadGeoJSON(g);
      setGpsGeoJSON(t);
      setSectionGeoJSON(combine(ss));
      setAssetGeoJSON(combine(aa));
      setDefectGeoJSON(d);
      setSections((await Promise.all(ids.map((id) => getRoadSections(id)))).flat());
      if (!maintenanceRoadId && ids.length) setMaintenanceRoadId(String(ids[0]));
    } catch (e) {
      setError(e.message || "Unable to connect to RAMS API");
    } finally {
      setLoading(false);
    }
  }

  async function loadMaintenance(roadId = maintenanceRoadId) {
    if (!roadId) {
      setMaintenance([]);
      return;
    }
    setMaintenanceLoading(true);
    try {
      setMaintenance(await getRoadMaintenance(Number(roadId)));
    } catch (e) {
      setMessage(`Maintenance error: ${e.message}`);
    } finally {
      setMaintenanceLoading(false);
    }
  }

  useEffect(() => { loadDashboard(); }, []);
  useEffect(() => { if (maintenanceRoadId) loadMaintenance(maintenanceRoadId); }, [maintenanceRoadId]);

  const update = (k, v) => setForm((c) => ({ ...c, [k]: v }));
  const updatePhoto = (k, v) => setPhoto((c) => ({ ...c, [k]: v }));
  const updateMaintenance = (k, v) => setMaintenanceForm((c) => ({ ...c, [k]: v }));
  const toggleLayer = (k) => setVisible((c) => ({ ...c, [k]: !c[k] }));
  const openForm = (t) => { setFormType(t); setMessage(""); setShowForm(true); };

  function captureGPS() {
    if (!navigator.geolocation) { setMessage("GPS is not supported by this browser."); return; }
    setMessage("Getting GPS location…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPhoto((c) => ({ ...c, latitude: p.coords.latitude.toFixed(6), longitude: p.coords.longitude.toFixed(6) }));
        setMessage("GPS location captured.");
      },
      (e) => setMessage(`GPS error: ${e.message}`),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  async function submitForm(e) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      if (formType === "inspection") {
        if (!form.section_id) throw new Error("Select a road section.");
        const r = await createInspection(Number(form.section_id), {
          inspection_date: form.inspection_date,
          condition_rating: form.condition_rating === "" ? null : Number(form.condition_rating),
          weather: form.weather || null,
          notes: form.notes || null,
        });
        setMessage(`Inspection #${r.inspection_id} created successfully.`);
      } else {
        if (!form.inspection_id) throw new Error("Enter the inspection ID.");
        if (!form.defect_type) throw new Error("Enter the defect type.");
        const r = await createDefect(Number(form.inspection_id), {
          section_id: form.section_id ? Number(form.section_id) : null,
          defect_type: form.defect_type,
          severity: form.severity || null,
          chainage_km: form.chainage_km === "" ? null : Number(form.chainage_km),
          length_m: form.length_m === "" ? null : Number(form.length_m),
          width_m: form.width_m === "" ? null : Number(form.width_m),
          depth_mm: form.depth_mm === "" ? null : Number(form.depth_mm),
          description: form.description || null,
          detected_by: form.detected_by || "manual",
        });
        setMessage(`Defect #${r.defect_id} created successfully.`);
      }
      await loadDashboard();
    } catch (e) {
      setMessage(`Error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function submitMaintenance(e) {
    e.preventDefault();
    if (!maintenanceRoadId) {
      setMessage("Select a road before creating maintenance.");
      return;
    }
    if (!maintenanceForm.activity_type.trim()) {
      setMessage("Enter a maintenance activity type.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const r = await createMaintenance(Number(maintenanceRoadId), {
        section_id: maintenanceForm.section_id ? Number(maintenanceForm.section_id) : null,
        activity_type: maintenanceForm.activity_type.trim(),
        priority: maintenanceForm.priority || null,
        planned_date: maintenanceForm.planned_date || null,
        completed_date: maintenanceForm.completed_date || null,
        estimated_cost: maintenanceForm.estimated_cost === "" ? null : Number(maintenanceForm.estimated_cost),
        actual_cost: maintenanceForm.actual_cost === "" ? null : Number(maintenanceForm.actual_cost),
        contractor: maintenanceForm.contractor || null,
        status: maintenanceForm.status,
        description: maintenanceForm.description || null,
      });
      setMaintenanceForm({ section_id: "", activity_type: "", priority: "medium", planned_date: "", completed_date: "", estimated_cost: "", actual_cost: "", contractor: "", status: "planned", description: "" });
      setMessage(`Maintenance #${r.maintenance_id} created successfully.`);
      await loadMaintenance(maintenanceRoadId);
    } catch (e) {
      setMessage(`Maintenance error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function submitPhoto(e) {
    e.preventDefault();
    if (!photo.file) { setMessage("Select a road image first."); return; }
    setSaving(true);
    setMessage("");
    setAiResults([]);
    try {
      const r = await uploadImage({
        file: photo.file,
        inspectionId: photo.inspection_id,
        defectId: photo.defect_id,
        capturedAt: photo.captured_at || new Date().toISOString(),
        latitude: photo.latitude === "" ? null : Number(photo.latitude),
        longitude: photo.longitude === "" ? null : Number(photo.longitude),
      });
      setUploadedImageId(r.image_id);
      setMessage(`Photo #${r.image_id} uploaded successfully. You can now run AI detection.`);
      setPhoto({ file: null, inspection_id: "", defect_id: "", latitude: "", longitude: "", captured_at: "" });
    } catch (e) {
      setMessage(`Upload error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function detectPhoto() {
    if (!uploadedImageId) return;
    setAiRunning(true);
    setMessage("Running AI road-defect detection…");
    try {
      const results = await runAIDetection(uploadedImageId);
      setAiResults(results);
      setMessage(results.length ? `${results.length} AI detection(s) found.` : "AI completed: no detections returned. Check that a trained model is configured.");
    } catch (e) {
      setMessage(`AI detection error: ${e.message}`);
    } finally {
      setAiRunning(false);
    }
  }

  async function loadExistingDetections() {
    if (!uploadedImageId) return;
    try { setAiResults(await getAIDetections(uploadedImageId)); } catch (e) { setMessage(`AI results error: ${e.message}`); }
  }

  const selectedMaintenanceSections = sections.filter((s) => String(s.road_id) === String(maintenanceRoadId));
  const estimatedTotal = maintenance.reduce((sum, x) => sum + (Number(x.estimated_cost) || 0), 0);
  const actualTotal = maintenance.reduce((sum, x) => sum + (Number(x.actual_cost) || 0), 0);
  const completedCount = maintenance.filter((x) => String(x.status).toLowerCase() === "completed").length;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div><h1>Road Asset Management System</h1><p>RAMS · Road infrastructure management dashboard</p></div>
        <span className="status">API v0.9</span>
      </header>
      <main className="dashboard">
        {error && <div className="error-banner">API connection: {error}</div>}
        <section className="cards">
          <div className="card"><span>Roads</span><strong>{loading ? "…" : roads.length}</strong></div>
          <div className="card"><span>GPS Tracks</span><strong>{loading ? "…" : gpsGeoJSON?.features?.length ?? 0}</strong></div>
          <div className="card"><span>Sections</span><strong>{loading ? "…" : sectionGeoJSON?.features?.length ?? 0}</strong></div>
          <div className="card"><span>Assets</span><strong>{loading ? "…" : assetGeoJSON?.features?.length ?? 0}</strong></div>
          <div className="card"><span>Defects</span><strong>{loading ? "…" : defectGeoJSON?.features?.length ?? 0}</strong></div>
        </section>

        <section className="action-panel"><h2>Field Data Entry</h2><p>Create inspections, defects and field photos.</p><div className="actions"><button onClick={() => openForm("inspection")}>+ New Inspection</button><button onClick={() => openForm("defect")}>+ New Defect</button></div></section>

        <section className="form-panel">
          <div className="form-header"><div><h2>🛠️ Maintenance Management</h2><p>Plan, track and review road maintenance activities and costs.</p></div><button type="button" onClick={() => loadMaintenance()}>Refresh</button></div>
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
              <label>Activity Type<input value={maintenanceForm.activity_type} onChange={(e) => updateMaintenance("activity_type", e.target.value)} placeholder="Routine grading, pothole repair…" required /></label>
              <label>Priority<select value={maintenanceForm.priority} onChange={(e) => updateMaintenance("priority", e.target.value)}><option>low</option><option>medium</option><option>high</option><option>critical</option></select></label>
              <label>Status<select value={maintenanceForm.status} onChange={(e) => updateMaintenance("status", e.target.value)}><option>planned</option><option>in_progress</option><option>completed</option><option>cancelled</option></select></label>
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
            {maintenanceLoading ? <p>Loading maintenance records…</p> : maintenance.length === 0 ? <p>No maintenance activities recorded for this road.</p> : <div className="table-wrap"><table><thead><tr><th>Activity</th><th>Section</th><th>Priority</th><th>Status</th><th>Planned</th><th>Completed</th><th>Estimated</th><th>Actual</th><th>Contractor</th></tr></thead><tbody>{maintenance.map((m) => { const section = sections.find((s) => s.section_id === m.section_id); return <tr key={m.maintenance_id}><td>{m.activity_type}</td><td>{section?.section_code || m.section_id || "Whole road"}</td><td>{m.priority || "—"}</td><td>{m.status}</td><td>{m.planned_date || "—"}</td><td>{m.completed_date || "—"}</td><td>{m.estimated_cost == null ? "—" : Number(m.estimated_cost).toLocaleString()}</td><td>{m.actual_cost == null ? "—" : Number(m.actual_cost).toLocaleString()}</td><td>{m.contractor || "—"}</td></tr>; })}</tbody></table></div>}
          </div>
        </section>

        <section className="form-panel">
          <div className="form-header"><div><h2>📷 Field Photo + AI Inspection</h2><p>Upload a road photo, capture GPS, then run the configured road-defect model.</p></div></div>
          <form onSubmit={submitPhoto}>
            <label>Road Photo<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(e) => updatePhoto("file", e.target.files?.[0] || null)} required /></label>
            {photo.file && <div className="photo-preview">Selected: {photo.file.name}</div>}
            <label>Inspection ID (optional)<input type="number" value={photo.inspection_id} onChange={(e) => updatePhoto("inspection_id", e.target.value)} /></label>
            <label>Defect ID (optional)<input type="number" value={photo.defect_id} onChange={(e) => updatePhoto("defect_id", e.target.value)} /></label>
            <div className="form-grid"><label>Latitude<input type="number" step="any" value={photo.latitude} onChange={(e) => updatePhoto("latitude", e.target.value)} /></label><label>Longitude<input type="number" step="any" value={photo.longitude} onChange={(e) => updatePhoto("longitude", e.target.value)} /></label></div>
            <button type="button" onClick={captureGPS}>📍 Capture Current GPS</button>
            <label>Captured At<input type="datetime-local" value={photo.captured_at} onChange={(e) => updatePhoto("captured_at", e.target.value)} /></label>
            <div className="form-footer"><button type="submit" disabled={saving}>{saving ? "Uploading…" : "Upload Photo"}</button>{message && <span>{message}</span>}</div>
          </form>

          {uploadedImageId && (
            <div className="ai-panel">
              <div className="form-header"><div><h3>🤖 AI Defect Detection</h3><p>Image #{uploadedImageId}</p></div><button type="button" onClick={loadExistingDetections}>Refresh Results</button></div>
              <button type="button" onClick={detectPhoto} disabled={aiRunning}>{aiRunning ? "Analyzing…" : "Run AI Detection"}</button>
              {aiResults.length > 0 && <div className="ai-results"><h4>Detections</h4>{aiResults.map((d) => <div className="ai-result" key={d.detection_id}><strong>{d.defect_type}</strong><span>{(Number(d.confidence) * 100).toFixed(1)}% confidence</span><small>{d.model_name}{d.model_version ? ` · ${d.model_version}` : ""}</small></div>)}</div>}
            </div>
          )}
        </section>

        {showForm && <section className="form-panel"><div className="form-header"><h2>{formType === "inspection" ? "New Road Inspection" : "New Road Defect"}</h2><button type="button" onClick={() => setShowForm(false)}>Close</button></div><form onSubmit={submitForm}>{formType === "inspection" ? <><label>Road Section<select value={form.section_id} onChange={(e) => update("section_id", e.target.value)} required><option value="">Select section</option>{sections.map((s) => <option key={s.section_id} value={s.section_id}>{s.section_code} ({s.start_chainage}–{s.end_chainage} km)</option>)}</select></label><label>Inspection Date<input type="date" value={form.inspection_date} onChange={(e) => update("inspection_date", e.target.value)} required /></label><label>Condition Rating (0–100)<input type="number" min="0" max="100" step="0.01" value={form.condition_rating} onChange={(e) => update("condition_rating", e.target.value)} /></label><label>Weather<input value={form.weather} onChange={(e) => update("weather", e.target.value)} /></label><label>Notes<textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} /></label></> : <><label>Inspection ID<input type="number" value={form.inspection_id} onChange={(e) => update("inspection_id", e.target.value)} required /></label><label>Road Section<select value={form.section_id} onChange={(e) => update("section_id", e.target.value)}><option value="">Use inspection section</option>{sections.map((s) => <option key={s.section_id} value={s.section_id}>{s.section_code}</option>)}</select></label><label>Defect Type<input value={form.defect_type} onChange={(e) => update("defect_type", e.target.value)} required /></label><label>Severity<select value={form.severity} onChange={(e) => update("severity", e.target.value)}><option value="">Select</option><option>low</option><option>medium</option><option>high</option><option>critical</option></select></label><label>Chainage (km)<input type="number" min="0" step="0.001" value={form.chainage_km} onChange={(e) => update("chainage_km", e.target.value)} /></label><label>Length (m)<input type="number" min="0" step="0.01" value={form.length_m} onChange={(e) => update("length_m", e.target.value)} /></label><label>Width (m)<input type="number" min="0" step="0.01" value={form.width_m} onChange={(e) => update("width_m", e.target.value)} /></label><label>Depth (mm)<input type="number" min="0" step="0.1" value={form.depth_mm} onChange={(e) => update("depth_mm", e.target.value)} /></label><label>Detected By<select value={form.detected_by} onChange={(e) => update("detected_by", e.target.value)}><option>manual</option><option>gps</option><option>ai</option></select></label><label>Description<textarea value={form.description} onChange={(e) => update("description", e.target.value)} /></label></>}<div className="form-footer"><button type="submit" disabled={saving}>{saving ? "Saving…" : "Save Record"}</button>{message && <span>{message}</span>}</div></form></section>}

        <section className="map-panel"><div className="panel-heading"><div><h2>GIS Road Asset & Defect Map</h2><p>{loading ? "Loading spatial data…" : "Roads, GPS tracks, sections, assets and defects are available as map layers."}</p></div><div className="layer-controls">{[["roads", "Roads"], ["gps", "GPS"], ["sections", "Sections"], ["assets", "Assets"], ["defects", "Defects"]].map(([k, l]) => <label key={k}><input type="checkbox" checked={visible[k]} onChange={() => toggleLayer(k)} />{l}</label>)}</div></div><MapContainer center={defaultCenter} zoom={7} className="map"><TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />{visible.roads && roadGeoJSON && <GeoJSON data={roadGeoJSON} style={{ weight: 5 }} />}{visible.gps && gpsGeoJSON && <GeoJSON data={gpsGeoJSON} style={{ weight: 3, dashArray: "8 6" }} />}{visible.sections && sectionGeoJSON && <GeoJSON data={sectionGeoJSON} style={{ weight: 4, dashArray: "4 4" }} />}{visible.assets && assetGeoJSON && <GeoJSON data={assetGeoJSON} pointToLayer={(f, ll) => L.circleMarker(ll, { radius: 7, weight: 2 })} />}{visible.defects && defectGeoJSON && <GeoJSON data={defectGeoJSON} pointToLayer={(f, ll) => L.circleMarker(ll, { radius: 8, weight: 2 })} />}<FitLayers layers={[roadGeoJSON, gpsGeoJSON, sectionGeoJSON, assetGeoJSON, defectGeoJSON]} /></MapContainer></section>
      </main>
    </div>
  );
}

export default App;