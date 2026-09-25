import { useEffect, useMemo, useState } from "react";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getChainagePoints, getRoadMaintenanceGeoJSON, getMaintenanceHistory, getMaintenanceWorkOrders, getWorkOrderExecution, getWorkOrderVerification, getRoadInspections } from "./api";

const defaultCenter = [8.0, 39.0];

function FitLayers({ layers }) {
  const map = useMap();
  useEffect(() => {
    const group = L.featureGroup();
    layers.forEach((data) => {
      if (data?.features?.length) group.addLayer(L.geoJSON(data));
    });
    const bounds = group.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30] });
  }, [layers, map]);
  return null;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function popupContent(properties = {}) {
  const entries = Object.entries(properties).filter(
    ([key, value]) => value !== null && value !== undefined && value !== "" && key !== "geometry",
  );
  if (!entries.length) return "<strong>RAMS feature</strong><br/>No attribute information available.";
  return `<div class=\"rams-popup\"><strong>RAMS Feature</strong><table>${entries
    .map(([key, value]) => `<tr><td><strong>${escapeHtml(key.replaceAll("_", " "))}</strong></td><td>${escapeHtml(value)}</td></tr>`)
    .join("")}</table></div>`;
}

function popupHandlers() {
  return (feature, layer) => layer.bindPopup(popupContent(feature?.properties));
}

function featureStyle(weight, dashArray) {
  return { weight, dashArray, opacity: 0.9 };
}

function conditionCategory(score) {
  if (!Number.isFinite(score)) return "Not rated";
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Fair";
  if (score >= 30) return "Poor";
  return "Critical";
}

function conditionPriority(score, critical, high) {
  if (score < 30 || critical > 0) return "critical";
  if (score < 50 || high >= 2) return "high";
  if (score < 70 || high === 1) return "medium";
  return "low";
}

function conditionColor(score) {
  if (!Number.isFinite(score)) return "#64748b";
  if (score >= 85) return "#16a34a";
  if (score >= 70) return "#65a30d";
  if (score >= 50) return "#eab308";
  if (score >= 30) return "#f97316";
  return "#dc2626";
}

function severityColor(severity) {
  const value = String(severity || "").toLowerCase();
  return { critical: "#991b1b", high: "#dc2626", medium: "#f59e0b", low: "#16a34a" }[value] || "#64748b";
}

function sectionStyle(feature) {
  const score = Number(feature?.properties?.condition_rating);
  const weight = Number.isFinite(score) ? (score < 30 ? 7 : score < 50 ? 6 : score < 70 ? 5 : 4) : 4;
  const color = conditionColor(score);
  return { color, weight, fillColor: color, fillOpacity: 0.18, dashArray: "4 4", opacity: 0.95 };
}

function pointStyle(radius) {
  return (feature, latlng) => {
    const severity = String(feature?.properties?.severity || "").toLowerCase();
    const radiusBySeverity = { critical: radius + 3, high: radius + 2, medium: radius + 1 };
    return L.circleMarker(latlng, {
      radius: radiusBySeverity[severity] || radius,
      weight: 2,
      fillOpacity: 0.8,
    });
  };
}

function maintenanceStyle(feature, latlng) {
  const priority = String(feature?.properties?.priority || "").toLowerCase();
  const radius = { critical: 10, high: 8, medium: 7, low: 6 }[priority] || 6;
  const color = { critical: "#991b1b", high: "#dc2626", medium: "#f59e0b", low: "#16a34a" }[priority] || "#64748b";
  return L.circleMarker(latlng, { radius, color, fillColor: color, weight: 2, fillOpacity: 0.78 });
}

function chainageStyle(feature, latlng) {
  return L.circleMarker(latlng, { radius: 4, weight: 1, fillOpacity: 0.9 });
}

const conditionLegend = [
  ["Excellent", "≥ 85", "#16a34a"],
  ["Good", "70–84", "#65a30d"],
  ["Fair", "50–69", "#eab308"],
  ["Poor", "30–49", "#f97316"],
  ["Critical", "< 30", "#dc2626"],
];

const priorityLegend = [
  ["Critical", "largest marker"],
  ["High", "large marker"],
  ["Medium", "medium marker"],
  ["Low", "small marker"],
];

