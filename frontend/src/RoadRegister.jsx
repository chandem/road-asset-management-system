import { useCallback, useEffect, useState } from "react";
import {
  archiveRoad,
  createRoad,
  generateRoadSections,
  getRoadSections,
  getRoads,
  updateRoad,
} from "./api";

const EMPTY_FORM = {
  road_code: "",
  road_name: "",
  road_class: "",
  surface_type: "",
  start_location: "",
  end_location: "",
  total_length_km: "",
  status: "active",
  geometry_wkt: "",
};

export default function RoadRegister() {
  const [roads, setRoads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [sections, setSections] = useState([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [sectionLengthM, setSectionLengthM] = useState(500);

  const loadRoads = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (q.trim()) params.q = q.trim();
      if (statusFilter) params.status = statusFilter;
      const data = await getRoads(params);
      setRoads(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [q, statusFilter]);

  useEffect(() => {
    loadRoads();
  }, [loadRoads]);

  async function loadSections(roadId) {
    setSelectedId(roadId);
    setSectionsLoading(true);
    setSections([]);
    try {
      const data = await getRoadSections(roadId);
      setSections(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSectionsLoading(false);
    }
  }

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setMessage("");
    setError("");
  }

  function startEdit(road) {
    setSelectedId(road.road_id);
    setEditingId(road.road_id);
    setForm({
      road_code: road.road_code || "",
      road_name: road.road_name || "",
      road_class: road.road_class || "",
      surface_type: road.surface_type || "",
      start_location: road.start_location || "",
      end_location: road.end_location || "",
      total_length_km: road.total_length_km != null ? String(road.total_length_km) : "",
      status: road.status || "active",
      geometry_wkt: "",
    });
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    const payload = {
      road_code: form.road_code.trim(),
      road_name: form.road_name.trim(),
      road_class: form.road_class.trim() || null,
      surface_type: form.surface_type.trim() || null,
      start_location: form.start_location.trim() || null,
      end_location: form.end_location.trim() || null,
      total_length_km: form.total_length_km ? Number(form.total_length_km) : null,
      status: form.status || "active",
    };
    if (form.geometry_wkt.trim()) payload.geometry_wkt = form.geometry_wkt.trim();
    try {
      if (editingId) {
        await updateRoad(editingId, payload);
        setMessage(`Road #${editingId} updated.`);
      } else {
        const created = await createRoad(payload);
        setMessage(`Road created (#${created.road_id}).`);
        setSelectedId(created.road_id);
      }
      setEditingId(null);
      setForm(EMPTY_FORM);
      await loadRoads();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(road) {
    if (!window.confirm(`Archive road ${road.road_code}? History is kept.`)) return;
    setSaving(true);
    setError("");
    try {
      await archiveRoad(road.road_id);
      setMessage(`Archived ${road.road_code}.`);
      if (selectedId === road.road_id) {
        setSelectedId(null);
        setSections([]);
      }
      await loadRoads();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateSections(replace = false) {
    if (!selectedId) return;
    if (replace && !window.confirm("Replace all existing sections for this road?")) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await generateRoadSections(selectedId, {
        section_length_m: Number(sectionLengthM) || 500,
        replace_existing: replace,
      });
      setMessage(
        `Generated ${result.sections_created} section(s) of ${result.section_length_m} m ` +
          `(total ${result.total_length_km} km).`,
      );
      await loadSections(selectedId);
      await loadRoads();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="action-panel road-register" aria-label="Road register">
      <div className="panel-heading">
        <div>
          <h2>Road register</h2>
          <p>Add, edit, and archive roads. Optional WKT geometry and automatic section generation (default 500 m) save to the RAMS PostgreSQL/PostGIS database.</p>
        </div>
        <button type="button" onClick={startCreate}>+ Add road</button>
      </div>

      {message && <p className="form-message">{message}</p>}
      {error && <p className="error-banner">{error}</p>}

      <form className="road-form" onSubmit={handleSubmit}>
        <h3>{editingId ? `Edit road #${editingId}` : "New road"}</h3>
        <div className="form-grid">
          <label>Code *<input required value={form.road_code} onChange={(e) => updateField("road_code", e.target.value)} placeholder="A1" /></label>
          <label>Name *<input required value={form.road_name} onChange={(e) => updateField("road_name", e.target.value)} placeholder="Main corridor" /></label>
          <label>Class<input value={form.road_class} onChange={(e) => updateField("road_class", e.target.value)} placeholder="primary" /></label>
          <label>Surface<input value={form.surface_type} onChange={(e) => updateField("surface_type", e.target.value)} placeholder="asphalt" /></label>
          <label>Start location<input value={form.start_location} onChange={(e) => updateField("start_location", e.target.value)} /></label>
          <label>End location<input value={form.end_location} onChange={(e) => updateField("end_location", e.target.value)} /></label>
          <label>Length (km)<input type="number" min="0" step="0.001" value={form.total_length_km} onChange={(e) => updateField("total_length_km", e.target.value)} placeholder="12.5" /></label>
          <label>Status<select value={form.status} onChange={(e) => updateField("status", e.target.value)}><option value="active">active</option><option value="planned">planned</option><option value="archived">archived</option></select></label>
        </div>
        <label>Geometry (WKT LINESTRING, optional)<textarea rows={3} value={form.geometry_wkt} onChange={(e) => updateField("geometry_wkt", e.target.value)} placeholder="LINESTRING(38.7 9.0, 38.8 9.1)" /></label>
        <div className="actions">
          <button type="submit" className="primary" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Create road"}</button>
          {editingId && <button type="button" onClick={startCreate} disabled={saving}>Cancel edit</button>}
        </div>
      </form>

      <div className="filter-bar">
        <label>Search<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Code, name, location…" /></label>
        <label>Status<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">All</option><option value="active">active</option><option value="planned">planned</option><option value="archived">archived</option></select></label>
        <button type="button" onClick={loadRoads} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button>
      </div>

      <div className="selection-hint" aria-live="polite">
        {selectedId ? "Selected road is highlighted. Click another road's Sections button to change selection." : "Select a road using its Sections button."}
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Code</th><th>Name</th><th>Class</th><th>Length km</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {roads.map((road) => {
              const selected = selectedId === road.road_id;
              return (
                <tr key={road.road_id} className={selected ? "row-selected" : ""} aria-selected={selected}>
                  <td><span className="road-code-cell">{road.road_code}{selected && <span className="selected-road-badge">Selected</span>}</span></td>
                  <td>{road.road_name}</td><td>{road.road_class || "—"}</td><td>{road.total_length_km ?? "—"}</td><td>{road.status}</td>
                  <td className="row-actions">
                    <button type="button" onClick={() => startEdit(road)}>Edit</button>
                    <button type="button" className={selected ? "selected-action" : ""} onClick={() => loadSections(road.road_id)}>{selected ? "Selected" : "Sections"}</button>
                    {road.status !== "archived" && <button type="button" onClick={() => handleArchive(road)}>Archive</button>}
                  </td>
                </tr>
              );
            })}
            {!loading && roads.length === 0 && <tr><td colSpan={6}>No roads match the filter.</td></tr>}
          </tbody>
        </table>
      </div>

      {selectedId && (
        <div className="section-panel">
          <div className="panel-heading"><div><h3>Sections for road #{selectedId}</h3><p>List and auto-generate fixed-length chainage sections.</p></div></div>
          <div className="filter-bar">
            <label>Section length (m)<input type="number" min="50" step="50" value={sectionLengthM} onChange={(e) => setSectionLengthM(e.target.value)} /></label>
            <button type="button" className="primary" disabled={saving} onClick={() => handleGenerateSections(false)}>Generate sections</button>
            <button type="button" disabled={saving} onClick={() => handleGenerateSections(true)}>Regenerate (replace)</button>
          </div>
          {sectionsLoading ? <p>Loading sections…</p> : <div className="table-wrap"><table><thead><tr><th>Code</th><th>Start km</th><th>End km</th><th>Length km</th><th>Surface</th><th>Condition</th></tr></thead><tbody>{sections.map((s) => <tr key={s.section_id}><td>{s.section_code}</td><td>{s.start_chainage}</td><td>{s.end_chainage}</td><td>{s.length_km ?? "—"}</td><td>{s.surface_type || "—"}</td><td>{s.condition_rating ?? "—"}</td></tr>)}{sections.length === 0 && <tr><td colSpan={6}>No sections yet. Set length or geometry, then generate.</td></tr>}</tbody></table></div>}
        </div>
      )}
    </section>
  );
}
