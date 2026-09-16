import { useEffect, useState } from "react";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  getGPSTrackGeoJSON,
  getRoadAssetGeoJSON,
  getRoadGeoJSON,
  getRoadSectionGeoJSON,
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
  const [visible, setVisible] = useState({
    roads: true,
    gps: true,
    sections: true,
    assets: true,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [roadData, geoData, gpsData] = await Promise.all([
          getRoads(),
          getRoadGeoJSON(),
          getGPSTrackGeoJSON(),
        ]);

        const roadIds = roadData.map((road) => road.road_id);
        const sectionResults = await Promise.all(
          roadIds.map((roadId) => getRoadSectionGeoJSON(roadId)),
        );
        const assetResults = await Promise.all(
          roadIds.map((roadId) => getRoadAssetGeoJSON(roadId)),
        );

        const combine = (collections) => ({
          type: "FeatureCollection",
          features: collections.flatMap((collection) => collection.features || []),
        });

        setRoads(roadData);
        setRoadGeoJSON(geoData);
        setGpsGeoJSON(gpsData);
        setSectionGeoJSON(combine(sectionResults));
        setAssetGeoJSON(combine(assetResults));
      } catch (err) {
        setError(err.message || "Unable to connect to RAMS API");
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  const toggleLayer = (name) => {
    setVisible((current) => ({ ...current, [name]: !current[name] }));
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Road Asset Management System</h1>
          <p>RAMS · Road infrastructure management dashboard</p>
        </div>
        <span className="status">API v0.9</span>
      </header>

      <main className="dashboard">
        {error && <div className="error-banner">API connection: {error}</div>}

        <section className="cards">
          <div className="card"><span>Roads</span><strong>{loading ? "…" : roads.length}</strong></div>
          <div className="card"><span>GPS Tracks</span><strong>{loading ? "…" : gpsGeoJSON?.features?.length ?? 0}</strong></div>
          <div className="card"><span>Sections</span><strong>{loading ? "…" : sectionGeoJSON?.features?.length ?? 0}</strong></div>
          <div className="card"><span>Assets</span><strong>{loading ? "…" : assetGeoJSON?.features?.length ?? 0}</strong></div>
        </section>

        <section className="map-panel">
          <div className="panel-heading">
            <div>
              <h2>GIS Road Asset Map</h2>
              <p>{loading ? "Loading spatial data…" : "Roads, GPS tracks, sections and assets are available as map layers."}</p>
            </div>
            <div className="layer-controls">
              {[
                ["roads", "Roads"],
                ["gps", "GPS"],
                ["sections", "Sections"],
                ["assets", "Assets"],
              ].map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={visible[key]}
                    onChange={() => toggleLayer(key)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <MapContainer center={defaultCenter} zoom={7} className="map">
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {visible.roads && roadGeoJSON && (
              <GeoJSON
                data={roadGeoJSON}
                style={{ weight: 5 }}
                onEachFeature={(feature, layer) => {
                  const p = feature.properties || {};
                  layer.bindPopup(
                    `<strong>${p.road_code || "Road"}</strong><br/>${p.road_name || ""}<br/>Length: ${p.total_length_km ?? "—"} km`,
                  );
                }}
              />
            )}

            {visible.gps && gpsGeoJSON && (
              <GeoJSON
                data={gpsGeoJSON}
                style={{ weight: 3, dashArray: "8 6" }}
                onEachFeature={(feature, layer) => {
                  const p = feature.properties || {};
                  layer.bindPopup(
                    `<strong>GPS Track #${p.track_id}</strong><br/>Road ID: ${p.road_id ?? "—"}<br/>Length: ${p.length_km ?? "—"} km<br/>Source: ${p.source || "—"}`,
                  );
                }}
              />
            )}

            {visible.sections && sectionGeoJSON && (
              <GeoJSON
                data={sectionGeoJSON}
                style={{ weight: 4, dashArray: "4 4" }}
                onEachFeature={(feature, layer) => {
                  const p = feature.properties || {};
                  layer.bindPopup(
                    `<strong>${p.section_code || "Section"}</strong><br/>Chainage: ${p.start_chainage}–${p.end_chainage} km<br/>Condition: ${p.condition_rating ?? "—"}`,
                  );
                }}
              />
            )}

            {visible.assets && assetGeoJSON && (
              <GeoJSON
                data={assetGeoJSON}
                pointToLayer={(feature, latlng) =>
                  L.circleMarker(latlng, { radius: 7, weight: 2 })
                }
                onEachFeature={(feature, layer) => {
                  const p = feature.properties || {};
                  layer.bindPopup(
                    `<strong>${p.asset_type || "Asset"}</strong><br/>Code: ${p.asset_code || "—"}<br/>Chainage: ${p.chainage_km ?? "—"} km<br/>Condition: ${p.condition_rating ?? "—"}`,
                  );
                }}
              />
            )}

            <FitLayers
              layers={[roadGeoJSON, gpsGeoJSON, sectionGeoJSON, assetGeoJSON]}
            />
          </MapContainer>
        </section>
      </main>
    </div>
  );
}

export default App;
