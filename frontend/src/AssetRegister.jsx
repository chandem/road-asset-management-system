import { useEffect, useMemo, useState } from "react";
import {
  createRoadAsset,
  getDashboardSummary,
  getRoads,
  listAssets,
  getAssetInspections,
  createAssetInspection,
  getAssetDefects,
  getAssetMaintenance,
  getMaintenanceWorkOrders,
} from "./api";

const ASSET_TYPES = [
  "bridge",
  "culvert",
  "sign",
  "drainage",
  "guardrail",
  "lighting",
  "km_post",
  "other",
];

export default function AssetRegister() {
  const [roads, setRoads] = useState([]);
  const [sections, setSections] = useState([]);
  const [assets, setAssets] = useState([]);
  const [roadFilter, setRoadFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [assetInspections, setAssetInspections] = useState([]);
  const [assetDefects, setAssetDefects] = useState([]);
  const [assetMaintenance, setAssetMaintenance] = useState([]);
  const [assetWorkOrders, setAssetWorkOrders] = useState([]);
  const [inspectionForm, setInspectionForm] = useState({ inspection_date: new Date().toISOString().slice(0, 10), condition_rating: "", defect_status: "", notes: "" });
  const [form, setForm] = useState({
    road_id: "",
    section_id: "",
    asset_type: "culvert",
    asset_code: "",
    chainage_km: "",
    condition_rating: "",
    description: "",
  });

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const [roadData, assetData, summary] = await Promise.all([
        getRoads(),
        listAssets(),
        getDashboardSummary().catch(() => null),
      ]);
      setRoads(roadData);
      setAssets(assetData);
      setSections(summary?.sections || []);
    } catch (err) {
      setMessage(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const roadById = useMemo(
    () => new Map(roads.map((r) => [Number(r.road_id), r])),
    [roads],
  );

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (roadFilter !== "all" && Number(a.road_id) !== Number(roadFilter)) return false;
      if (typeFilter !== "all" && String(a.asset_type).toLowerCase() !== typeFilter) return false;
      return true;
    });
  }, [assets, roadFilter, typeFilter]);

  const typeCounts = useMemo(() => {
    const counts = {};
    for (const a of assets) {
      const t = (a.asset_type || "other").toLowerCase();
      counts[t] = (counts[t] || 0) + 1;
    }
    return counts;
  }, [assets]);

  const formSections = useMemo(() => {
    if (!form.road_id) return [];
    return sections.filter((s) => Number(s.road_id) === Number(form.road_id));
  }, [sections, form.road_id]);

  async function openAsset(asset) {
    setSelectedAsset(asset);
    try {
      const [inspections, defects, maintenance] = await Promise.all([
        getAssetInspections(asset.asset_id),
        getAssetDefects(asset.asset_id),
        getAssetMaintenance(asset.asset_id),
      ]);
      const workOrderGroups = await Promise.all(
        maintenance.map(m => getMaintenanceWorkOrders(m.maintenance_id).catch(() => []))
      );
      setAssetInspections(inspections);
      setAssetDefects(defects);
      setAssetMaintenance(maintenance);
      setAssetWorkOrders(workOrderGroups.flat());
    } catch (err) {
      setMessage(err.message || String(err));
    }
  }

  async function saveAssetInspection(e) {
    e.preventDefault();
    if (!selectedAsset) return;
    try {
      await createAssetInspection(selectedAsset.asset_id, { ...inspectionForm, condition_rating: inspectionForm.condition_rating === "" ? null : Number(inspectionForm.condition_rating) });
      await openAsset(selectedAsset);
      setMessage("Asset inspection saved.");
      await load();
    } catch (err) { setMessage(err.message || String(err)); }
  }

  function updateForm(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.road_id || !form.asset_type) {
      setMessage("Road and asset type are required.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await createRoadAsset(Number(form.road_id), {
        asset_type: form.asset_type,
        asset_code: form.asset_code || null,
        section_id: form.section_id ? Number(form.section_id) : null,
        chainage_km: form.chainage_km !== "" ? Number(form.chainage_km) : null,
        condition_rating: form.condition_rating !== "" ? Number(form.condition_rating) : null,
        description: form.description || null,
      });
      setMessage("Asset saved.");
      setShowForm(false);
      setForm({
        road_id: "",
        section_id: "",
        asset_type: "culvert",
        asset_code: "",
        chainage_km: "",
        condition_rating: "",
        description: "",
      });
      await load();
    } catch (err) {
      setMessage(err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel asset-register">
      <div className="panel-heading" style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2>Asset register</h2>
          <p>Bridges, culverts, signs, drainage and other roadside assets.</p>
        </div>
        <button type="button" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ New asset"}
        </button>
      </div>

      <div className="stats-grid" style={{ marginBottom: 16 }}>
        <div><strong>{assets.length}</strong><span>Total assets</span></div>
        <div><strong>{typeCounts.bridge || 0}</strong><span>Bridges</span></div>
        <div><strong>{typeCounts.culvert || 0}</strong><span>Culverts</span></div>
        <div><strong>{typeCounts.sign || 0}</strong><span>Signs</span></div>
      </div>

      <div className="form-grid" style={{ marginBottom: 12 }}>
        <label>
          Road
          <select value={roadFilter} onChange={(e) => setRoadFilter(e.target.value)}>
            <option value="all">All roads</option>
            {roads.map((r) => (
              <option key={r.road_id} value={r.road_id}>
                {r.road_code} — {r.road_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Type
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All types</option>
            {ASSET_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <div className="button-row" style={{ alignItems: "end" }}>
          <button type="button" onClick={load} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {showForm && (
        <form className="report-block" onSubmit={submit} style={{ marginBottom: 16 }}>
          <h3>New asset</h3>
          <div className="form-grid">
            <label>
              Road *
              <select
                required
                value={form.road_id}
                onChange={(e) => updateForm("road_id", e.target.value)}
              >
                <option value="">Select road</option>
                {roads.map((r) => (
                  <option key={r.road_id} value={r.road_id}>
                    {r.road_code} — {r.road_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Section
              <select
                value={form.section_id}
                onChange={(e) => updateForm("section_id", e.target.value)}
                disabled={!form.road_id}
              >
                <option value="">Optional</option>
                {formSections.map((s) => (
                  <option key={s.section_id} value={s.section_id}>
                    {s.section_code}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Type *
              <select
                required
                value={form.asset_type}
                onChange={(e) => updateForm("asset_type", e.target.value)}
              >
                {ASSET_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Asset code
              <input
                value={form.asset_code}
                onChange={(e) => updateForm("asset_code", e.target.value)}
                placeholder="e.g. CUL-A1-012"
              />
            </label>
            <label>
              Chainage (km)
              <input
                type="number"
                step="0.001"
                min="0"
                value={form.chainage_km}
                onChange={(e) => updateForm("chainage_km", e.target.value)}
              />
            </label>
            <label>
              Condition (0–100)
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={form.condition_rating}
                onChange={(e) => updateForm("condition_rating", e.target.value)}
              />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Description
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => updateForm("description", e.target.value)}
              />
            </label>
          </div>
          <div className="button-row">
            <button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save asset"}
            </button>
          </div>
        </form>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Code</th>
              <th>Type</th>
              <th>Road</th>
              <th>Section</th>
              <th>Chainage km</th>
              <th>Condition</th>
              <th>Description</th>
              <th>Lifecycle</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8}>No assets match the filters.</td></tr>
            ) : (
              filtered.map((a) => {
                const road = roadById.get(Number(a.road_id));
                return (
                  <tr key={a.asset_id}>
                    <td>{a.asset_id}</td>
                    <td>{a.asset_code || "—"}</td>
                    <td>{a.asset_type}</td>
                    <td>{road ? `${road.road_code}` : a.road_id}</td>
                    <td>{a.section_id ?? "—"}</td>
                    <td>{a.chainage_km ?? "—"}</td>
                    <td>{a.condition_rating ?? "—"}</td>
                    <td>{a.description || "—"}</td>
                    <td><button type="button" onClick={() => openAsset(a)}>Lifecycle</button></td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {selectedAsset && (
        <div className="report-block" style={{ marginTop: 16 }}>
          <div className="panel-heading" style={{ display: "flex", justifyContent: "space-between" }}>
            <div><h3>Asset lifecycle — {selectedAsset.asset_code || `Asset #${selectedAsset.asset_id}`}</h3><p>Asset → inspection → defect → maintenance → work order lifecycle.</p></div>
            <button type="button" onClick={() => setSelectedAsset(null)}>Close</button>
          </div>
          <form onSubmit={saveAssetInspection} className="form-grid">
            <label>Date<input type="date" value={inspectionForm.inspection_date} onChange={e => setInspectionForm(f => ({...f, inspection_date:e.target.value}))} required /></label>
            <label>Condition (0–100)<input type="number" min="0" max="100" step="0.1" value={inspectionForm.condition_rating} onChange={e => setInspectionForm(f => ({...f, condition_rating:e.target.value}))} /></label>
            <label>Defect status<input value={inspectionForm.defect_status} onChange={e => setInspectionForm(f => ({...f, defect_status:e.target.value}))} placeholder="none / minor / major" /></label>
            <label style={{gridColumn:"1 / -1"}}>Notes<textarea rows={2} value={inspectionForm.notes} onChange={e => setInspectionForm(f => ({...f, notes:e.target.value}))} /></label>
            <div className="button-row"><button type="submit">Record inspection</button></div>
          </form>
          <div className="table-wrap" style={{marginTop:12}}><table><thead><tr><th>Date</th><th>Condition</th><th>Defect</th><th>Notes</th></tr></thead><tbody>{assetInspections.length ? assetInspections.map(i => <tr key={i.asset_inspection_id}><td>{i.inspection_date}</td><td>{i.condition_rating ?? "—"}</td><td>{i.defect_status || "—"}</td><td>{i.notes || "—"}</td></tr>) : <tr><td colSpan={4}>No inspections recorded.</td></tr>}</tbody></table></div>
          <div className="table-wrap" style={{marginTop:16}}><h4>Defects / failures ({assetDefects.length})</h4><table><thead><tr><th>ID</th><th>Type</th><th>Severity</th><th>Chainage</th><th>Detected by</th></tr></thead><tbody>{assetDefects.length ? assetDefects.map(d => <tr key={d.defect_id}><td>{d.defect_id}</td><td>{d.defect_type}</td><td>{d.severity || "—"}</td><td>{d.chainage_km ?? "—"}</td><td>{d.detected_by}</td></tr>) : <tr><td colSpan={5}>No linked defects recorded.</td></tr>}</tbody></table></div>
          <div className="table-wrap" style={{marginTop:16}}><h4>Maintenance history ({assetMaintenance.length})</h4><table><thead><tr><th>ID</th><th>Activity</th><th>Priority</th><th>Status</th><th>Planned</th><th>Actual cost</th></tr></thead><tbody>{assetMaintenance.length ? assetMaintenance.map(m => <tr key={m.maintenance_id}><td>{m.maintenance_id}</td><td>{m.activity_type}</td><td>{m.priority || "—"}</td><td>{m.status}</td><td>{m.planned_date || "—"}</td><td>{m.actual_cost ?? "—"}</td></tr>) : <tr><td colSpan={6}>No linked maintenance activities.</td></tr>}</tbody></table></div>
          <div className="table-wrap" style={{marginTop:16}}><h4>Work orders ({assetWorkOrders.length})</h4><table><thead><tr><th>Order</th><th>Issue date</th><th>Due</th><th>Status</th><th>Assigned to</th></tr></thead><tbody>{assetWorkOrders.length ? assetWorkOrders.map(w => <tr key={w.work_order_id}><td>{w.order_number}</td><td>{w.issue_date}</td><td>{w.due_date || "—"}</td><td>{w.status}</td><td>{w.assigned_to || "—"}</td></tr>) : <tr><td colSpan={5}>No linked work orders.</td></tr>}</tbody></table></div>
        </div>
      )}
      {message && <p className="form-message">{message}</p>}
    </section>
  );
}
