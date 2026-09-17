import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap } from "react-leaflet";

const DEFAULT_CENTER = [8.0, 39.0];

function Recenter({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView([position.latitude, position.longitude], Math.max(map.getZoom(), 15));
  }, [position, map]);
  return null;
}

export default function FieldGPS() {
  const [position, setPosition] = useState(null);
  const [watching, setWatching] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!watching) return undefined;
    if (!navigator.geolocation) {
      setError("GPS is not supported by this browser.");
      setWatching(false);
      return undefined;
    }

    setError("");
    const watchId = navigator.geolocation.watchPosition(
      (p) => {
        setPosition({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracy: p.coords.accuracy,
          altitude: p.coords.altitude,
          timestamp: p.timestamp,
        });
      },
      (e) => setError(`GPS error: ${e.message}`),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [watching]);

  function captureOnce() {
    if (!navigator.geolocation) {
      setError("GPS is not supported by this browser.");
      return;
    }
    setError("");
    navigator.geolocation.getCurrentPosition(
      (p) => setPosition({
        latitude: p.coords.latitude,
        longitude: p.coords.longitude,
        accuracy: p.coords.accuracy,
        altitude: p.coords.altitude,
        timestamp: p.timestamp,
      }),
      (e) => setError(`GPS error: ${e.message}`),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  }

  return (
    <section className="form-panel field-gps-panel">
      <div className="form-header">
        <div>
          <h2>📍 Field GPS Capture</h2>
          <p>Capture the device position for field inspections, defects and geotagged photos.</p>
        </div>
        <div className="actions">
          <button type="button" onClick={captureOnce}>Capture GPS</button>
          <button type="button" onClick={() => setWatching((v) => !v)}>
            {watching ? "Stop Tracking" : "Start Tracking"}
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="field-gps-grid">
        <div className="gps-details">
          <div className="card"><span>Latitude</span><strong>{position ? position.latitude.toFixed(6) : "—"}</strong></div>
          <div className="card"><span>Longitude</span><strong>{position ? position.longitude.toFixed(6) : "—"}</strong></div>
          <div className="card"><span>Accuracy</span><strong>{position ? `${position.accuracy.toFixed(1)} m` : "—"}</strong></div>
          <div className="card"><span>Elevation</span><strong>{position?.altitude == null ? "—" : `${position.altitude.toFixed(1)} m`}</strong></div>
        </div>

        <MapContainer center={position ? [position.latitude, position.longitude] : DEFAULT_CENTER} zoom={position ? 15 : 7} className="field-gps-map">
          <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {position && <>
            <CircleMarker center={[position.latitude, position.longitude]} radius={9} pathOptions={{ fillOpacity: 0.85 }} />
            <Recenter position={position} />
          </>}
        </MapContainer>
      </div>

      {position && <small>Last GPS fix: {new Date(position.timestamp).toLocaleString()}</small>}
    </section>
  );
}
