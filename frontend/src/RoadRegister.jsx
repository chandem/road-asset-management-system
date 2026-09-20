import { useCallback, useEffect, useState } from "react";
import {
  archiveRoad,
  createRoad,
  deleteRoad,
  generateRoadSections,
  getRoadSections,
  getRoads,
  updateRoad,
} from "./api";
import RoadGeometryDrawer from "./RoadGeometryDrawer";

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

const selectedRoadStyles = `
  .road-register .selected-road-banner {
    display: flex; align-items: center; gap: .75rem; margin: 1rem 0;
    padding: 1rem 1.15rem; border: 2px solid #c7a764; border-radius: 12px;
    background: linear-gradient(90deg, #f7f1e5, #efe7d5); color: #4d3c25;
    font-weight: 700; box-shadow: 0 4px 14px rgba(123, 96, 52, 0.12);
  }
  .road-register .selected-road-banner::before {
    content: "✓"; display: grid; place-items: center; width: 30px; height: 30px;
    border-radius: 50%; background: #b68d45; color: white; font-size: 1.1rem;
  }
  .road-register tbody tr.road-row { cursor: pointer; }
  .road-register tbody tr.road-row:focus-visible td { outline: 3px solid #b68d45; outline-offset: -3px; }
  .road-register tr.row-selected td {
    background: #2f466a !important; color: white !important;
    border-top: 3px solid #d7b36a; border-bottom: 3px solid #d7b36a;
    font-weight: 700; box-shadow: inset 0 8px 16px rgba(15, 23, 42, 0.08), inset 0 -8px 16px rgba(15, 23, 42, 0.08);
  }
  .road-register tr.row-selected td:first-child {
    border-left: 8px solid #b68d45; padding-left: calc(.9rem - 7px);
  }
  .road-register tr.row-selected td:last-child { border-right: 3px solid #d7b36a; }
  .road-register tr.row-selected:hover td { background: #3a527c !important; }
  .road-register .road-code-cell { display: inline-flex; align-items: center; gap: .55rem; }
  .road-register .selected-road-badge {
    display: inline-flex; align-items: center; padding: .3rem .55rem;
    border-radius: 999px; background: #d8bf82; color: #342b1a;
    font-size: .7rem; font-weight: 800; letter-spacing: .06em; text-transform: uppercase;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
  .road-register .selected-action {
    background: #d8bf82 !important; color: #2d2418 !important; border-color: #b68d45 !important; font-weight: 800;
  }
  .road-register .danger-action {
    color: #991b1b !important; border-color: #fca5a5 !important;
  }
  .road-register .danger-action:hover {
    background: #fef2f2 !important;
  }
  .road-draw-panel {
    margin: 1rem 0 1.25rem; padding: 1rem;
    border: 1px solid #e2e8f0; border-radius: 14px; background: #f8fafc;
  }
  .road-draw-toolbar, .road-draw-stats {
    display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin-bottom: 0.75rem;
  }
  .road-draw-stats span { font-size: 0.9rem; color: #475569; }
  .road-draw-stats .draw-mode-on { color: #0369a1; font-weight: 700; }
  .road-draw-stats .draw-mode-off { color: #64748b; }
  .road-draw-map {
    border-radius: 12px; overflow: hidden; border: 1px solid #cbd5e1;
    margin-bottom: 0.75rem;
  }
  .road-draw-wkt textarea { font-family: ui-monospace, monospace; font-size: 0.8rem; }
`;

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
  const [showDrawer, setShowDrawer] = useState(false);

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
    setShowDrawer(false);
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
    setShowDrawer(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function applyDrawnGeometry({ geometry_wkt, total_length_km }) {
    setForm((prev) => ({
      ...prev,
      geometry_wkt: geometry_wkt || prev.geometry_wkt,
      total_length_km:
        total_length_km != null && total_length_km > 0
          ? String(total_length_km)
          : prev.total_length_km,
    }));
    setShowDrawer(false);
    setMessage(
      `Geometry applied (${total_length_km} km estimated). Save the road to store it in the database.`,
    );
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
      setShowDrawer(false);
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

  async function handleDelete(road) {
    const ok = window.confirm(
      `PERMANENTLY DELETE road ${road.road_code} (${road.road_name})?\n\n` +
        "This removes the road and related sections/assets where the database allows CASCADE.\n" +
        "This cannot be undone. Prefer Archive if you only want to hide it.",
    );
    if (!ok) return;
    const typed = window.prompt(
      `Type the road code "${road.road_code}" to confirm permanent delete:`,
    );
    if (typed !== road.road_code) {
      setMessage("Delete cancelled — road code did not match.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await deleteRoad(road.road_id);
      setMessage(`Deleted ${road.road_code} from the system.`);
      if (selectedId === road.road_id) {
        setSelectedId(null);
        setSections([]);
      }
      if (editingId === road.road_id) {
        setEditingId(null);
        setForm(EMPTY_FORM);
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

  function handleRoadRowKeyDown(event, roadId) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      loadSections(roadId);
    }
  }

  return (
    <section className="action-panel road-register" aria-label="Road register">
      <style>{selectedRoadStyles}</style>
      <div className="panel-heading">
        <div>
          <h2>Road register</h2>
          <p>
            Add, edit, archive, or permanently delete roads. Draw geometry on the map or paste WKT.
            Section generation (default 500 m) saves to PostgreSQL/PostGIS.
          </p>
        </div>
        <button type="button" onClick={startCreate}>+ Add road</button>
      </div>

      {message && <p className="form-message">{message}</p>}
      {error && <p className="error-banner">{error}</p>}

      <form className="road-form" onSubmit={handleSubmit}>
        <h3>{editingId ? `Edit road #${editingId}` : "New road"}</h3>
        <div className="form-grid">
          <label>
            Code *
            <input
              required
              value={form.road_code}
              onChange={(e) => updateField("road_code", e.target.value)}
              placeholder="A1"
            />
          </label>
          <label>
            Name *
            <input
              required
              value={form.road_name}
              onChange={(e) => updateField("road_name", e.target.value)}
              placeholder="Main corridor"
            />
          </label>
          <label>
            Class
            <input
              value={form.road_class}
              onChange={(e) => updateField("road_class", e.target.value)}
              placeholder="primary"
            />
          </label>
          <label>
            Surface
            <input
              value={form.surface_type}
              onChange={(e) => updateField("surface_type", e.target.value)}
              placeholder="asphalt"
            />
          </label>
          <label>
            Start location
            <input
              value={form.start_location}
              onChange={(e) => updateField("start_location", e.target.value)}
            />
          </label>
          <label>
            End location
            <input
              value={form.end_location}
              onChange={(e) => updateField("end_location", e.target.value)}
            />
          </label>
          <label>
            Length (km)
            <input
              type="number"
              min="0"
              step="0.001"
              value={form.total_length_km}
              onChange={(e) => updateField("total_length_km", e.target.value)}
              placeholder="12.5"
            />
          </label>
          <label>
            Status
            <select value={form.status} onChange={(e) => updateField("status", e.target.value)}>
              <option value="active">active</option>
              <option value="planned">planned</option>
              <option value="archived">archived</option>
            </select>
          </label>
        </div>

        <div className="actions" style={{ marginBottom: "0.75rem" }}>
          <button type="button" onClick={() => setShowDrawer((v) => !v)}>
            {showDrawer ? "Hide map drawer" : "📍 Draw geometry on map"}
          </button>
        </div>

        {showDrawer && (
          <RoadGeometryDrawer
            onApply={applyDrawnGeometry}
            onCancel={() => setShowDrawer(false)}
            title="Draw road centerline"
          />
        )}

        <label>
          Geometry (WKT LINESTRING, optional)
          <textarea
            rows={3}
            value={form.geometry_wkt}
            onChange={(e) => updateField("geometry_wkt", e.target.value)}
            placeholder="LINESTRING(38.7 9.0, 38.8 9.1) — or use Draw geometry on map"
          />
        </label>
        <div className="actions">
          <button type="submit" className="primary" disabled={saving}>
            {saving ? "Saving…" : editingId ? "Save changes" : "Create road"}
          </button>
          {editingId && (
            <button type="button" onClick={startCreate} disabled={saving}>
              Cancel edit
            </button>
          )}
        </div>
      </form>

      <div className="filter-bar">
        <label>
          Search
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Code, name, location…"
          />
        </label>
        <label>
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="active">active</option>
            <option value="planned">planned</option>
            <option value="archived">archived</option>
          </select>
        </label>
        <button type="button" onClick={loadRoads} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      <div className="selected-road-banner" aria-live="polite">
        {selectedId
          ? `Selected road: #${selectedId}`
          : "No road selected — click a road row to view sections."}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Class</th>
              <th>Length km</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {roads.map((road) => {
              const selected = selectedId === road.road_id;
              return (
                <tr
                  key={road.road_id}
                  className={`road-row ${selected ? "row-selected" : ""}`}
                  aria-selected={selected}
                  tabIndex={0}
                  onClick={() => loadSections(road.road_id)}
                  onKeyDown={(event) => handleRoadRowKeyDown(event, road.road_id)}
                >
                  <td>
                    <span className="road-code-cell">
                      {road.road_code}
                      {selected && <span className="selected-road-badge">Selected</span>}
                    </span>
                  </td>
                  <td>{road.road_name}</td>
                  <td>{road.road_class || "—"}</td>
                  <td>{road.total_length_km ?? "—"}</td>
                  <td>{road.status}</td>
                  <td className="row-actions">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        startEdit(road);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className={selected ? "selected-action" : ""}
                      onClick={(event) => {
                        event.stopPropagation();
                        loadSections(road.road_id);
                      }}
                    >
                      {selected ? "Selected" : "Sections"}
                    </button>
                    {road.status !== "archived" && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleArchive(road);
                        }}
                      >
                        Archive
                      </button>
                    )}
                    <button
                      type="button"
                      className="danger-action"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDelete(road);
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
            {!loading && roads.length === 0 && (
              <tr>
                <td colSpan={6}>No roads match the filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedId && (
        <div className="section-panel">
          <div className="panel-heading">
            <div>
              <h3>Sections for road #{selectedId}</h3>
              <p>List and auto-generate fixed-length chainage sections.</p>
            </div>
          </div>
          <div className="filter-bar">
            <label>
              Section length (m)
              <input
                type="number"
                min="50"
                step="50"
                value={sectionLengthM}
                onChange={(e) => setSectionLengthM(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="primary"
              disabled={saving}
              onClick={() => handleGenerateSections(false)}
            >
              Generate sections
            </button>
            <button type="button" disabled={saving} onClick={() => handleGenerateSections(true)}>
              Regenerate (replace)
            </button>
          </div>
          {sectionsLoading ? (
            <p>Loading sections…</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Start km</th>
                    <th>End km</th>
                    <th>Length km</th>
                    <th>Surface</th>
                    <th>Condition</th>
                  </tr>
                </thead>
                <tbody>
                  {sections.map((s) => (
                    <tr key={s.section_id}>
                      <td>{s.section_code}</td>
                      <td>{s.start_chainage}</td>
                      <td>{s.end_chainage}</td>
                      <td>{s.length_km ?? "—"}</td>
                      <td>{s.surface_type || "—"}</td>
                      <td>{s.condition_rating ?? "—"}</td>
                    </tr>
                  ))}
                  {sections.length === 0 && (
                    <tr>
                      <td colSpan={6}>No sections yet. Set length or geometry, then generate.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
