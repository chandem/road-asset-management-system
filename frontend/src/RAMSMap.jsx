import { useEffect, useMemo } from "react";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";

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

function popupContent(properties = {}) {
  const entries = Object.entries(properties).filter(
    ([key, value]) => value !== null && value !== undefined && value !== "" && key !== "geometry",
  );
  if (!entries.length) return "<strong>RAMS feature</strong><br/>No attribute information available.";
  return `<div class="rams-popup"><strong>RAMS Feature</strong><table>${entries
    .map(([key, value]) => `<tr><td><strong>${key.replaceAll("_", " ")}</strong></td><td>${String(value)}</td></tr>`)
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

export default function RAMSMap({ roadGeoJSON, gpsGeoJSON, sectionGeoJSON, assetGeoJSON, defectGeoJSON, visible, toggleLayer, loading }) {
  const layers = useMemo(
    () => [roadGeoJSON, gpsGeoJSON, sectionGeoJSON, assetGeoJSON, defectGeoJSON],
    [roadGeoJSON, gpsGeoJSON, sectionGeoJSON, assetGeoJSON, defectGeoJSON],
  );
  const layerDefinitions = [
    ["roads", "Roads", roadGeoJSON],
    ["gps", "GPS Tracks", gpsGeoJSON],
    ["sections", "Road Sections", sectionGeoJSON],
    ["assets", "Road Assets", assetGeoJSON],
    ["defects", "Defects", defectGeoJSON],
  ];

  return (
    <section className="map-panel">
      <div className="panel-heading">
        <div>
          <h2>GIS Road Asset & Defect Map</h2>
          <p>{loading ? "Loading spatial data…" : "Click a map feature for its RAMS attributes. Toggle layers to focus the map."}</p>
        </div>
        <div className="layer-controls" aria-label="Map layers">
          {layerDefinitions.map(([key, label, data]) => (
            <label key={key} title={`Toggle ${label}`}>
              <input type="checkbox" checked={visible[key]} onChange={() => toggleLayer(key)} />
              {label} ({data?.features?.length ?? 0})
            </label>
          ))}
        </div>
      </div>
      <MapContainer center={defaultCenter} zoom={7} className="map">
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {visible.roads && roadGeoJSON && <GeoJSON data={roadGeoJSON} style={featureStyle(5)} onEachFeature={popupHandlers()} />}
        {visible.gps && gpsGeoJSON && <GeoJSON data={gpsGeoJSON} style={featureStyle(3, "8 6")} onEachFeature={popupHandlers()} />}
        {visible.sections && sectionGeoJSON && <GeoJSON data={sectionGeoJSON} style={featureStyle(4, "4 4")} onEachFeature={popupHandlers()} />}
        {visible.assets && assetGeoJSON && <GeoJSON data={assetGeoJSON} pointToLayer={pointStyle(7)} onEachFeature={popupHandlers()} />}
        {visible.defects && defectGeoJSON && <GeoJSON data={defectGeoJSON} pointToLayer={pointStyle(8)} onEachFeature={popupHandlers()} />}
        <FitLayers layers={layers} />
      </MapContainer>
    </section>
  );
}
