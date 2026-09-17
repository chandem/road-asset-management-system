import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap } from "react-leaflet";
import { getChainagePoints, getRoadSections, getRoads } from "./api";

const DEFAULT_CENTER = [8.0, 39.0];

function Recenter({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView([position.latitude, position.longitude], Math.max(map.getZoom(), 15));
  }, [position, map]);
  return null;
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestChainagePoint(position, points) {
  if (!position || !points?.length) return null;
  return points.reduce((nearest, point) => {
    const distance = distanceMeters(
      position.latitude,
      position.longitude,
      Number(point.latitude),
      Number(point.longitude),
    );
    if (!nearest || distance < nearest.distance) return { ...point, distance };
    return nearest;
  }, null);
}

export default function FieldGPS() {
  const [position, setPosition] = useState(null);
  const [watching, setWatching] = useState(false);
  const [error, setError] = useState("");
  const [roads, setRoads] = useState([]);
  const [sections, setSections] = useState([]);
  const [chainagePoints, setChainagePoints] = useState([]);
  const [roadId, setRoadId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [loadingRoads, setLoadingRoads] = useState(true);
  const [loadingSections, setLoadingSections] = useState(false);
  const [loadingChainage, setLoadingChainage] = useState(false);

  useEffect(() => {
    let active = true;
    getRoads()
      .then((data) => {
        if (active) setRoads(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (active) setError(`Could not load roads: ${e.message}`);
      })
      .finally(() => {
        if (active) setLoadingRoads(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!roadId) {
      setSections([]);
      setSectionId("");
      setChainagePoints([]);
      return undefined;
    }

    let active = true;
    setLoadingSections(true);
    setError("");
    getRoadSections(roadId)
      .then((data) => {
        if (active) setSections(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (active) setError(`Could not load sections: ${e.message}`);
      })
      .finally(() => {
        if (active) setLoadingSections(false);
      });
    return () => { active = false; };
  }, [roadId]);

  useEffect(() => {
    if (!sectionId) {
      setChainagePoints([]);
      return undefined;
    }

    let active = true;
    setLoadingChainage(true);
    setError("");
    getChainagePoints(sectionId)
      .then((data) => {
        if (active) setChainagePoints(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (active) setError(`Could not load chainage points: ${e.message}`);
      })
      .finally(() => {
        if (active) setLoadingChainage(false);
      });
    return () => { active = false; };
  }, [sectionId]);

  const nearestPoint = useMemo(
    () => nearestChainagePoint(position, chainagePoints),
    [position, chainagePoints],
  );

  function updatePosition(p) {
    setPosition({
      latitude: p.coords.latitude,
      longitude: p.coords.longitude,
      accuracy: p.coords.accuracy,
      altitude: p.coords.altitude,
      timestamp: p.timestamp,
    });
  }

  useEffect(() => {
    if (!watching) return undefined;
    if (!navigator.geolocation) {
      setError("GPS is not supported by this browser.");
      setWatching(false);
      return undefined;
    }

    setError("");
    const watchId = navigator.geolocation.watchPosition(
      updatePosition,
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
      updatePosition,
      (e) => setError(`GPS error: ${e.message}`),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  }

  return (
    <section className="form-panel field-gps-panel">
      <div className="form-header">
        <div>
          <h2>📍 Field GPS Capture</h2>
          <p>Capture GPS and match the position to a road, section and nearest chainage point.</p>
        </div>
        <div className="actions">
          <button type="button" onClick={captureOnce}>Capture GPS</button>
          <button type="button" onClick={() => setWatching((v) => !v)}>
            {watching ? "Stop Tracking" : "Start Tracking"}
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="field-gps-selection">
        <label>
          Road
          <select value={roadId} onChange={(e) => setRoadId(e.target.value)} disabled={loadingRoads}>
            <option value="">Select road</option>
            {roads.map((road) => (
              <option key={road.road_id} value={road.road_id}>
                {road.road_code} — {road.road_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Section
          <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={!roadId || loadingSections}>
            <option value="">{loadingSections ? "Loading sections…" : "Select section"}</option>
            {sections.map((section) => (
              <option key={section.section_id} value={section.section_id}>
                {section.section_code} ({section.start_chainage}–{section.end_chainage} km)
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="field-gps-grid">
        <div className="gps-details">
          <div className="card"><span>Latitude</span><strong>{position ? position.latitude.toFixed(6) : "—"}</strong></div>
          <div className="card"><span>Longitude</span><strong>{position ? position.longitude.toFixed(6) : "—"}</strong></div>
          <div className="card"><span>Accuracy</span><strong>{position ? `${position.accuracy.toFixed(1)} m` : "—"}</strong></div>
          <div className="card"><span>Elevation</span><strong>{position?.altitude == null ? "—" : `${position.altitude.toFixed(1)} m`}</strong></div>
          <div className="card"><span>Nearest chainage</span><strong>{nearestPoint ? `${Number(nearestPoint.chainage_km).toFixed(3)} km` : "—"}</strong></div>
          <div className="card"><span>Distance to chainage point</span><strong>{nearestPoint ? `${nearestPoint.distance.toFixed(1)} m` : "—"}</strong></div>
          <div className="card"><span>Chainage elevation</span><strong>{nearestPoint?.elevation_m == null ? "—" : `${Number(nearestPoint.elevation_m).toFixed(1)} m`}</strong></div>
        </div>

        <MapContainer center={position ? [position.latitude, position.longitude] : DEFAULT_CENTER} zoom={position ? 15 : 7} className="field-gps-map">
          <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {position && <>
            <CircleMarker center={[position.latitude, position.longitude]} radius={9} pathOptions={{ fillOpacity: 0.85 }} />
            <Recenter position={position} />
          </>}
          {nearestPoint && (
            <CircleMarker
              center={[Number(nearestPoint.latitude), Number(nearestPoint.longitude)]}
              radius={6}
              pathOptions={{ fillOpacity: 0.7 }}
            />
          )}
        </MapContainer>
      </div>

      {sectionId && (
        <small>
          {loadingChainage
            ? "Loading chainage points…"
            : `${chainagePoints.length} chainage point${chainagePoints.length === 1 ? "" : "s"} loaded for the selected section.`}
        </small>
      )}
      {position && <small>Last GPS fix: {new Date(position.timestamp).toLocaleString()}</small>}
    </section>
  );
}
