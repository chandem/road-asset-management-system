import { useEffect, useState } from "react";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { getRoadGeoJSON, getRoads } from "./api";

const defaultCenter = [8.0, 39.0];

function FitRoads({ data }) {
  const map = useMap();

  useEffect(() => {
    if (!data?.features?.length) return;
    const layer = window.L.geoJSON(data);
    const bounds = layer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30] });
  }, [data, map]);

  return null;
}

function App() {
  const [roads, setRoads] = useState([]);
  const [roadGeoJSON, setRoadGeoJSON] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [roadData, geoData] = await Promise.all([
          getRoads(),
          getRoadGeoJSON(),
        ]);
        setRoads(roadData);
        setRoadGeoJSON(geoData);
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
          <div className="card"><span>Road Sections</span><strong>—</strong></div>
          <div className="card"><span>Assets</span><strong>—</strong></div>
          <div className="card"><span>Defects</span><strong>—</strong></div>
        </section>

        <section className="map-panel">
          <div className="panel-heading">
            <div>
              <h2>GIS Road Map</h2>
              <p>{loading ? "Loading road data…" : `${roads.length} road record(s) loaded from RAMS API.`}</p>
            </div>
          </div>

          <MapContainer center={defaultCenter} zoom={7} className="map">
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {roadGeoJSON && (
              <>
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
                <FitRoads data={roadGeoJSON} />
              </>
            )}
          </MapContainer>
        </section>
      </main>
    </div>
  );
}

export default App;