export default function RAMSMap({ roadGeoJSON, gpsGeoJSON, sectionGeoJSON, assetGeoJSON, defectGeoJSON, visible, toggleLayer, loading, onNavigate, onSectionSelect }) {
  const [chainageGeoJSON, setChainageGeoJSON] = useState(null);
  const [maintenanceGeoJSON, setMaintenanceGeoJSON] = useState(null);
  const [selectedRoad, setSelectedRoad] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [spatialLoading, setSpatialLoading] = useState(false);
  const [selectedSection, setSelectedSection] = useState(null);
  const [sectionDetail, setSectionDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [conditionFilter, setConditionFilter] = useState("all");
  const [defectSeverityFilter, setDefectSeverityFilter] = useState("all");
  const [maintenancePriorityFilter, setMaintenancePriorityFilter] = useState("all");
  const [assetTypeFilter, setAssetTypeFilter] = useState("all");

  const roadIds = useMemo(
    () => [...new Set((roadGeoJSON?.features || []).map((f) => f?.properties?.road_id).filter(Boolean))],
    [roadGeoJSON],
  );

  const filtered = useMemo(() => {
    const roadFilter = (data) => {
      if (!data) return null;
      const id = selectedRoad === "all" ? null : Number(selectedRoad);
      return { ...data, features: data.features.filter((f) => id == null || Number(f?.properties?.road_id) === id) };
    };
    const roadData = roadFilter(roadGeoJSON);
    const sectionData = roadFilter(sectionGeoJSON);
    const assetData = roadFilter(assetGeoJSON);
    const defectData = roadFilter(defectGeoJSON);
    const maintenanceData = roadFilter(maintenanceGeoJSON);
    const conditionFilterFn = (feature) => conditionFilter === "all" || conditionCategory(Number(feature?.properties?.condition_rating)).toLowerCase() === conditionFilter;
    const severityFilterFn = (feature) => defectSeverityFilter === "all" || String(feature?.properties?.severity || "").toLowerCase() === defectSeverityFilter;
    const priorityFilterFn = (feature) => maintenancePriorityFilter === "all" || String(feature?.properties?.priority || "").toLowerCase() === maintenancePriorityFilter;
    const assetTypeFilterFn = (feature) => assetTypeFilter === "all" || String(feature?.properties?.asset_type || "").toLowerCase() === assetTypeFilter;
    return {
      roadGeoJSON: roadData,
      gpsGeoJSON: roadFilter(gpsGeoJSON),
      sectionGeoJSON: sectionData ? { ...sectionData, features: sectionData.features.filter(conditionFilterFn) } : null,
      assetGeoJSON: assetData ? { ...assetData, features: assetData.features.filter((f) => assetTypeFilterFn(f) && conditionFilterFn(f)) } : null,
      defectGeoJSON: defectData ? { ...defectData, features: defectData.features.filter(severityFilterFn) } : null,
      chainageGeoJSON: roadFilter(chainageGeoJSON),
      maintenanceGeoJSON: maintenanceData ? { ...maintenanceData, features: maintenanceData.features.filter(priorityFilterFn) } : null,
    };
  }, [selectedRoad, conditionFilter, defectSeverityFilter, maintenancePriorityFilter, assetTypeFilter, roadGeoJSON, gpsGeoJSON, sectionGeoJSON, assetGeoJSON, defectGeoJSON, chainageGeoJSON, maintenanceGeoJSON]);

  const filterOptions = useMemo(() => [...new Set((assetGeoJSON?.features || [])
    .map((f) => String(f?.properties?.asset_type || "").trim().toLowerCase()).filter(Boolean))].sort(), [assetGeoJSON]);

  const filterCounts = useMemo(() => ({
    sections: filtered.sectionGeoJSON?.features?.length || 0,
    assets: filtered.assetGeoJSON?.features?.length || 0,
    defects: filtered.defectGeoJSON?.features?.length || 0,
    maintenance: filtered.maintenanceGeoJSON?.features?.length || 0,
  }), [filtered]);

  useEffect(() => {
    let cancelled = false;
    async function loadSpatialLayers() {
      if (!sectionGeoJSON?.features?.length && !roadIds.length) {
        setChainageGeoJSON(null); setMaintenanceGeoJSON(null); return;
      }
      setSpatialLoading(true);
      try {
        const sections = sectionGeoJSON?.features || [];
        const sectionById = new Map(sections.map((f) => [Number(f?.properties?.section_id), f]));
        const sectionIds = [...new Set(sections.map((f) => f?.properties?.section_id).filter(Boolean))];
        const [chainageResults, maintenanceResults] = await Promise.all([
          Promise.all(sectionIds.map((id) => getChainagePoints(Number(id)).catch(() => []))),
          Promise.all(roadIds.map((id) => getRoadMaintenanceGeoJSON(Number(id)).catch(() => ({ type: "FeatureCollection", features: [] })))),
        ]);
        const chainageFeatures = chainageResults.flatMap((points) => points.map((p) => ({
          type: "Feature", geometry: { type: "Point", coordinates: [Number(p.longitude), Number(p.latitude)] },
          properties: { ...p, road_id: sectionById.get(Number(p.section_id))?.properties?.road_id },
        })));
        const maintenanceFeatures = maintenanceResults.flatMap((collection) => collection?.features || []);
        if (!cancelled) {
          setChainageGeoJSON({ type: "FeatureCollection", features: chainageFeatures });
          setMaintenanceGeoJSON({ type: "FeatureCollection", features: maintenanceFeatures });
        }
      } finally { if (!cancelled) setSpatialLoading(false); }
    }
    loadSpatialLayers();
    return () => { cancelled = true; };
  }, [sectionGeoJSON, roadIds]);

  const layerDefinitions = [
    ["roads", "Roads", filtered.roadGeoJSON], ["gps", "GPS Tracks", filtered.gpsGeoJSON],
    ["sections", "Road Sections", filtered.sectionGeoJSON], ["assets", "Road Assets", filtered.assetGeoJSON],
    ["defects", "Defects", filtered.defectGeoJSON], ["chainage", "Chainage", filtered.chainageGeoJSON],
    ["maintenance", "Maintenance", filtered.maintenanceGeoJSON],
  ];
  const layers = useMemo(() => layerDefinitions.map(([, , data]) => data), [filtered]);
  const roadOptions = (roadGeoJSON?.features || []).map((feature) => ({
    id: feature?.properties?.road_id,
    name: feature?.properties?.road_name || feature?.properties?.road_code || `Road ${feature?.properties?.road_id}`,
  })).filter((x) => x.id);

  async function openSectionDetail(feature) {
    const sectionId = Number(feature?.properties?.section_id);
    if (!sectionId) return;
    setSelectedSection(feature);
    setDetailLoading(true);
    try {
      const defects = (filtered.defectGeoJSON?.features || []).filter((item) => Number(item?.properties?.section_id) === sectionId);
      const maintenance = (filtered.maintenanceGeoJSON?.features || []).filter((item) => Number(item?.properties?.section_id) === sectionId);
      const roadId = Number(feature?.properties?.road_id);
      const roadInspections = roadId ? await getRoadInspections(roadId).catch(() => []) : [];
      const inspections = (roadInspections || []).filter((item) => Number(item?.section_id) === sectionId);
      const maintenanceDetails = await Promise.all(maintenance.map(async (item) => {
        const maintenanceId = Number(item?.properties?.maintenance_id);
        if (!maintenanceId) return { item, history: [], workOrders: [] };
        const [history, workOrders] = await Promise.all([
          getMaintenanceHistory(maintenanceId).catch(() => []),
          getMaintenanceWorkOrders(maintenanceId).catch(() => []),
        ]);
        const enrichedOrders = await Promise.all((workOrders || []).map(async (order) => {
          const id = Number(order?.work_order_id);
          if (!id) return order;
          const [execution, verification] = await Promise.all([
            getWorkOrderExecution(id).catch(() => null),
            getWorkOrderVerification(id).catch(() => null),
          ]);
          return { ...order, execution, verification };
        }));
        return { item, history: history || [], workOrders: enrichedOrders };
      }));
      setSectionDetail({ feature, defects, inspections, maintenance: maintenanceDetails });
    } finally {
      setDetailLoading(false);
    }
  }

  function closeSectionDetail() {
    setSelectedSection(null);
    setSectionDetail(null);
  }

  function openMaintenanceForSection(sectionId) {
    onNavigate?.("maintenance");
    window.setTimeout(() => window.dispatchEvent(new CustomEvent("rams:select-maintenance-section", { detail: { sectionId } })), 0);
  }

  function openWorkOrdersForSection(sectionId) {
    onNavigate?.("workorders");
    window.setTimeout(() => window.dispatchEvent(new CustomEvent("rams:select-workorder-section", { detail: { sectionId } })), 0);
  }

  const sectionPopupHandlers = useMemo(() => (feature, layer) => {
    const sectionId = Number(feature?.properties?.section_id);
    const score = Number(feature?.properties?.condition_rating);
    const defects = (filtered.defectGeoJSON?.features || []).filter((item) => Number(item?.properties?.section_id) === sectionId);
    const maintenance = (filtered.maintenanceGeoJSON?.features || []).filter((item) => Number(item?.properties?.section_id) === sectionId);
    const critical = defects.filter((item) => String(item?.properties?.severity || "").toLowerCase() === "critical").length;
    const high = defects.filter((item) => String(item?.properties?.severity || "").toLowerCase() === "high").length;
    const priority = conditionPriority(Number.isFinite(score) ? score : 100, critical, high);
    const estimated = maintenance.reduce((sum, item) => sum + (Number(item?.properties?.estimated_cost) || 0), 0);
    const actual = maintenance.reduce((sum, item) => sum + (Number(item?.properties?.actual_cost) || 0), 0);
    const statusCounts = maintenance.reduce((counts, item) => {
      const status = String(item?.properties?.status || "unknown").toLowerCase();
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, {});
    const workOrderCount = maintenance.reduce(
      (sum, item) => sum + (Number(item?.properties?.work_order_count) || 0),
      0,
    );
    const verifiedCount = maintenance.reduce(
      (sum, item) => sum + (Number(item?.properties?.verified_count) || 0),
      0,
    );
    const activityRows = maintenance.slice(0, 8).map((item) => {
      const props = item?.properties || {};
      const label = props.activity_type || props.maintenance_id || "Maintenance activity";
      const status = props.status || "unknown";
      return `<li><strong>${escapeHtml(label)}</strong> — ${escapeHtml(status)}${props.priority ? ` · ${escapeHtml(props.priority)} priority` : ""}</li>`;
    }).join("");
    layer.on("click", () => { openSectionDetail(feature); });
    layer.bindPopup(`<div class=\"rams-popup\"><strong>${escapeHtml(feature?.properties?.section_code || `Section ${sectionId}`)}</strong><table>
      <tr><td><strong>Condition</strong></td><td>${Number.isFinite(score) ? score.toFixed(1) : "Not rated"}</td></tr>
      <tr><td><strong>Category</strong></td><td>${conditionCategory(score)}</td></tr>
      <tr><td><strong>Maintenance priority</strong></td><td>${priority}</td></tr>
      <tr><td><strong>Defects</strong></td><td>${defects.length} (${critical} critical, ${high} high)</td></tr>
      <tr><td><strong>Maintenance activities</strong></td><td>${maintenance.length}</td></tr>
      <tr><td><strong>Maintenance status</strong></td><td>${escapeHtml(Object.entries(statusCounts).map(([status, count]) => `${status}: ${count}`).join(", ") || "none")}</td></tr>
      <tr><td><strong>Work orders</strong></td><td>${workOrderCount || "Not recorded"}</td></tr>
      <tr><td><strong>Verified</strong></td><td>${verifiedCount || "Not recorded"}</td></tr>
      <tr><td><strong>Estimated cost</strong></td><td>${estimated.toLocaleString()}</td></tr>
      <tr><td><strong>Actual cost</strong></td><td>${actual.toLocaleString()}</td></tr>
    </table>${activityRows ? `<strong>Recent maintenance</strong><ul>${activityRows}</ul>` : ""}<small>Based on recorded condition, defects and maintenance records.</small></div>`);
  }, [filtered.defectGeoJSON, filtered.maintenanceGeoJSON]);

  const sectionHandlers = useMemo(() => (feature, layer) => {
    sectionPopupHandlers(feature, layer);
    layer.on("click", () => onSectionSelect?.(feature));
  }, [sectionPopupHandlers, onSectionSelect]);

  return (
    <section className="map-panel">
      <div className="panel-heading">
        <div>
          <h2>GIS Road Asset & Decision Support Map</h2>
          <p>
            {loading || spatialLoading
              ? "Loading spatial data…"
              : "Click a road section to review condition, defects, maintenance priority and recorded costs."}
          </p>
        </div>
      </div>

      <button
        type="button"
        className="map-filters-toggle"
        aria-expanded={filtersOpen}
        onClick={() => setFiltersOpen((v) => !v)}
      >
        {filtersOpen ? "Hide filters & legend" : "Show filters & legend"}
      </button>

      <div className={`map-controls-collapse${filtersOpen ? " open" : ""}`}>
        <div className="layer-controls" aria-label="Map filters and layers">
          <label>
            Road
            <select value={selectedRoad} onChange={(e) => setSelectedRoad(e.target.value)}>
              <option value="all">All roads</option>
              {roadOptions.map((road) => (
                <option key={road.id} value={road.id}>{road.name}</option>
              ))}
            </select>
          </label>
          {layerDefinitions.map(([key, label, data]) => (
            <label key={key} title={`Toggle ${label}`}>
              <input type="checkbox" checked={visible[key] ?? true} onChange={() => toggleLayer(key)} />
              {label} ({data?.features?.length ?? 0})
            </label>
          ))}
        </div>

        <div className="map-filter-panel" aria-label="Interactive GIS analysis filters">
          <strong>Analysis filters</strong>
          <div className="layer-controls">
            <label>Condition<select value={conditionFilter} onChange={(e) => setConditionFilter(e.target.value)}><option value="all">All</option><option value="excellent">Excellent</option><option value="good">Good</option><option value="fair">Fair</option><option value="poor">Poor</option><option value="critical">Critical</option></select></label>
            <label>Defect severity<select value={defectSeverityFilter} onChange={(e) => setDefectSeverityFilter(e.target.value)}><option value="all">All</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
            <label>Maintenance priority<select value={maintenancePriorityFilter} onChange={(e) => setMaintenancePriorityFilter(e.target.value)}><option value="all">All</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
            <label>Asset type<select value={assetTypeFilter} onChange={(e) => setAssetTypeFilter(e.target.value)}><option value="all">All</option>{filterOptions.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
            <button type="button" onClick={() => { setConditionFilter("all"); setDefectSeverityFilter("all"); setMaintenancePriorityFilter("all"); setAssetTypeFilter("all"); }}>Reset filters</button>
          </div>
          <div className="map-filter-counts" aria-live="polite">Showing {filterCounts.sections} sections · {filterCounts.assets} assets · {filterCounts.defects} defects · {filterCounts.maintenance} maintenance activities</div>
        </div>

        <div className="map-legend" aria-label="GIS condition and maintenance priority legend">
          <div>
            <strong>Section condition</strong>
            <div className="map-legend-row">
              {conditionLegend.map(([label, range, color]) => (
                <span key={label} title={`${label}: ${range}`} className="map-legend-item">
                  <span aria-hidden="true" className="map-legend-swatch" style={{ borderTopColor: color }} />
                  {label} ({range})
                </span>
              ))}
            </div>
          </div>
          <div>
            <strong>Maintenance priority</strong>
            <div className="map-legend-row">
              {priorityLegend.map(([label, size]) => (
                <span key={label}>{label} · {size}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {(loading || spatialLoading) && (
        <div className="map-loading-overlay" role="status">Loading spatial data…</div>
      )}
      <MapContainer center={defaultCenter} zoom={7} className="map">
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {visible.roads && filtered.roadGeoJSON && <GeoJSON data={filtered.roadGeoJSON} style={featureStyle(5)} onEachFeature={popupHandlers()} />}
        {visible.gps && filtered.gpsGeoJSON && <GeoJSON data={filtered.gpsGeoJSON} style={featureStyle(3, "8 6")} onEachFeature={popupHandlers()} />}
        {visible.sections && filtered.sectionGeoJSON && <GeoJSON data={filtered.sectionGeoJSON} style={sectionStyle} onEachFeature={sectionHandlers} />}
        {visible.assets && filtered.assetGeoJSON && <GeoJSON data={filtered.assetGeoJSON} pointToLayer={pointStyle(7)} onEachFeature={popupHandlers()} />}
        {visible.defects && filtered.defectGeoJSON && <GeoJSON data={filtered.defectGeoJSON} pointToLayer={pointStyle(8)} onEachFeature={popupHandlers()} />}
        {(visible.chainage ?? true) && filtered.chainageGeoJSON && <GeoJSON data={filtered.chainageGeoJSON} pointToLayer={chainageStyle} onEachFeature={popupHandlers()} />}
        {(visible.maintenance ?? true) && filtered.maintenanceGeoJSON && <GeoJSON data={filtered.maintenanceGeoJSON} pointToLayer={maintenanceStyle} onEachFeature={popupHandlers()} />}
        <FitLayers layers={layers} />
      </MapContainer>
      {selectedSection && (
        <aside className="section-detail-panel" aria-label="Road section RAMS record">
          <div className="panel-heading">
            <div>
              <h3>{selectedSection?.properties?.section_code || ("Section " + (selectedSection?.properties?.section_id || ""))}</h3>
              <p>{detailLoading ? "Loading section history…" : "Section-level RAMS record"}</p>
            </div>
            <button type="button" onClick={closeSectionDetail}>Close</button>
          </div>
          {!detailLoading && sectionDetail && (
            <div className="section-detail-content">
              <div className="cards compact">
                <div className="card"><span>Condition</span><strong>{Number.isFinite(Number(selectedSection?.properties?.condition_rating)) ? Number(selectedSection.properties.condition_rating).toFixed(1) : "—"}</strong></div>
                <div className="card"><span>Category</span><strong>{conditionCategory(Number(selectedSection?.properties?.condition_rating))}</strong></div>
                <div className="card"><span>Defects</span><strong>{sectionDetail.defects.length}</strong></div>
                <div className="card"><span>Maintenance</span><strong>{sectionDetail.maintenance.length}</strong></div>
              </div>
              <h4>Inspection history</h4>
              {sectionDetail.inspections.length ? <ul>{sectionDetail.inspections.slice(0, 10).map((item, index) => <li key={item?.inspection_id || index}><strong>{escapeHtml(item?.inspection_date || "Inspection")}</strong> — condition {item?.condition_rating != null ? escapeHtml(item.condition_rating) : "not rated"}{item?.weather ? " · " + escapeHtml(item.weather) : ""}</li>)}</ul> : <p>No recorded inspections for this section.</p>}
              <h4>Defect history</h4>
              {sectionDetail.defects.length ? <ul>{sectionDetail.defects.slice(0, 10).map((item, index) => <li key={item?.properties?.defect_id || index}><strong>{escapeHtml(item?.properties?.defect_type || "Defect")}</strong> — {escapeHtml(item?.properties?.severity || "unclassified")}{item?.properties?.chainage_km != null ? " · Ch. " + item.properties.chainage_km : ""}</li>)}</ul> : <p>No recorded defects for this section.</p>}
              <div className="actions" style={{ marginBottom: 12 }}><button type="button" onClick={() => openMaintenanceForSection(Number(selectedSection?.properties?.section_id))}>Open Maintenance</button><button type="button" onClick={() => openWorkOrdersForSection(Number(selectedSection?.properties?.section_id))}>Open Work Orders</button></div>
              <h4>Maintenance & work-order history</h4>
              {sectionDetail.maintenance.length ? sectionDetail.maintenance.map(({ item, history, workOrders }) => {
                const p = item?.properties || {};
                return <div className="section-maintenance-record" key={p.maintenance_id}>
                  <strong>{escapeHtml(p.activity_type || ("Maintenance " + p.maintenance_id))}</strong>
                  <span> · {escapeHtml(p.status || "unknown")} · {escapeHtml(p.priority || "unclassified")}</span>
                  <div>Estimated: {(Number(p.estimated_cost) || 0).toLocaleString()} · Actual: {(Number(p.actual_cost) || 0).toLocaleString()}</div>
                  <div>History entries: {history.length} · Work orders: {workOrders.length}</div>
                  {workOrders.length ? <ul>{workOrders.map((order, index) => <li key={order?.work_order_id || index}>WO {escapeHtml(order?.order_number || String(order?.work_order_id || ""))}: {escapeHtml(order?.status || "unknown")} · execution {order?.execution ? "recorded" : "not recorded"} · verification {order?.verification?.result || "pending"}</li>)}</ul> : null}
                </div>;
              }) : <p>No maintenance records for this section.</p>}
            </div>
          )}
        </aside>
      )}
    </section>
  );
}
