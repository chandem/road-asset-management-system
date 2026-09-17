import { useEffect, useState } from "react";
import { syncOfflineQueues } from "./offlineSync";

const QUEUE_KEY = "rams.offline.photo.queue";
const INSPECTION_QUEUE_KEY = "rams.offline.inspection.queue";

function loadQueue(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function OfflinePhotoQueue() {
  const [queue, setQueue] = useState(() => loadQueue(QUEUE_KEY));
  const [offlineInspections, setOfflineInspections] = useState(() => loadQueue(INSPECTION_QUEUE_KEY));
  const [file, setFile] = useState(null);
  const [inspectionId, setInspectionId] = useState("");
  const [inspectionClientId, setInspectionClientId] = useState("");
  const [defectId, setDefectId] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [message, setMessage] = useState("");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch {
      setMessage("Offline storage is unavailable on this device.");
    }
  }, [queue]);

  function refreshQueues() {
    setQueue(loadQueue(QUEUE_KEY));
    setOfflineInspections(loadQueue(INSPECTION_QUEUE_KEY));
  }

  async function syncQueue() {
    if (!navigator.onLine || syncing) return;
    setSyncing(true);
    setMessage("Synchronizing offline inspections and photos…");
    try {
      const result = await syncOfflineQueues();
      refreshQueues();
      setMessage(`Synced ${result.inspections} inspection(s) and ${result.photos} photo(s). ${result.remainingInspections} inspection(s) and ${result.remainingPhotos} photo(s) remain queued.`);
    } catch (error) {
      setMessage(`Synchronization failed: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    const onOnline = () => syncQueue();
    const onSyncComplete = refreshQueues;
    window.addEventListener("online", onOnline);
    window.addEventListener("rams:offline-sync-complete", onSyncComplete);
    const timer = window.setInterval(syncQueue, 15000);
    if (navigator.onLine && (queue.length || offlineInspections.length)) syncQueue();
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("rams:offline-sync-complete", onSyncComplete);
      window.clearInterval(timer);
    };
  }, [queue.length, offlineInspections.length]);

  function captureGPS() {
    if (!navigator.geolocation) {
      setMessage("GPS is not supported by this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setMessage("GPS location captured.");
      },
      (error) => setMessage(`GPS error: ${error.message}`),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  async function savePhoto(event) {
    event.preventDefault();
    if (!file) {
      setMessage("Select a photo first.");
      return;
    }
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Could not read photo"));
        reader.readAsDataURL(file);
      });
      const record = {
        id: `${Date.now()}-${file.name}`,
        file_name: file.name,
        mime_type: file.type,
        size: file.size,
        data_url: dataUrl,
        inspection_id: inspectionId ? Number(inspectionId) : null,
        inspection_client_id: inspectionClientId || null,
        defect_id: defectId ? Number(defectId) : null,
        latitude: latitude === "" ? null : Number(latitude),
        longitude: longitude === "" ? null : Number(longitude),
        captured_at: new Date().toISOString(),
        synced: false,
      };
      setQueue((current) => [...current, record]);
      setFile(null);
      setInspectionId("");
      setInspectionClientId("");
      setDefectId("");
      setMessage(`Photo ${file.name} saved offline and will synchronize automatically when online.`);
    } catch (error) {
      setMessage(`Photo error: ${error.message}`);
    }
  }

  function removePhoto(id) {
    setQueue((current) => current.filter((item) => item.id !== id));
  }

  function exportQueue() {
    const blob = new Blob([JSON.stringify(queue, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rams-photos-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function clearQueue() {
    if (queue.length && window.confirm(`Delete ${queue.length} offline photo(s)?`)) {
      setQueue([]);
      setMessage("Offline photo queue cleared.");
    }
  }

  return (
    <section className="form-panel offline-photo-panel">
      <div className="form-header">
        <div>
          <h2>📷 Offline Photo Capture</h2>
          <p>Capture road photos without internet. Photos linked to offline inspections are uploaded after their inspection is synchronized.</p>
        </div>
        <div className="card"><span>Queued</span><strong>{queue.length}</strong></div>
      </div>
      <form onSubmit={savePhoto}>
        <label>Road Photo
          <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => setFile(event.target.files?.[0] || null)} required />
        </label>
        {file && <p>Selected: {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</p>}
        <div className="form-grid">
          <label>Offline Inspection<select value={inspectionClientId} onChange={(event) => setInspectionClientId(event.target.value)}><option value="">None</option>{offlineInspections.map((item) => <option key={item.client_id || item.id} value={item.client_id || item.id}>{item.section_code || `Section #${item.section_id}`} · {item.inspection_date}</option>)}</select></label>
          <label>Existing Inspection ID (optional)<input type="number" value={inspectionId} onChange={(event) => setInspectionId(event.target.value)} /></label>
          <label>Defect ID (optional)<input type="number" value={defectId} onChange={(event) => setDefectId(event.target.value)} /></label>
          <label>Latitude<input type="number" step="any" value={latitude} onChange={(event) => setLatitude(event.target.value)} /></label>
          <label>Longitude<input type="number" step="any" value={longitude} onChange={(event) => setLongitude(event.target.value)} /></label>
        </div>
        <div className="form-footer">
          <button type="button" onClick={captureGPS}>📍 Capture GPS</button>
          <button type="submit">Save Photo Offline</button>
          <button type="button" onClick={syncQueue} disabled={syncing || !navigator.onLine || (!queue.length && !offlineInspections.length)}>{syncing ? "Syncing…" : "Sync Now"}</button>
          {message && <span>{message}</span>}
        </div>
      </form>
      <div className="form-header">
        <div><h3>Pending Offline Photos</h3><p>{queue.length ? "Stored in this browser/device until synchronized." : "No photos queued."}</p></div>
        <div className="actions"><button type="button" onClick={exportQueue} disabled={!queue.length}>Export Data</button><button type="button" onClick={clearQueue} disabled={!queue.length}>Clear Queue</button></div>
      </div>
      {queue.length > 0 && <div className="table-wrap"><table><thead><tr><th>Photo</th><th>Inspection</th><th>Defect</th><th>GPS</th><th>Captured</th><th>Action</th></tr></thead><tbody>{queue.map((item) => <tr key={item.id}><td>{item.file_name}</td><td>{item.inspection_client_id ? `Offline: ${item.inspection_client_id}` : item.inspection_id ?? "—"}</td><td>{item.defect_id ?? "—"}</td><td>{item.latitude == null ? "—" : `${item.latitude}, ${item.longitude}`}</td><td>{new Date(item.captured_at).toLocaleString()}</td><td><button type="button" onClick={() => removePhoto(item.id)}>Remove</button></td></tr>)}</tbody></table></div>}
    </section>
  );
}
