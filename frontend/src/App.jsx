import { useEffect, useMemo, useState } from "react";
import "leaflet/dist/leaflet.css";
import {
  createDefect, createInspection, createMaintenance, getAIDetections, getAIStatus, getDashboardSummary, getDashboardAttention, getDashboardKPIs, getDefectGeoJSON, getGPSTrackGeoJSON,
  getAssetsGeoJSON, getRoadGeoJSON, getRoadMaintenance, getSectionsGeoJSON,
  runAIDetection, uploadImage,
} from "./api";
import FieldGPS from "./FieldGPS";
import OfflineInspectionQueue from "./OfflineInspectionQueue";
import OfflineDefectQueue from "./OfflineDefectQueue";
import OfflinePhotoQueue from "./OfflinePhotoQueue";
import RAMSMap from "./RAMSMap";
import SummaryCards from "./components/SummaryCards";
import EmptyState from "./components/EmptyState";
import ReportPanel from "./components/ReportPanel";
import AttentionPanel from "./components/AttentionPanel";
import KPIDashboard from "./components/KPIDashboard";
import MaintenanceSection from "./components/MaintenanceSection";
import PhotoAIPanel from "./components/PhotoAIPanel";
import InspectionDefectForm from "./components/InspectionDefectForm";
import Reports from "./Reports";
import WorkOrderManagement from "./WorkOrderManagement";
import AssetRegister from "./AssetRegister";
import RoadRegister from "./RoadRegister";
import AuditHistory from "./AuditHistory";
import MaintenancePlanning from "./MaintenancePlanning";
import ConditionAssessment from "./ConditionAssessment";
import MaintenanceAnalytics from "./MaintenanceAnalytics";
import MaintenanceEffectiveness from "./MaintenanceEffectiveness";
import MaintenanceDecisionSupport from "./MaintenanceDecisionSupport";
import InspectionWorkflowPanel from "./InspectionWorkflowPanel";
import { canAccessTab, filterNavGroups, normalizeRole } from "./roles";

function buildReport(summaryCounts, roads, sections, allMaintenance, inspections, defectGeoJSON) {
  const defects = defectGeoJSON?.features || [];
  const severity = {};
  const types = {};

  for (const feature of defects) {
    const props = feature?.properties || {};
    const sev = props.severity || "unknown";
    const type = props.defect_type || "unknown";
    severity[sev] = (severity[sev] || 0) + 1;
    types[type] = (types[type] || 0) + 1;
  }

  const sectionValues = (sections || [])
    .map((section) => Number(section?.condition_index ?? section?.condition_rating))
    .filter((n) => Number.isFinite(n));
  const averageCondition = sectionValues.length
    ? sectionValues.reduce((a, b) => a + b, 0) / sectionValues.length
    : null;

  const planned = (allMaintenance || []).length;
  const completed = (allMaintenance || []).filter(
    (m) => String(m?.status || "").toLowerCase() === "completed",
  ).length;
  const estimated = (allMaintenance || []).reduce(
    (sum, m) => sum + (Number(m?.estimated_cost) || 0),
    0,
  );
  const actual = (allMaintenance || []).reduce(
    (sum, m) => sum + (Number(m?.actual_cost) || 0),
    0,
  );

  const roadCondition = (roads || []).map((road) => {
    const roadSections = (sections || []).filter((section) => {
      const roadId = section?.road_id ?? section?.roadId;
      return roadId == null || String(roadId) === String(road?.road_id);
    });
    const values = roadSections
      .map((section) => Number(section?.condition_index ?? section?.condition_rating))
      .filter((n) => Number.isFinite(n));
    const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    return {
      road_id: road?.road_id,
      road_code: road?.road_code || "—",
      road_name: road?.road_name || road?.name || "—",
      sectionCount: roadSections.length,
      condition: avg,
      total_length_km: road?.total_length_km ?? null,
      status: road?.status || "—",
    };
  });

  return {
    averageCondition,
    inspectionCount: Array.isArray(inspections) ? inspections.length : Number(inspections) || 0,
    defects: defects.length,
    planned,
    completed,
    estimated,
    actual,
    severity,
    types,
    roadCondition,
  };
}

