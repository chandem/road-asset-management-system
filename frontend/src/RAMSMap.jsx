import { useEffect, useMemo, useState } from "react";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getChainagePoints, getRoadMaintenance } from "./api";

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
  return `<div class="rams-popup"><strong>RAMS Feature</strong><table>${entries
    .map(([key, value]) => `<tr><td><strong>${escapeHtml(key.replaceAll("_", " "))}</strong></td><td>${escapeHtml(value)}</td></tr>`)
    .join("")}</table></div>`;
}

function popupHandlers() {
  return (feature, layer) => layer.bindPopup(popupContent(feature?.properties));
}

function featureStyle(weight, dashArray) {
  return { weight, dashArray, opacity: 0.9 };
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
  return L.circleMarker(latlng, { radius, weight: 2, fillOpacity: 0.75 });
}

function chainageStyle(feature, latlng) {
  return L.circleMarker(latlng, { radius: 4, weight: 1, fillOpacity: 0.9 });
}

function getPointFromFeature(feature) {
  const geometry = feature?.geometry;
  if (!geometry) return null;
  if (geometry.type === "Point") return geometry.coordinates;
  if (geometry.type === "LineString" && geometry.coordinates.length) {
    return geometry.coordinates[Math.floor(geometry.coordinates.length / 2)];
  }
  return null;
}

