import { useEffect, useMemo, useState } from "react";
import "leaflet/dist/leaflet.css";
import {
  createDefect, createInspection, createMaintenance, getAIDetections, getAIStatus, getDashboardSummary, getDashboardAttention, getDashboardKPIs, getDefectGeoJSON, getGPSTrackGeoJSON,
  getRoadAssetGeoJSON, getRoadGeoJSON, getRoadMaintenance, getRoadSectionGeoJSON,
  runAIDetection, uploadImage,
} from "./api";
import FieldGPS from "./FieldGPS";
import OfflineInspectionQueue from "./OfflineInspectionQueue";
import OfflineDefectQueue from "./OfflineDefectQueue";
import OfflinePhotoQueue from "./OfflinePhotoQueue";
import RAMSMap from "./RAMSMap";
import SummaryCards from "./components/SummaryCards";
import ReportPanel from "./components/ReportPanel";
import AttentionPanel from "./components/AttentionPanel";
import MaintenanceSection from "./components/MaintenanceSection";
import PhotoAIPanel from "./components/PhotoAIPanel";
import InspectionDefectForm from "./components/InspectionDefectForm";
import Reports from "./Reports";
import WorkOrderManagement from "./WorkOrderManagement";
import AssetRegister from "./AssetRegister";
import AuditHistory from "./AuditHistory";
import MaintenancePlanning from "./MaintenancePlanning";
import ConditionAssessment from "./ConditionAssessment";
import MaintenanceAnalytics from "./MaintenanceAnalytics";
import MaintenanceEffectiveness from "./MaintenanceEffectiveness";
import MaintenanceDecisionSupport from "./MaintenanceDecisionSupport";
import InspectionWorkflowPanel from "./InspectionWorkflowPanel";
import { canAccessTab, filterNavGroups, normalizeRole } from "./roles";