export default function App({ authUser, user, onLogout }) {
  const sessionUser = authUser || user || null;
  const role = normalizeRole(sessionUser?.role);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [roads, setRoads] = useState([]);
  const [sections, setSections] = useState([]);
  const [summaryCounts, setSummaryCounts] = useState(null);
  const [attention, setAttention] = useState(null);
  const [kpis, setKpis] = useState(null);
  const [roadGeoJSON, setRoadGeoJSON] = useState(null);
  const [sectionGeoJSON, setSectionGeoJSON] = useState(null);
  const [assetGeoJSON, setAssetGeoJSON] = useState(null);
  const [defectGeoJSON, setDefectGeoJSON] = useState(null);
  const [gpsGeoJSON, setGpsGeoJSON] = useState(null);
  const [maintenance, setMaintenance] = useState([]);
  const [maintenanceRoadId, setMaintenanceRoadId] = useState("");
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [maintenanceForm, setMaintenanceForm] = useState({ activity_type: "", planned_date: "", status: "planned", estimated_cost: "", actual_cost: "" });
  const [photo, setPhoto] = useState({ file: null, inspection_id: "", defect_id: "", latitude: "", longitude: "" });
  const [uploadedImageId, setUploadedImageId] = useState(null);
  const [aiResults, setAiResults] = useState(null);
  const [aiRunning, setAiRunning] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);
  const [aiMessage, setAiMessage] = useState("");
  const [formOpen, setFormOpen] = useState(null);
  const [visible, setVisible] = useState({ roads: true, sections: true, assets: true, defects: true, gps: true });

  async function loadDashboard() {
    setLoading(true);
    setMessage("");
    try {
      const [summary, attentionData, kpiData, roadsGeo, sectionsGeo, assetsGeo, defectsGeo, gpsGeo] = await Promise.all([
        getDashboardSummary().catch(() => null),
        getDashboardAttention().catch(() => null),
        getDashboardKPIs().catch(() => null),
        getRoadGeoJSON().catch(() => null),
        getSectionsGeoJSON().catch(() => null),
        getAssetsGeoJSON().catch(() => null),
        getDefectGeoJSON().catch(() => null),
        getGPSTrackGeoJSON().catch(() => null),
      ]);
      setSummaryCounts(summary?.counts || summary || null);
      setAttention(attentionData);
      setKpis(kpiData);
      setRoadGeoJSON(roadsGeo);
      setSectionGeoJSON(sectionsGeo);
      setAssetGeoJSON(assetsGeo);
      setDefectGeoJSON(defectsGeo);
      setGpsGeoJSON(gpsGeo);
      const roadList = summary?.roads || roadsGeo?.features?.map((f) => ({ ...(f.properties || {}), road_id: f.properties?.road_id })) || [];
      const sectionList =
        summary?.sections ||
        sectionsGeo?.features?.map((f) => ({ ...(f.properties || {}), section_id: f.properties?.section_id })) ||
        [];
      setRoads(roadList);
      setSections(sectionList);
    } catch (error) {
      setMessage(error.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (activeTab !== "field") return;
    getAIStatus()
      .then(setAiStatus)
      .catch(() => setAiStatus(null));
  }, [activeTab]);

  async function loadMaintenance(roadId) {
    if (!roadId) {
      setMaintenance([]);
      return;
    }
    setMaintenanceLoading(true);
    try {
      const rows = await getRoadMaintenance(roadId);
      setMaintenance(rows || []);
    } catch (error) {
      setMessage(error.message || "Failed to load maintenance");
    } finally {
      setMaintenanceLoading(false);
    }
  }

  useEffect(() => {
    if (maintenanceRoadId) loadMaintenance(maintenanceRoadId);
  }, [maintenanceRoadId]);

  function toggleLayer(key) {
    setVisible((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function openForm(kind) {
    setFormOpen(kind);
  }

  function updateMaintenance(field, value) {
    setMaintenanceForm((prev) => ({ ...prev, [field]: value }));
  }

  function updatePhoto(field, value) {
    setPhoto((prev) => ({ ...prev, [field]: value }));
  }

  async function submitMaintenance(event) {
    event.preventDefault();
    if (!maintenanceRoadId) return;
    setSaving(true);
    try {
      await createMaintenance(maintenanceRoadId, {
        activity_type: maintenanceForm.activity_type,
        planned_date: maintenanceForm.planned_date || null,
        status: maintenanceForm.status,
        estimated_cost: maintenanceForm.estimated_cost === "" ? null : Number(maintenanceForm.estimated_cost),
        actual_cost: maintenanceForm.actual_cost === "" ? null : Number(maintenanceForm.actual_cost),
      });
      setMessage("Maintenance activity saved.");
      setMaintenanceForm({ activity_type: "", planned_date: "", status: "planned", estimated_cost: "", actual_cost: "" });
      await loadMaintenance(maintenanceRoadId);
    } catch (error) {
      setMessage(error.message || "Could not save maintenance");
    } finally {
      setSaving(false);
    }
  }

  async function submitPhoto(event) {
    event.preventDefault();
    if (!photo.file) {
      setMessage("Choose a photo file first.");
      return;
    }
    setSaving(true);
    setAiMessage("");
    try {
      const result = await uploadImage({
        file: photo.file,
        inspectionId: photo.inspection_id || null,
        defectId: photo.defect_id || null,
        latitude: photo.latitude === "" ? null : Number(photo.latitude),
        longitude: photo.longitude === "" ? null : Number(photo.longitude),
      });
      setUploadedImageId(result?.image_id || result?.id || null);
      setMessage("Photo uploaded.");
    } catch (error) {
      setMessage(error.message || "Photo upload failed");
    } finally {
      setSaving(false);
    }
  }

  async function detectPhoto() {
    if (!uploadedImageId) {
      setAiMessage("Upload a photo first.");
      return;
    }
    setAiRunning(true);
    setAiMessage("");
    try {
      const result = await runAIDetection(uploadedImageId);
      setAiResults(result);
      setAiMessage("Detection finished.");
    } catch (error) {
      setAiMessage(error.message || "AI detection failed");
    } finally {
      setAiRunning(false);
    }
  }

  async function loadExistingDetections() {
    if (!uploadedImageId) return;
    try {
      const result = await getAIDetections(uploadedImageId);
      setAiResults(result);
    } catch (error) {
      setAiMessage(error.message || "Could not load detections");
    }
  }

  function captureGPS() {
    if (!navigator.geolocation) {
      setMessage("Geolocation is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPhoto((prev) => ({
          ...prev,
          latitude: String(pos.coords.latitude),
          longitude: String(pos.coords.longitude),
        }));
      },
      () => setMessage("Could not read GPS position."),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  const report = useMemo(
    () => buildReport(summaryCounts, roads, sections, maintenance, [], defectGeoJSON),
    [summaryCounts, roads, sections, maintenance, defectGeoJSON],
  );

  const completedCount = maintenance.filter((m) => String(m?.status || "").toLowerCase() === "completed").length;
  const estimatedTotal = maintenance.reduce((sum, m) => sum + (Number(m.estimated_cost) || 0), 0);
  const actualTotal = maintenance.reduce((sum, m) => sum + (Number(m.actual_cost) || 0), 0);

  const navGroups = filterNavGroups(role);
  const activeGroup =
    navGroups.find((g) => g.tabs.some((t) => t.id === activeTab)) ||
    navGroups[0] || { id: "home", label: "Home", tabs: [{ id: "overview", label: "Overview" }] };
  const groupTabs = activeGroup.tabs || [];

  useEffect(() => {
    if (!canAccessTab(activeTab, role) && groupTabs[0]) setActiveTab(groupTabs[0].id);
  }, [role, activeTab, groupTabs]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <h1>Road Asset Management System</h1>
          <p>Network condition, maintenance, and field operations</p>
        </div>
        <div className="topbar-status">
          <span className={`connectivity ${navigator.onLine ? "online" : "offline"}`}>
            {navigator.onLine ? "Online" : "Offline"}
          </span>
          <div className="topbar-user">
            <div className="topbar-user-meta">
              <span className="topbar-user-label">Signed in</span>
              <strong className="topbar-user-name">
                {sessionUser?.full_name || sessionUser?.username || "User"}
              </strong>
              {sessionUser?.role && (
                <span className="role-badge">{sessionUser.role}</span>
              )}
            </div>
            <button
              type="button"
              className="logout-button"
              onClick={() => onLogout?.()}
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <nav className="app-nav">
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
        {message && <div className="message-info">{message}</div>}

        {activeTab === "overview" && (
          <>
            <SummaryCards
              loading={loading}
              counts={summaryCounts}
              roads={roads}
              gpsGeoJSON={gpsGeoJSON}
              sectionGeoJSON={sectionGeoJSON}
              assetGeoJSON={assetGeoJSON}
              defectGeoJSON={defectGeoJSON}
            />
            {!loading && (summaryCounts?.roads ?? roads?.length ?? 0) === 0 && (
              <EmptyState
                title="No roads in the register yet"
                tone="info"
                actions={[
                  { label: "Go to Roads", primary: true, onClick: () => setActiveTab("roads") },
                  { label: "Open Map", onClick: () => setActiveTab("map") },
                ]}
              >
                <p>
                  Add a road under <strong>Operations → Roads</strong>, draw geometry on the map,
                  then generate 500&nbsp;m sections. For demos, run the GitHub Action{" "}
                  <strong>RAMS Seed Demo Data</strong>.
                </p>
              </EmptyState>
            )}
            <KPIDashboard kpis={kpis} loading={loading} />
            <AttentionPanel attention={attention} loading={loading} onNavigate={setActiveTab} />
            <ReportPanel report={report} onRefresh={loadDashboard} />
            <RAMSMap
              roadGeoJSON={roadGeoJSON}
              gpsGeoJSON={gpsGeoJSON}
              sectionGeoJSON={sectionGeoJSON}
              assetGeoJSON={assetGeoJSON}
              defectGeoJSON={defectGeoJSON}
              visible={visible}
              toggleLayer={toggleLayer}
              loading={loading}
            />
          </>
        )}
        {activeTab === "map" && (
          <RAMSMap
            roadGeoJSON={roadGeoJSON}
            gpsGeoJSON={gpsGeoJSON}
            sectionGeoJSON={sectionGeoJSON}
            assetGeoJSON={assetGeoJSON}
            defectGeoJSON={defectGeoJSON}
            visible={visible}
            toggleLayer={toggleLayer}
            loading={loading}
          />
        )}
        {activeTab === "field" && (
          <>
            <section className="action-panel">
              <h2>Field Data Entry</h2>
              <p>Create inspections, defects and field photos.</p>
              <div className="actions">
                <button type="button" onClick={() => openForm("inspection")}>
                  + New Inspection
                </button>
                <button type="button" onClick={() => openForm("defect")}>
                  + New Defect
                </button>
              </div>
            </section>
            <OfflineInspectionQueue sections={sections} />
            <OfflineDefectQueue sections={sections} />
            <OfflinePhotoQueue />
            <FieldGPS />
            <PhotoAIPanel
              photo={photo}
              updatePhoto={updatePhoto}
              submitPhoto={submitPhoto}
              captureGPS={captureGPS}
              saving={saving}
              uploadedImageId={uploadedImageId}
              aiResults={aiResults}
              aiRunning={aiRunning}
              detectPhoto={detectPhoto}
              loadExistingDetections={loadExistingDetections}
              aiStatus={aiStatus}
              aiMessage={aiMessage}
            />
          </>
        )}
        {activeTab === "roads" && <RoadRegister />}
        {activeTab === "maintenance" && (
          <MaintenanceSection
            roads={roads}
            sections={sections}
            maintenanceRoadId={maintenanceRoadId}
            setMaintenanceRoadId={setMaintenanceRoadId}
            maintenance={maintenance}
            maintenanceLoading={maintenanceLoading}
            maintenanceForm={maintenanceForm}
            updateMaintenance={updateMaintenance}
            submitMaintenance={submitMaintenance}
            loadMaintenance={loadMaintenance}
            saving={saving}
            message={message}
            completedCount={completedCount}
            estimatedTotal={estimatedTotal}
            actualTotal={actualTotal}
          />
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
      </main>

      {formOpen && (
        <InspectionDefectForm
          kind={formOpen}
          sections={sections}
          onClose={() => setFormOpen(null)}
          onSaved={() => {
            setFormOpen(null);
            loadDashboard();
          }}
        />
      )}
    </div>
  );
}