export default function RAMSMap({ roadGeoJSON, gpsGeoJSON, sectionGeoJSON, assetGeoJSON, defectGeoJSON, visible, toggleLayer, loading }) {
  const [chainageGeoJSON, setChainageGeoJSON] = useState(null);
  const [maintenanceGeoJSON, setMaintenanceGeoJSON] = useState(null);
  const [selectedRoad, setSelectedRoad] = useState("all");
  const [spatialLoading, setSpatialLoading] = useState(false);

  const roadIds = useMemo(
    () => [...new Set((roadGeoJSON?.features || []).map((f) => f?.properties?.road_id).filter(Boolean))],
    [roadGeoJSON],
  );

  const filtered = useMemo(() => {
    if (selectedRoad === "all") return { roadGeoJSON, gpsGeoJSON, sectionGeoJSON, assetGeoJSON, defectGeoJSON, chainageGeoJSON, maintenanceGeoJSON };
    const id = Number(selectedRoad);
    const filter = (data) => data ? ({ ...data, features: data.features.filter((f) => Number(f?.properties?.road_id) === id) }) : null;
    return {
      roadGeoJSON: filter(roadGeoJSON),
      gpsGeoJSON: filter(gpsGeoJSON),
      sectionGeoJSON: filter(sectionGeoJSON),
      assetGeoJSON: filter(assetGeoJSON),
      defectGeoJSON: filter(defectGeoJSON),
      chainageGeoJSON: filter(chainageGeoJSON),
      maintenanceGeoJSON: filter(maintenanceGeoJSON),
    };
  }, [selectedRoad, roadGeoJSON, gpsGeoJSON, sectionGeoJSON, assetGeoJSON, defectGeoJSON, chainageGeoJSON, maintenanceGeoJSON]);

  useEffect(() => {
    let cancelled = false;
    async function loadSpatialLayers() {
      if (!sectionGeoJSON?.features?.length) {
        setChainageGeoJSON(null);
        setMaintenanceGeoJSON(null);
        return;
      }
      setSpatialLoading(true);
      try {
        const sections = sectionGeoJSON.features;
        const sectionById = new Map(sections.map((f) => [Number(f?.properties?.section_id), f]));
        const sectionIds = [...new Set(sections.map((f) => f?.properties?.section_id).filter(Boolean))];
        const chainageResults = await Promise.all(
          sectionIds.map((id) => getChainagePoints(Number(id)).catch(() => [])),
        );
        const chainageFeatures = chainageResults.flatMap((points) => points.map((p) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [Number(p.longitude), Number(p.latitude)] },
          properties: {
            ...p,
            road_id: sectionById.get(Number(p.section_id))?.properties?.road_id,
          },
        })));

        const maintenanceResults = await Promise.all(
          roadIds.map((id) => getRoadMaintenance(Number(id)).catch(() => [])),
        );
        const maintenanceFeatures = maintenanceResults.flatMap((activities) => activities.flatMap((activity) => {
          const section = sectionById.get(Number(activity.section_id));
          const coordinates = getPointFromFeature(section);
          if (!coordinates) return [];
          return [{
            type: "Feature",
            geometry: { type: "Point", coordinates },
            properties: { ...activity, road_id: Number(activity.road_id) || section?.properties?.road_id },
          }];
        }));

        if (!cancelled) {
          setChainageGeoJSON({ type: "FeatureCollection", features: chainageFeatures });
          setMaintenanceGeoJSON({ type: "FeatureCollection", features: maintenanceFeatures });
        }
      } finally {
        if (!cancelled) setSpatialLoading(false);
      }
    }
    loadSpatialLayers();
    return () => { cancelled = true; };
  }, [sectionGeoJSON, roadIds]);

  const layerDefinitions = [
    ["roads", "Roads", filtered.roadGeoJSON],
    ["gps", "GPS Tracks", filtered.gpsGeoJSON],
    ["sections", "Road Sections", filtered.sectionGeoJSON],
    ["assets", "Road Assets", filtered.assetGeoJSON],
    ["defects", "Defects", filtered.defectGeoJSON],
    ["chainage", "Chainage", filtered.chainageGeoJSON],
    ["maintenance", "Maintenance", filtered.maintenanceGeoJSON],
  ];

  const layers = useMemo(() => layerDefinitions.map(([, , data]) => data), [filtered]);

  const roadOptions = (roadGeoJSON?.features || []).map((feature) => ({
    id: feature?.properties?.road_id,
    name: feature?.properties?.road_name || feature?.properties?.road_code || `Road ${feature?.properties?.road_id}`,
  })).filter((x) => x.id);

  return (
    <section className="map-panel">
      <div className="panel-heading">
        <div>
          <h2>GIS Road Asset & Defect Map</h2>
          <p>{loading || spatialLoading ? "Loading spatial data…" : "Click a feature for RAMS attributes. Filter the road and toggle layers as needed."}</p>
        </div>
        <div className="layer-controls" aria-label="Map filters and layers">
          <label>
            Road
            <select value={selectedRoad} onChange={(e) => setSelectedRoad(e.target.value)}>
              <option value="all">All roads</option>
              {roadOptions.map((road) => <option key={road.id} value={road.id}>{road.name}</option>)}
            </select>
          </label>
          {layerDefinitions.map(([key, label, data]) => (
            <label key={key} title={`Toggle ${label}`}>
              <input type="checkbox" checked={visible[key] ?? true} onChange={() => toggleLayer(key)} />
              {label} ({data?.features?.length ?? 0})
            </label>
          ))}
        </div>
      </div>
      <MapContainer center={defaultCenter} zoom={7} className="map">
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {visible.roads && filtered.roadGeoJSON && <GeoJSON data={filtered.roadGeoJSON} style={featureStyle(5)} onEachFeature={popupHandlers()} />}
        {visible.gps && filtered.gpsGeoJSON && <GeoJSON data={filtered.gpsGeoJSON} style={featureStyle(3, "8 6")} onEachFeature={popupHandlers()} />}
        {visible.sections && filtered.sectionGeoJSON && <GeoJSON data={filtered.sectionGeoJSON} style={featureStyle(4, "4 4")} onEachFeature={popupHandlers()} />}
        {visible.assets && filtered.assetGeoJSON && <GeoJSON data={filtered.assetGeoJSON} pointToLayer={pointStyle(7)} onEachFeature={popupHandlers()} />}
        {visible.defects && filtered.defectGeoJSON && <GeoJSON data={filtered.defectGeoJSON} pointToLayer={pointStyle(8)} onEachFeature={popupHandlers()} />}
        {(visible.chainage ?? true) && filtered.chainageGeoJSON && <GeoJSON data={filtered.chainageGeoJSON} pointToLayer={chainageStyle} onEachFeature={popupHandlers()} />}
        {(visible.maintenance ?? true) && filtered.maintenanceGeoJSON && <GeoJSON data={filtered.maintenanceGeoJSON} pointToLayer={maintenanceStyle} onEachFeature={popupHandlers()} />}
        <FitLayers layers={layers} />
      </MapContainer>
    </section>
  );
}
