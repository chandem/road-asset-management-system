import { useEffect, useState } from "react";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  createDefect,
  createInspection,
  getDefectGeoJSON,
  getGPSTrackGeoJSON,
  getRoadAssetGeoJSON,
  getRoadGeoJSON,
  getRoadSectionGeoJSON,
  getRoadSections,
  getRoads,
} from "./api";

const defaultCenter = [8.0, 39.0];

function FitLayers({ layers }) {
  const map = useMap();
  useEffect(() => {
    const layer = L.featureGroup();
    layers.forEach((data) => {
      if (data?.features?.length) layer.addLayer(L.geoJSON(data));
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
  const [form, setForm] = useState({ section_id: "", inspection_date: new Date().toISOString().slice(0, 10), condition_rating: "", weather: "", notes: "", inspection_id: "", defect_type: "", severity: "", chainage_km: "", length_m: "", width_m: "", depth_mm: "", description: "", detected_by: "manual" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboard() {
    try {
      setError("");
      const [roadData, geoData, gpsData, defectData] = await Promise.all([getRoads(), getRoadGeoJSON(), getGPSTrackGeoJSON(), getDefectGeoJSON()]);
      const roadIds = roadData.map((road) => road.road_id);
      const [sectionResults, assetResults] = await Promise.all([
        Promise.all(roadIds.map((id) => getRoadSectionGeoJSON(id))),
        Promise.all(roadIds.map((id) => getRoadAssetGeoJSON(id))),
      ]);
      const combine = (collections) => ({ type: "FeatureCollection", features: collections.flatMap((c) => c.features || []) });
      setRoads(roadData); setRoadGeoJSON(geoData); setGpsGeoJSON(gpsData);
      setSectionGeoJSON(combine(sectionResults)); setAssetGeoJSON(combine(assetResults)); setDefectGeoJSON(defectData);
      const sectionLists = await Promise.all(roadIds.map((id) => getRoadSections(id)));
      setSections(sectionLists.flat());
    } catch (err) { setError(err.message || "Unable to connect to RAMS API"); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadDashboard(); }, []);

  const toggleLayer = (name) => setVisible((current) => ({ ...current, [name]: !current[name] }));
  const openForm = (type) => { setFormType(type); setMessage(""); setShowForm(true); };
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  async function submitForm(event) {
    event.preventDefault(); setSaving(true); setMessage("");
    try {
      if (formType === "inspection") {
        if (!form.section_id) throw new Error("Select a road section.");
        const result = await createInspection(Number(form.section_id), {
          inspection_date: form.inspection_date,
          condition_rating: form.condition_rating === "" ? null : Number(form.condition_rating),
          weather: form.weather || null,
          notes: form.notes || null,
        });
        setMessage(`Inspection #${result.inspection_id} created successfully.`);
      } else {
        if (!form.inspection_id) throw new Error("Enter the inspection ID.");
        if (!form.defect_type) throw new Error("Enter the defect type.");
        const result = await createDefect(Number(form.inspection_id), {
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
        setMessage(`Defect #${result.defect_id} created successfully.`);
      }
      await loadDashboard();
    } catch (err) { setMessage(`Error: ${err.message}`); }
    finally { setSaving(false); }
  }

  return (
    <div className="app-shell">
      <header className="topbar"><div><h1>Road Asset Management System</h1><p>RAMS · Road infrastructure management dashboard</p></div><span className="status">API v0.9</span></header>
      <main className="dashboard">
        {error && <div className="error-banner">API connection: {error}</div>}
        <section className="cards">
          <div className="card"><span>Roads</span><strong>{loading ? "…" : roads.length}</strong></div>
          <div className="card"><span>GPS Tracks</span><strong>{loading ? "…" : gpsGeoJSON?.features?.length ?? 0}</strong></div>
          <div className="card"><span>Sections</span><strong>{loading ? "…" : sectionGeoJSON?.features?.length ?? 0}</strong></div>
          <div className="card"><span>Assets</span><strong>{loading ? "…" : assetGeoJSON?.features?.length ?? 0}</strong></div>
          <div className="card"><span>Defects</span><strong>{loading ? "…" : defectGeoJSON?.features?.length ?? 0}</strong></div>
        </section>

        <section className="action-panel">
          <h2>Field Data Entry</h2>
          <p>Create inspection records and register road defects directly from the dashboard.</p>
          <div className="actions"><button onClick={() => openForm("inspection")}>+ New Inspection</button><button onClick={() => openForm("defect")}>+ New Defect</button></div>
        </section>

        {showForm && <section className="form-panel">
          <div className="form-header"><h2>{formType === "inspection" ? "New Road Inspection" : "New Road Defect"}</h2><button type="button" onClick={() => setShowForm(false)}>Close</button></div>
          <form onSubmit={submitForm}>
            {formType === "inspection" ? <>
              <label>Road Section<select value={form.section_id} onChange={(e) => update("section_id", e.target.value)} required><option value="">Select section</option>{sections.map((s) => <option key={s.section_id} value={s.section_id}>{s.section_code} ({s.start_chainage}–{s.end_chainage} km)</option>)}</select></label>
              <label>Inspection Date<input type="date" value={form.inspection_date} onChange={(e) => update("inspection_date", e.target.value)} required /></label>
              <label>Condition Rating (0–100)<input type="number" min="0" max="100" step="0.01" value={form.condition_rating} onChange={(e) => update("condition_rating", e.target.value)} /></label>
              <label>Weather<input value={form.weather} onChange={(e) => update("weather", e.target.value)} placeholder="Sunny, rainy, cloudy..." /></label>
              <label>Notes<textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} /></label>
            </> : <>
              <label>Inspection ID<input type="number" value={form.inspection_id} onChange={(e) => update("inspection_id", e.target.value)} required /></label>
              <label>Road Section<select value={form.section_id} onChange={(e) => update("section_id", e.target.value)}><option value="">Use inspection section</option>{sections.map((s) => <option key={s.section_id} value={s.section_id}>{s.section_code}</option>)}</select></label>
              <label>Defect Type<input value={form.defect_type} onChange={(e) => update("defect_type", e.target.value)} placeholder="Pothole, cracking, rutting..." required /></label>
              <label>Severity<select value={form.severity} onChange={(e) => update("severity", e.target.value)}><option value="">Select</option><option>low</option><option>medium</option><option>high</option><option>critical</option></select></label>
              <label>Chainage (km)<input type="number" min="0" step="0.001" value={form.chainage_km} onChange={(e) => update("chainage_km", e.target.value)} /></label>
              <label>Length (m)<input type="number" min="0" step="0.01" value={form.length_m} onChange={(e) => update("length_m", e.target.value)} /></label>
              <label>Width (m)<input type="number" min="0" step="0.01" value={form.width_m} onChange={(e) => update("width_m", e.target.value)} /></label>
              <label>Depth (mm)<input type="number" min="0" step="0.1" value={form.depth_mm} onChange={(e) => update("depth_mm", e.target.value)} /></label>
              <label>Detected By<select value={form.detected_by} onChange={(e) => update("detected_by", e.target.value)}><option>manual</option><option>gps</option><option>ai</option></select></label>
              <label>Description<textarea value={form.description} onChange={(e) => update("description", e.target.value)} /></label>
            </>}
            <div className="form-footer"><button type="submit" disabled={saving}>{saving ? "Saving…" : "Save Record"}</button>{message && <span>{message}</span>}</div>
          </form>
        </section>}

        <section className="map-panel">
          <div className="panel-heading"><div><h2>GIS Road Asset & Defect Map</h2><p>{loading ? "Loading spatial data…" : "Roads, GPS tracks, sections, assets and defects are available as map layers."}</p></div><div className="layer-controls">{[["roads","Roads"],["gps","GPS"],["sections","Sections"],["assets","Assets"],["defects","Defects"]].map(([key,label]) => <label key={key}><input type="checkbox" checked={visible[key]} onChange={() => toggleLayer(key)} />{label}</label>)}</div></div>
          <MapContainer center={defaultCenter} zoom={7} className="map">
            <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {visible.roads && roadGeoJSON && <GeoJSON data={roadGeoJSON} style={{ weight: 5 }} onEachFeature={(f,l) => { const p=f.properties||{}; l.bindPopup(`<strong>${p.road_code||"Road"}</strong><br/>${p.road_name||""}<br/>Length: ${p.total_length_km??"—"} km`); }} />}
            {visible.gps && gpsGeoJSON && <GeoJSON data={gpsGeoJSON} style={{ weight: 3, dashArray: "8 6" }} onEachFeature={(f,l) => { const p=f.properties||{}; l.bindPopup(`<strong>GPS Track #${p.track_id}</strong><br/>Road ID: ${p.road_id??"—"}<br/>Length: ${p.length_km??"—"} km`); }} />}
            {visible.sections && sectionGeoJSON && <GeoJSON data={sectionGeoJSON} style={{ weight: 4, dashArray: "4 4" }} onEachFeature={(f,l) => { const p=f.properties||{}; l.bindPopup(`<strong>${p.section_code||"Section"}</strong><br/>Chainage: ${p.start_chainage}–${p.end_chainage} km<br/>Condition: ${p.condition_rating??"—"}`); }} />}
            {visible.assets && assetGeoJSON && <GeoJSON data={assetGeoJSON} pointToLayer={(f,ll) => L.circleMarker(ll,{radius:7,weight:2})} onEachFeature={(f,l) => { const p=f.properties||{}; l.bindPopup(`<strong>${p.asset_type||"Asset"}</strong><br/>Code: ${p.asset_code||"—"}<br/>Chainage: ${p.chainage_km??"—"} km`); }} />}
            {visible.defects && defectGeoJSON && <GeoJSON data={defectGeoJSON} pointToLayer={(f,ll) => L.circleMarker(ll,{radius:8,weight:2})} onEachFeature={(f,l) => { const p=f.properties||{}; l.bindPopup(`<strong>${p.defect_type||"Road defect"}</strong><br/>Severity: ${p.severity||"—"}<br/>Chainage: ${p.chainage_km??"—"} km<br/>Detected by: ${p.detected_by||"manual"}`); }} />}
            <FitLayers layers={[roadGeoJSON,gpsGeoJSON,sectionGeoJSON,assetGeoJSON,defectGeoJSON]} />
          </MapContainer>
        </section>
      </main>
    </div>
  );
}

export default App;