function App({ user }) {
  const [roads, setRoads] = useState([]); const [roadGeoJSON, setRoadGeoJSON] = useState(null); const [gpsGeoJSON, setGpsGeoJSON] = useState(null);
  const [sectionGeoJSON, setSectionGeoJSON] = useState(null); const [assetGeoJSON, setAssetGeoJSON] = useState(null); const [defectGeoJSON, setDefectGeoJSON] = useState(null);
  const [sections, setSections] = useState([]); const [inspections, setInspections] = useState([]); const [allMaintenance, setAllMaintenance] = useState([]);
  const [visible, setVisible] = useState({ roads: true, gps: true, sections: true, assets: true, defects: true, chainage: true, maintenance: true });
  const [showForm, setShowForm] = useState(false); const [formType, setFormType] = useState("inspection");
  const [form, setForm] = useState({ section_id: "", inspection_date: new Date().toISOString().slice(0, 10), condition_rating: "", weather: "", notes: "", inspection_id: "", defect_type: "", severity: "", chainage_km: "", length_m: "", width_m: "", depth_mm: "", description: "", detected_by: "manual" });
  const [photo, setPhoto] = useState({ file: null, inspection_id: "", defect_id: "", latitude: "", longitude: "", captured_at: "" });
  const [uploadedImageId, setUploadedImageId] = useState(null); const [aiResults, setAiResults] = useState([]); const [aiRunning, setAiRunning] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);
  const [aiMessage, setAiMessage] = useState("");
  const [saving, setSaving] = useState(false); const [message, setMessage] = useState(""); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [summaryCounts, setSummaryCounts] = useState(null);
  const [attention, setAttention] = useState(null);
  const [kpis, setKpis] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [maintenanceRoadId, setMaintenanceRoadId] = useState(""); const [maintenance, setMaintenance] = useState([]);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [maintenanceForm, setMaintenanceForm] = useState({ section_id: "", chainage_km: "", activity_type: "", priority: "medium", planned_date: "", completed_date: "", estimated_cost: "", actual_cost: "", contractor: "", status: "planned", description: "" });
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    const on = () => setOnline(true); const off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  async function loadDashboard() {
    setLoading(true); setError("");
    try {
      const soft = (p) => p.catch(() => null);
      const [summary, rg, gg, dg, dashboardKpis] = await Promise.all([
        getDashboardSummary(),
        soft(getRoadGeoJSON()),
        soft(getGPSTrackGeoJSON()),
        soft(getDefectGeoJSON()),
        soft(getDashboardKPIs()),
      ]);
      setRoads(summary.roads || []);
      setSections(summary.sections || []);
      setInspections(Array(summary.counts?.inspections || 0).fill(null));
      setAllMaintenance(Array(summary.counts?.maintenance || 0).fill(null));
      setRoadGeoJSON(rg);
      setGpsGeoJSON(gg);
      setDefectGeoJSON(dg);
      setSummaryCounts(summary.counts || null);
      setKpis(dashboardKpis);
      try {
        setAttention(await getDashboardAttention());
      } catch (_) {
        setAttention(null);
      }

      setSectionGeoJSON({ type: "FeatureCollection", features: [] });
      setAssetGeoJSON({ type: "FeatureCollection", features: [] });
      if (summary.roads?.length) {
        try {
          const sectionLayers = await Promise.all(
            summary.roads.map((r) => soft(getRoadSectionGeoJSON(r.road_id))),
          );
          const assetLayers = await Promise.all(
            summary.roads.map((r) => soft(getRoadAssetGeoJSON(r.road_id))),
          );
          setSectionGeoJSON({
            type: "FeatureCollection",
            features: sectionLayers.flatMap((g) => g?.features || []),
          });
          setAssetGeoJSON({
            type: "FeatureCollection",
            features: assetLayers.flatMap((g) => g?.features || []),
          });
        } catch (_) {
          /* map layers optional */
        }
      }
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDashboard(); }, []);

  useEffect(() => {
    if (activeTab !== "field") return;
    let cancelled = false;
    (async () => {
      try {
        const status = await getAIStatus();
        if (!cancelled) setAiStatus(status);
      } catch (e) {
        if (!cancelled) {
          setAiStatus({
            ready: false,
            stub_mode: false,
            message: e.message || "Could not load AI status",
          });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab]);

  async function loadMaintenance(roadId) {
    if (!roadId) { setMaintenance([]); return; }
    setMaintenanceLoading(true);
    try { setMaintenance(await getRoadMaintenance(roadId)); } catch (_) { setMaintenance([]); }
    finally { setMaintenanceLoading(false); }
  }

  useEffect(() => { loadMaintenance(maintenanceRoadId); }, [maintenanceRoadId]);

  function toggleLayer(key) { setVisible((v) => ({ ...v, [key]: !v[key] })); }
  function openForm(type) { setFormType(type); setShowForm(true); setMessage(""); }
  function update(field, value) { setForm((f) => ({ ...f, [field]: value })); }
  function updatePhoto(field, value) { setPhoto((p) => ({ ...p, [field]: value })); }
  function updateMaintenance(field, value) { setMaintenanceForm((f) => ({ ...f, [field]: value })); }

  async function submitForm(e) {
    e.preventDefault(); setSaving(true); setMessage("");
    try {
      if (formType === "inspection") {
        await createInspection(form.section_id, {
          inspection_date: form.inspection_date,
          condition_rating: form.condition_rating ? Number(form.condition_rating) : null,
          weather: form.weather || null, notes: form.notes || null,
        });
        setMessage("Inspection saved.");
      } else {
        if (!form.inspection_id) {
          throw new Error("Inspection ID is required to create a defect");
        }
        await createDefect(Number(form.inspection_id), {
          section_id: form.section_id ? Number(form.section_id) : null,
          defect_type: form.defect_type, severity: form.severity || null,
          chainage_km: form.chainage_km ? Number(form.chainage_km) : null,
          length_m: form.length_m ? Number(form.length_m) : null,
          width_m: form.width_m ? Number(form.width_m) : null,
          depth_mm: form.depth_mm ? Number(form.depth_mm) : null,
          description: form.description || null, detected_by: form.detected_by || "manual",
        });
        setMessage("Defect saved.");
      }
      setShowForm(false); await loadDashboard();
    } catch (err) { setMessage(err.message || String(err)); }
    finally { setSaving(false); }
  }

  async function submitMaintenance(e) {
    e.preventDefault(); if (!maintenanceRoadId) return;
    setSaving(true); setMessage("");
    try {
      await createMaintenance(maintenanceRoadId, {
        activity_type: maintenanceForm.activity_type,
        priority: maintenanceForm.priority || null,
        planned_date: maintenanceForm.planned_date || null,
        completed_date: maintenanceForm.completed_date || null,
        estimated_cost: maintenanceForm.estimated_cost ? Number(maintenanceForm.estimated_cost) : null,
        actual_cost: maintenanceForm.actual_cost ? Number(maintenanceForm.actual_cost) : null,
        contractor: maintenanceForm.contractor || null,
        description: maintenanceForm.description || null,
        status: maintenanceForm.status || "planned",
        section_id: maintenanceForm.section_id ? Number(maintenanceForm.section_id) : null,
        chainage_km: maintenanceForm.chainage_km ? Number(maintenanceForm.chainage_km) : null,
      });
      setMessage("Maintenance activity saved.");
      setMaintenanceForm({ section_id: "", chainage_km: "", activity_type: "", priority: "medium", planned_date: "", completed_date: "", estimated_cost: "", actual_cost: "", contractor: "", status: "planned", description: "" });
      await loadMaintenance(maintenanceRoadId); await loadDashboard();
    } catch (err) { setMessage(err.message || String(err)); }
    finally { setSaving(false); }
  }

  async function submitPhoto(e) {
    e.preventDefault(); if (!photo.file) return;
    setSaving(true); setMessage("");
    try {
      const img = await uploadImage({
        file: photo.file,
        inspectionId: photo.inspection_id || null,
        defectId: photo.defect_id || null,
        latitude: photo.latitude || null,
        longitude: photo.longitude || null,
        capturedAt: photo.captured_at || null,
      });
      setUploadedImageId(img.image_id); setMessage(`Photo uploaded (id ${img.image_id}).`);
    } catch (err) { setMessage(err.message || String(err)); }
    finally { setSaving(false); }
  }

  async function detectPhoto() {
    if (!uploadedImageId) return;
    setAiRunning(true);
    setAiMessage("");
    try {
      const results = await runAIDetection(uploadedImageId);
      const list = Array.isArray(results) ? results : results?.detections || [];
      setAiResults(list);
      if (list.length === 0) {
        setAiMessage(
          aiStatus?.stub_mode
            ? "Stub mode: no detections returned (model not loaded)."
            : "No defects detected above the confidence threshold.",
        );
      } else {
        setAiMessage(`Stored ${list.length} detection(s).`);
      }
    } catch (err) {
      setAiMessage(err.message || String(err));
    } finally {
      setAiRunning(false);
    }
  }

  async function loadExistingDetections() {
    if (!uploadedImageId) return;
    try {
      const results = await getAIDetections(uploadedImageId);
      setAiResults(Array.isArray(results) ? results : results?.detections || []);
    } catch (err) { setMessage(err.message || String(err)); }
  }

  function captureGPS() {
    if (!navigator.geolocation) { setMessage("Geolocation not available"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPhoto((p) => ({
          ...p,
          latitude: String(pos.coords.latitude),
          longitude: String(pos.coords.longitude),
          captured_at: new Date().toISOString(),
        }));
      },
      () => setMessage("Unable to read GPS position"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const report = useMemo(() => ({
    roads: summaryCounts?.roads ?? roads.length,
    inspections: summaryCounts?.inspections ?? inspections.length,
    maintenance: summaryCounts?.maintenance ?? allMaintenance.length,
    defects: summaryCounts?.defects ?? defectGeoJSON?.features?.length ?? 0,
  }), [summaryCounts, defectGeoJSON, allMaintenance, roads, inspections]);

  const completedCount = maintenance.filter((m) => m.status === "completed").length;
  const estimatedTotal = maintenance.reduce((s, m) => s + (Number(m.estimated_cost) || 0), 0);
  const actualTotal = maintenance.reduce((s, m) => s + (Number(m.actual_cost) || 0), 0);

  const role = normalizeRole(user?.role);

  const navGroups = filterNavGroups(role);

  const activeGroup =
    navGroups.find((g) => g.tabs.some((t) => t.id === activeTab)) ||
    navGroups[0] || { id: "home", label: "Home", tabs: [{ id: "overview", label: "Overview" }] };
  const groupTabs = activeGroup.tabs;

  useEffect(() => {
    if (!canAccessTab(activeTab, role) && groupTabs[0]) {
      setActiveTab(groupTabs[0].id);
    }
  }, [role]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Road Asset Management System</h1>
          <p>RAMS · Road infrastructure management dashboard</p>
        </div>
        <div className="topbar-status">
          <span className={`connectivity ${online ? "online" : "offline"}`}>
            {online ? "● Online" : "○ Offline"}
          </span>
          <span className="status role-status">{role}</span>
          <span className="status">API v0.9</span>
        </div>
      </header>

      <nav className="app-nav" aria-label="Main">
        <div className="nav-groups" role="tablist" aria-label="Sections">
          {navGroups.map((group) => (
            <button
              key={group.id}
              type="button"
              role="tab"
              aria-selected={activeGroup.id === group.id}
              className={`nav-group${activeGroup.id === group.id ? " active" : ""}`}
              onClick={() => {
                if (activeGroup.id !== group.id) setActiveTab(group.tabs[0].id);
              }}
            >
              {group.label}
            </button>
          ))}
        </div>
        <div className="nav-tabs" role="tablist" aria-label={activeGroup.label}>
          {groupTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`nav-tab${activeTab === tab.id ? " active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="dashboard">
        {error && <div className="error-banner">API connection: {error}</div>}
        {!online && (
          <div className="offline-banner">
            Offline field mode · New inspections, defects and photos can be captured locally and synchronized when connectivity returns.
          </div>
        )}

        {activeTab === "overview" && (
          <>
            <SummaryCards loading={loading} counts={summaryCounts} roads={roads} gpsGeoJSON={gpsGeoJSON} sectionGeoJSON={sectionGeoJSON} assetGeoJSON={assetGeoJSON} defectGeoJSON={defectGeoJSON} />
            {kpis && (
              <section className="cards" aria-label="RAMS performance KPIs">
                <div className="card"><span>Maintenance completion</span><strong>{kpis.maintenance?.completion_rate_percent ?? "—"}%</strong></div>
                <div className="card"><span>Overdue maintenance</span><strong>{kpis.maintenance?.overdue ?? 0}</strong></div>
                <div className="card"><span>Cost variance</span><strong>{kpis.cost?.variance_percent ?? "—"}%</strong></div>
                <div className="card"><span>Verified work orders</span><strong>{kpis.work_orders?.verified ?? 0}</strong></div>
              </section>
            )}
            <AttentionPanel attention={attention} loading={loading} onNavigate={setActiveTab} />
            <ReportPanel report={report} onRefresh={loadDashboard} />
            <RAMSMap roadGeoJSON={roadGeoJSON} gpsGeoJSON={gpsGeoJSON} sectionGeoJSON={sectionGeoJSON} assetGeoJSON={assetGeoJSON} defectGeoJSON={defectGeoJSON} visible={visible} toggleLayer={toggleLayer} loading={loading} />
          </>
        )}

        {activeTab === "map" && (
          <RAMSMap roadGeoJSON={roadGeoJSON} gpsGeoJSON={gpsGeoJSON} sectionGeoJSON={sectionGeoJSON} assetGeoJSON={assetGeoJSON} defectGeoJSON={defectGeoJSON} visible={visible} toggleLayer={toggleLayer} loading={loading} />
        )}

        {activeTab === "field" && (
          <>
            <section className="action-panel">
              <h2>Field Data Entry</h2>
              <p>Create inspections, defects and field photos.</p>
              <div className="actions">
                <button type="button" onClick={() => openForm("inspection")}>+ New Inspection</button>
                <button type="button" onClick={() => openForm("defect")}>+ New Defect</button>
              </div>
            </section>
            <OfflineInspectionQueue sections={sections} />
            <OfflineDefectQueue sections={sections} />
            <OfflinePhotoQueue />
            <FieldGPS />
            <PhotoAIPanel photo={photo} updatePhoto={updatePhoto} submitPhoto={submitPhoto} captureGPS={captureGPS} saving={saving} uploadedImageId={uploadedImageId} aiResults={aiResults} aiRunning={aiRunning} detectPhoto={detectPhoto} loadExistingDetections={loadExistingDetections} aiStatus={aiStatus} aiMessage={aiMessage} />
          </>
        )}

        {activeTab === "maintenance" && (
          <MaintenanceSection roads={roads} sections={sections} maintenanceRoadId={maintenanceRoadId} setMaintenanceRoadId={setMaintenanceRoadId} maintenance={maintenance} maintenanceLoading={maintenanceLoading} maintenanceForm={maintenanceForm} updateMaintenance={updateMaintenance} submitMaintenance={submitMaintenance} loadMaintenance={loadMaintenance} saving={saving} message={message} completedCount={completedCount} estimatedTotal={estimatedTotal} actualTotal={actualTotal} />
        )}

        {activeTab === "planning" && <MaintenancePlanning />}

        {activeTab === "condition" && <ConditionAssessment />}

        {activeTab === "analytics" && <MaintenanceAnalytics />}

        {activeTab === "effectiveness" && <MaintenanceEffectiveness />}

        {activeTab === "decision" && <MaintenanceDecisionSupport />}

        {activeTab === "workflow" && <InspectionWorkflowPanel />}

        {activeTab === "workorders" && <WorkOrderManagement />}

        {activeTab === "assets" && <AssetRegister />}

        {activeTab === "reports" && <Reports />}

        {activeTab === "audit" && <AuditHistory />}

        {showForm && (
          <InspectionDefectForm formType={formType} form={form} update={update} sections={sections} submitForm={submitForm} saving={saving} message={message} onClose={() => setShowForm(false)} />
        )}
      </main>
    </div>
  );
}

export default App;
