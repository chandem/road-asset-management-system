import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const defaultCenter = [6.85, 39.0];

function App() {
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
        <section className="cards">
          <div className="card"><span>Roads</span><strong>—</strong></div>
          <div className="card"><span>Road Sections</span><strong>—</strong></div>
          <div className="card"><span>Assets</span><strong>—</strong></div>
          <div className="card"><span>Defects</span><strong>—</strong></div>
        </section>

        <section className="map-panel">
          <div className="panel-heading">
            <div>
              <h2>GIS Road Map</h2>
              <p>Roads, GPS tracks and infrastructure assets will appear here.</p>
            </div>
          </div>
          <MapContainer center={defaultCenter} zoom={7} className="map">
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={defaultCenter}>
              <Popup>RAMS map center</Popup>
            </Marker>
          </MapContainer>
        </section>
      </main>
    </div>
  );
}

export default App;
