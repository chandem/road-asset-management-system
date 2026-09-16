import { useEffect, useState } from "react";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getGPSTrackGeoJSON, getRoadGeoJSON, getRoads } from "./api";

const defaultCenter = [8.0, 39.0];

function FitLayers({ roadData, gpsData }) {
  const map = useMap();

  useEffect(() => {
    const layer = L.featureGroup();
    if (roadData?.features?.length) layer.addLayer(L.geoJSON(roadData));
    if (gpsData?.features?.length) layer.addLayer(L.geoJSON(gpsData));
    const bounds = layer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30] });
  }, [roadData, gpsData, map]);

  return null;
}

function App() {
  const [roads, setRoads] = useState([]);
  const [roadGeoJSON, setRoadGeoJSON] = useState(null);
  const [gpsGeoJSON, setGpsGeoJSON] = useState(null);
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
        setRoads(roadData);
        setRoadGeoJSON(geoData);
        setGpsGeoJSON(gpsData);
      } catch (err) {
        setError(err.message || "Unable to connect to RAMS API");
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

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
          <div className="card"><span>Road Sections</span><strong>—</strong></div>
          <div className="card"><span>Defects</span><strong>—</strong></div>
        </section>

        <section className="map-panel">
          <div className="panel-heading">
            <h2>GIS Road & GPS Map</h2>
            <p>{loading ? "Loading spatial data…" : "Road centerlines and recorded GPS tracks are available as map layers."}</p>
          </div>

          <MapContainer center={defaultCenter} zoom={7} className="map">
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {roadGeoJSON && (
              <GeoJSON
                data={roadGeoJSON}
                style={{ weight: 4 }}
                onEachFeature={(feature, layer) => {
                  const p = feature.properties || {};
                  layer.bindPopup(
                    `<strong>${p.road_code || "Road"}</strong><br/>${p.road_name || ""}<br/>Length: ${p.total_length_km ?? "—"} km`,
                  );
                }}
              />
            )}

            {gpsGeoJSON && (
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

            <FitLayers roadData={roadGeoJSON} gpsData={gpsGeoJSON} />
          </MapContainer>
        </section>
      </main>
    </div>
  );
}

export default App;
