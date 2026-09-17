import { useEffect, useState } from "react";
import { syncOfflineQueues, readLegacyPhotoQueue, clearLegacyPhotoQueue } from "./offlineSync";
import { deletePhoto, getDefects, getInspections, getPhotos, putPhoto } from "./offlineDb";

export default function OfflinePhotoQueue() {
  const [queue, setQueue] = useState([]);
  const [offlineInspections, setOfflineInspections] = useState([]);
  const [offlineDefects, setOfflineDefects] = useState([]);
  const [file, setFile] = useState(null);
  const [inspectionId, setInspectionId] = useState("");
  const [inspectionClientId, setInspectionClientId] = useState("");
  const [defectId, setDefectId] = useState("");
  const [defectClientId, setDefectClientId] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [message, setMessage] = useState("");
  const [syncing, setSyncing] = useState(false);

  async function refreshQueues() {
    try {
      const [photos, inspections, defects] = await Promise.all([getPhotos(), getInspections(), getDefects()]);
      setQueue(photos);
      setOfflineInspections(inspections);
      setOfflineDefects(defects.filter((item) => item.inspection_client_id || item.inspection_id));
    } catch (error) {
      setMessage(`Offline database error: ${error.message}`);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      try {
        const legacy = readLegacyPhotoQueue();
        for (const item of legacy) {
          if (item.data_url) {
            const response = await fetch(item.data_url);
            const blob = await response.blob();
            await putPhoto({ ...item, file: blob, data_url: undefined });
          }
        }
        if (legacy.length) clearLegacyPhotoQueue();
        if (!cancelled) await refreshQueues();
      } catch (error) {
        if (!cancelled) setMessage(`Offline storage migration error: ${error.message}`);
      }
    }
    initialize();
    return () => { cancelled = true; };
  }, []);

  async function syncQueue() {
    if (!navigator.onLine || syncing) return;
    setSyncing(true);
    setMessage("Synchronizing inspections, defects and photos…");
    try {
      const result = await syncOfflineQueues();
      await refreshQueues();
      setMessage(`Synced ${result.inspections} inspection(s), ${result.defects} defect(s) and ${result.photos} photo(s). ${result.remainingPhotos} photo(s) remain queued.`);
    } catch (error) {
      setMessage(`Synchronization failed: ${error.message}`);
    } finally { setSyncing(false); }
  }

  useEffect(() => {
    const onOnline = () => syncQueue();
    const onSyncComplete = () => refreshQueues();
    window.addEventListener("online", onOnline);
    window.addEventListener("rams:offline-sync-complete", onSyncComplete);
    const timer = window.setInterval(syncQueue, 15000);
    const refreshTimer = window.setInterval(refreshQueues, 5000);
    if (navigator.onLine) syncQueue();
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("rams:offline-sync-complete", onSyncComplete);
      window.clearInterval(timer);
      window.clearInterval(refreshTimer);
    };
  }, []);

  function captureGPS() {
    if (!navigator.geolocation) { setMessage("GPS is not supported by this browser."); return; }
    navigator.geolocation.getCurrentPosition(
      (position) => { setLatitude(position.coords.latitude.toFixed(6)); setLongitude(position.coords.longitude.toFixed(6)); setMessage("GPS location captured."); },
      (error) => setMessage(`GPS error: ${error.message}`),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  async function savePhoto(event) {
    event.preventDefault();
    if (!file) { setMessage("Select a photo first."); return; }
    try {
      const record = {
        id: `${Date.now()}-${file.name}`,
        file_name: file.name, mime_type: file.type, size: file.size, file,
        inspection_id: inspectionId ? Number(inspectionId) : null,
        inspection_client_id: inspectionClientId || null,
        defect_id: defectId ? Number(defectId) : null,
        defect_client_id: defectClientId || null,
        latitude: latitude === "" ? null : Number(latitude), longitude: longitude === "" ? null : Number(longitude),
        captured_at: new Date().toISOString(), synced: false,
      };
      await putPhoto(record); await refreshQueues();
      setFile(null); setInspectionId(""); setInspectionClientId(""); setDefectId(""); setDefectClientId(""); setLatitude(""); setLongitude("");
      setMessage(`Photo ${file.name} saved offline and will synchronize automatically.`); event.target.reset();
    } catch (error) { setMessage(`Photo storage error: ${error.message}`); }
  }

  async function removePhoto(id) { await deletePhoto(id); await refreshQueues(); }

  function exportQueue() {
    const metadata = queue.map(({ file, ...item }) => item);
    const blob = new Blob([JSON.stringify(metadata, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `rams-photos-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url);
  }

  async function clearQueue() {
    if (queue.length && window.confirm(`Delete ${queue.length} offline photo(s)?`)) {
      for (const item of queue) await deletePhoto(item.id);
      await refreshQueues(); setMessage("Offline photo queue cleared.");
    }
  }

  return (
    <section className="form-panel offline-photo-panel">
      <div className="form-header"><div><h2>📷 Offline Photo Capture</h2><p>Photos are stored as files in IndexedDB and can reference an offline inspection or defect.</p></div><div className="card"><span>Queued</span><strong>{queue.length}</strong></div></div>
      <form onSubmit={savePhoto}>
        <label>Road Photo<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => setFile(event.target.files?.[0] || null)} required /></label>
        {file && <p>Selected: {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</p>}
        <div className="form-grid">
          <label>Offline Inspection<select value={inspectionClientId} onChange={(event) => setInspectionClientId(event.target.value)}><option value="">None</option>{offlineInspections.map((item) => <option key={item.client_id} value={item.client_id}>{item.section_code || `Section #${item.section_id}`} · {item.inspection_date}{item.synced ? " · synced" : " · pending"}</option>)}</select></label>
          <label>Existing Inspection ID<input type="number" value={inspectionId} onChange={(event) => setInspectionId(event.target.value)} /></label>
          <label>Offline Defect<select value={defectClientId} onChange={(event) => setDefectClientId(event.target.value)}><option value="">None</option>{offlineDefects.map((item) => <option key={item.client_id} value={item.client_id}>{item.defect_type} · {item.severity || "unknown"}{item.synced ? " · synced" : " · pending"}</option>)}</select></label>
          <label>Existing Defect ID<input type="number" value={defectId} onChange={(event) => setDefectId(event.target.value)} /></label>
          <label>Latitude<input type="number" step="any" value={latitude} onChange={(event) => setLatitude(event.target.value)} /></label>
          <label>Longitude<input type="number" step="any" value={longitude} onChange={(event) => setLongitude(event.target.value)} /></label>
        </div>
        <div className="form-footer"><button type="button" onClick={captureGPS}>📍 Capture GPS</button><button type="submit">Save Photo Offline</button><button type="button" onClick={syncQueue} disabled={syncing || !navigator.onLine}>{syncing ? "Syncing…" : "Sync Now"}</button>{message && <span>{message}</span>}</div>
      </form>
      <div className="form-header"><div><h3>Pending Offline Photos</h3><p>{queue.length ? "Stored in IndexedDB on this device until synchronized." : "No photos queued."}</p></div><div className="actions"><button type="button" onClick={exportQueue} disabled={!queue.length}>Export Data</button><button type="button" onClick={clearQueue} disabled={!queue.length}>Clear Queue</button></div></div>
      {queue.length > 0 && <div className="table-wrap"><table><thead><tr><th>Photo</th><th>Inspection</th><th>Defect</th><th>GPS</th><th>Captured</th><th>Action</th></tr></thead><tbody>{queue.map((item) => <tr key={item.id}><td>{item.file_name}</td><td>{item.inspection_client_id ? "Offline inspection" : item.inspection_id ?? "—"}</td><td>{item.defect_client_id ? "Offline defect" : item.defect_id ?? "—"}</td><td>{item.latitude == null ? "—" : `${item.latitude}, ${item.longitude}`}</td><td>{new Date(item.captured_at).toLocaleString()}</td><td><button type="button" onClick={() => removePhoto(item.id)}>Remove</button></td></tr>)}</tbody></table></div>}
    </section>
  );
}
