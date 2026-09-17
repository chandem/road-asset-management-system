import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap } from "react-leaflet";
import { createGPSTrack, getChainagePoints, getGPSMatch, getRoadGeoJSON, getRoadSections, getRoads } from "./api";

const DEFAULT_CENTER = [8.0, 39.0];
const AUTO_MATCH_LIMIT_METERS = 500;
const MATCH_INTERVAL_MS = 5000;
const OFFLINE_QUEUE_KEY = "rams.offline.gps.queue";
const SYNC_INTERVAL_MS = 15000;

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
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestChainagePoint(position, points) {
  if (!position || !points?.length) return null;
  return points.reduce((nearest, point) => {
    const distance = distanceMeters(position.latitude, position.longitude, Number(point.latitude), Number(point.longitude));
    if (!nearest || distance < nearest.distance) return { ...point, distance };
    return nearest;
  }, null);
}

function loadOfflineQueue() {
  try {
    const value = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return value ? JSON.parse(value) : [];
  } catch { return []; }
}

function pointsToWkt(points) {
  return `LINESTRING(${points.map((point) => `${Number(point.longitude)} ${Number(point.latitude)}`).join(", ")})`;
}

export default function FieldGPS() {
  const [position, setPosition] = useState(null);
  const [watching, setWatching] = useState(false);
  const [error, setError] = useState("");
  const [roads, setRoads] = useState([]);
  const [roadsGeoJSON, setRoadsGeoJSON] = useState(null);
  const [sections, setSections] = useState([]);
  const [chainagePoints, setChainagePoints] = useState([]);
  const [roadId, setRoadId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [autoMatch, setAutoMatch] = useState(true);
  const [gpsMatch, setGpsMatch] = useState(null);
  const [matchingGPS, setMatchingGPS] = useState(false);
  const [loadingRoads, setLoadingRoads] = useState(true);
  const [loadingSections, setLoadingSections] = useState(false);
  const [loadingChainage, setLoadingChainage] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState(loadOfflineQueue);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    try { localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(offlineQueue)); } catch { /* storage may be unavailable */ }
  }, [offlineQueue]);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([getRoads(), getRoadGeoJSON()]).then(([roadData, geoJSON]) => {
      if (!active) return;
      setRoads(Array.isArray(roadData) ? roadData : []);
      setRoadsGeoJSON(geoJSON);
    }).catch((e) => { if (active) setError(`Could not load road data: ${e.message}`); })
      .finally(() => { if (active) setLoadingRoads(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!roadId) { setSections([]); setSectionId(""); setChainagePoints([]); return undefined; }
    let active = true;
    setLoadingSections(true);
    getRoadSections(roadId).then((data) => { if (active) setSections(Array.isArray(data) ? data : []); })
      .catch((e) => { if (active) setError(`Could not load sections: ${e.message}`); })
      .finally(() => { if (active) setLoadingSections(false); });
    return () => { active = false; };
  }, [roadId]);

  useEffect(() => {
    if (!sectionId) { setChainagePoints([]); return undefined; }
    let active = true;
    setLoadingChainage(true);
    getChainagePoints(sectionId).then((data) => { if (active) setChainagePoints(Array.isArray(data) ? data : []); })
      .catch((e) => { if (active) setError(`Could not load chainage points: ${e.message}`); })
      .finally(() => { if (active) setLoadingChainage(false); });
    return () => { active = false; };
  }, [sectionId]);

  useEffect(() => {
    if (!autoMatch || !position || !roads.length) return undefined;
    let cancelled = false;
    let timer;
    async function matchPosition() {
      setMatchingGPS(true);
      try {
        const data = await getGPSMatch(position.latitude, position.longitude, AUTO_MATCH_LIMIT_METERS);
        if (cancelled) return;
        setGpsMatch(data);
        if (data?.matched) { setRoadId(String(data.road_id)); setSectionId(String(data.section_id)); }
      } catch (e) { if (!cancelled) setError(`Could not match GPS position: ${e.message}`); }
      finally { if (!cancelled) setMatchingGPS(false); }
    }
    matchPosition();
    timer = setInterval(matchPosition, MATCH_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [autoMatch, position, roads.length]);

  const nearestPoint = useMemo(() => nearestChainagePoint(position, chainagePoints), [position, chainagePoints]);

  function updatePosition(p) {
    setPosition({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy, altitude: p.coords.altitude, timestamp: p.timestamp });
  }

  function saveCurrentOffline() {
    if (!position) return;
    setOfflineQueue((current) => [...current, {
      id: `${position.timestamp}-${position.latitude}-${position.longitude}`,
      captured_at: new Date(position.timestamp).toISOString(), latitude: position.latitude, longitude: position.longitude,
      accuracy_m: position.accuracy, altitude_m: position.altitude,
      road_id: gpsMatch?.road_id ?? roadId || null, section_id: gpsMatch?.section_id ?? sectionId || null,
      chainage_km: gpsMatch?.chainage_km ?? null, source: "field-gps-offline", synced: false,
    }]);
    setError("");
  }

  async function syncOfflineQueue() {
    if (!online || syncing || offlineQueue.length < 2) return;
    const pending = offlineQueue.filter((item) => !item.synced && item.road_id);
    if (pending.length < 2) return;
    setSyncing(true);
    setError("");
    try {
      const groups = pending.reduce((acc, point) => {
        const key = String(point.road_id);
        if (!acc[key]) acc[key] = [];
        acc[key].push(point);
        return acc;
      }, {});
      const syncedIds = new Set();
      for (const [groupRoadId, points] of Object.entries(groups)) {
        if (points.length < 2) continue;
        const ordered = [...points].sort((a, b) => new Date(a.captured_at) - new Date(b.captured_at));
        await createGPSTrack(Number(groupRoadId), {
          recorded_at: ordered[0].captured_at,
          source: "field-gps-offline-sync",
          geometry_wkt: pointsToWkt(ordered),
          length_km: null,
        });
        ordered.forEach((point) => syncedIds.add(point.id));
      }
      if (syncedIds.size) setOfflineQueue((current) => current.filter((item) => !syncedIds.has(item.id)));
      setLastSync(new Date());
      if (!syncedIds.size && pending.length) setError("Offline data is waiting for at least two points on the same road before track synchronization.");
    } catch (e) {
      setError(`GPS sync failed; records remain safely offline: ${e.message}`);
    } finally { setSyncing(false); }
  }

  useEffect(() => {
    if (!online || offlineQueue.length < 2) return undefined;
    syncOfflineQueue();
    const timer = setInterval(syncOfflineQueue, SYNC_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [online, offlineQueue.length]);

  function exportOfflineQueue() {
    const blob = new Blob([JSON.stringify(offlineQueue, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url;
    link.download = `rams-gps-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url);
  }

  function clearOfflineQueue() {
    if (offlineQueue.length && window.confirm(`Delete ${offlineQueue.length} offline GPS record(s)?`)) setOfflineQueue([]);
  }

  useEffect(() => {
    if (!watching) return undefined;
    if (!navigator.geolocation) { setError("GPS is not supported by this browser."); setWatching(false); return undefined; }
    setError("");
    const watchId = navigator.geolocation.watchPosition(updatePosition, (e) => setError(`GPS error: ${e.message}`), { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [watching]);

  function captureOnce() {
    if (!navigator.geolocation) { setError("GPS is not supported by this browser."); return; }
    setError("");
    navigator.geolocation.getCurrentPosition(updatePosition, (e) => setError(`GPS error: ${e.message}`), { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  }

  const selectedSection = sections.find((section) => String(section.section_id) === String(sectionId));

  return (
    <section className="form-panel field-gps-panel">
      <div className="form-header"><div><h2>📍 Field GPS Capture</h2><p>Capture GPS, match road/section/chainage, store points offline, and sync tracks when online.</p></div>
        <div className="actions"><button type="button" onClick={captureOnce}>Capture GPS</button><button type="button" onClick={() => setWatching((v) => !v)}>{watching ? "Stop Tracking" : "Start Tracking"}</button></div></div>
      {error && <div className="error-banner">{error}</div>}
      <div className="field-gps-selection">
        <label><span>Road</span><select value={roadId} onChange={(e) => { setAutoMatch(false); setRoadId(e.target.value); }} disabled={loadingRoads}><option value="">Select road</option>{roads.map((road) => <option key={road.road_id} value={road.road_id}>{road.road_code} — {road.road_name}</option>)}</select></label>
        <label><span>Section</span><select value={sectionId} onChange={(e) => { setAutoMatch(false); setSectionId(e.target.value); }} disabled={!roadId || loadingSections}><option value="">{loadingSections ? "Loading sections…" : "Select section"}</option>{sections.map((section) => <option key={section.section_id} value={section.section_id}>{section.section_code} ({section.start_chainage}–{section.end_chainage} km)</option>)}</select></label>
        <label className="gps-auto-match-toggle"><span>Automatic matching</span><input type="checkbox" checked={autoMatch} onChange={(e) => setAutoMatch(e.target.checked)} /></label>
      </div>
      {autoMatch && gpsMatch?.matched && <div className="info-banner">Auto-matched: <strong>{gpsMatch.road_code} — {gpsMatch.road_name}</strong>{` · ${gpsMatch.section_code} · Chainage ${Number(gpsMatch.chainage_km).toFixed(3)} km · ${Number(gpsMatch.distance_to_section_m).toFixed(1)} m from road`}</div>}
      {autoMatch && !gpsMatch?.matched && position && !matchingGPS && <div className="info-banner">No road section found within {AUTO_MATCH_LIMIT_METERS} m of the GPS position.</div>}
      <div className="field-gps-grid">
        <div className="gps-details">
          <div className="card"><span>Latitude</span><strong>{position ? position.latitude.toFixed(6) : "—"}</strong></div><div className="card"><span>Longitude</span><strong>{position ? position.longitude.toFixed(6) : "—"}</strong></div><div className="card"><span>Accuracy</span><strong>{position ? `${position.accuracy.toFixed(1)} m` : "—"}</strong></div><div className="card"><span>Elevation</span><strong>{position?.altitude == null ? "—" : `${position.altitude.toFixed(1)} m`}</strong></div><div className="card"><span>Matched road</span><strong>{gpsMatch?.matched ? `${gpsMatch.road_code} — ${gpsMatch.road_name}` : matchingGPS ? "Matching…" : "—"}</strong></div><div className="card"><span>Matched section</span><strong>{gpsMatch?.matched ? gpsMatch.section_code : "—"}</strong></div><div className="card"><span>Continuous chainage</span><strong>{gpsMatch?.matched ? `${Number(gpsMatch.chainage_km).toFixed(3)} km` : "—"}</strong></div><div className="card"><span>Offline queue</span><strong>{offlineQueue.length} point{offlineQueue.length === 1 ? "" : "s"}</strong></div>
        </div>
        <MapContainer center={position ? [position.latitude, position.longitude] : DEFAULT_CENTER} zoom={position ? 15 : 7} className="field-gps-map"><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />{position && <><CircleMarker center={[position.latitude, position.longitude]} radius={9} pathOptions={{ fillOpacity: 0.85 }} /><Recenter position={position} /></>}{gpsMatch?.matched && gpsMatch.projected_point?.coordinates && <CircleMarker center={[gpsMatch.projected_point.coordinates[1], gpsMatch.projected_point.coordinates[0]]} radius={6} pathOptions={{ fillOpacity: 0.7 }} />}{nearestPoint && <CircleMarker center={[Number(nearestPoint.latitude), Number(nearestPoint.longitude)]} radius={5} pathOptions={{ fillOpacity: 0.55 }} />}</MapContainer>
      </div>
      <div className="actions offline-actions"><button type="button" onClick={saveCurrentOffline} disabled={!position}>Save GPS Point Offline</button><button type="button" onClick={syncOfflineQueue} disabled={!online || syncing || offlineQueue.length < 2}>{syncing ? "Syncing…" : "Sync Now"}</button><button type="button" onClick={exportOfflineQueue} disabled={!offlineQueue.length}>Export Offline Data</button><button type="button" onClick={clearOfflineQueue} disabled={!offlineQueue.length}>Clear Queue</button></div>
      <div className="info-banner">Status: <strong>{online ? "Online" : "Offline"}</strong> · {syncing ? "Synchronizing GPS tracks…" : offlineQueue.length ? `${offlineQueue.length} point(s) waiting for sync` : "No pending GPS data"}{lastSync && ` · Last sync ${lastSync.toLocaleTimeString()}`}</div>
      {sectionId && <small>{loadingChainage ? "Loading stored chainage points…" : `${chainagePoints.length} stored chainage point${chainagePoints.length === 1 ? "" : "s"} loaded for ${selectedSection?.section_code || "the selected section"}.`}</small>}
      {gpsMatch?.matched && <small>Continuous chainage is calculated from the GPS position projected onto the road-section geometry.</small>}
      <small>Offline records remain in this browser until synchronized or exported. Tracks are uploaded only when there are at least two points on the same road.</small>
      {position && <small>Last GPS fix: {new Date(position.timestamp).toLocaleString()}</small>}
    </section>
  );
}
