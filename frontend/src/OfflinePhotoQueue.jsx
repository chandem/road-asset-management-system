import { useEffect, useMemo, useState } from "react";
import { syncOfflineQueues, readLegacyPhotoQueue, clearLegacyPhotoQueue } from "./offlineSync";
import { deletePhoto, getDefects, getInspections, getPhotos, putPhoto } from "./offlineDb";

function createClientId() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function statusOf(item) {
  if (item.synced) return "synced";
  return item.status === "conflict" ? "conflict" : "pending";
}

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
      const [photos, inspections, defects] = await Promise.all([
        getPhotos(),
        getInspections(),
        getDefects(),
      ]);
      setQueue(photos);
      setOfflineInspections(inspections);
      setOfflineDefects(
        defects.filter((item) => item.inspection_client_id || item.inspection_id),
      );
    } catch (error) {
      setMessage(`Offline database error: ${error.message}`);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      const legacy = readLegacyPhotoQueue();
      if (!Array.isArray(legacy) || !legacy.length) {
        if (!cancelled) await refreshQueues();
        return;
      }
      const failed = [];
      for (const [index, item] of legacy.entries()) {
        try {
          if (!item?.data_url) throw new Error("Photo has no image data");
          const response = await fetch(item.data_url);
          if (!response.ok) throw new Error(`Could not read legacy photo (${response.status})`);
          const blob = await response.blob();
          await putPhoto({
            ...item,
            id:
              item.id ||
              `legacy-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
            file: blob,
            data_url: undefined,
            status: item.status || "pending",
            attempts: item.attempts || 0,
          });
        } catch {
          failed.push(item);
        }
      }
      if (failed.length) {
        try {
          localStorage.setItem("rams.offline.photo.queue", JSON.stringify(failed));
        } catch {
          /* ignore */
        }
        setMessage(
          `${failed.length} legacy photo(s) could not be migrated and remain queued for retry.`,
        );
      } else {
        clearLegacyPhotoQueue();
      }
      if (!cancelled) await refreshQueues();
    }
    initialize().catch((error) => {
      if (!cancelled) setMessage(`Offline storage migration error: ${error.message}`);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => {
    const pending = queue.filter((i) => statusOf(i) === "pending").length;
    const conflict = queue.filter((i) => statusOf(i) === "conflict").length;
    return { pending, conflict, total: queue.length };
  }, [queue]);

  async function syncQueue() {
    if (!navigator.onLine || syncing) return;
    setSyncing(true);
    setMessage("Synchronizing inspections, defects and photos…");
    try {
      const result = await syncOfflineQueues();
      await refreshQueues();
      const conflictNote =
        result.conflictPhotos || result.conflicts
          ? ` ${result.conflictPhotos || result.conflicts || 0} conflict(s) need review.`
          : "";
      setMessage(
        `Synced ${result.inspections} inspection(s), ${result.defects} defect(s), ${result.photos} photo(s). ${result.remainingPhotos} photo(s) still pending.${conflictNote}`,
      );
    } catch (error) {
      setMessage(`Synchronization failed: ${error.message}`);
    } finally {
      setSyncing(false);
    }
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
    if (inspectionClientId && inspectionId) {
      setMessage("Choose either an offline inspection or an existing inspection ID, not both.");
      return;
    }
    if (defectClientId && defectId) {
      setMessage("Choose either an offline defect or an existing defect ID, not both.");
      return;
    }
    try {
      const record = {
        id: createClientId(),
        file_name: file.name,
        mime_type: file.type,
        size: file.size,
        file,
        inspection_id: inspectionId ? Number(inspectionId) : null,
        inspection_client_id: inspectionClientId || null,
        defect_id: defectId ? Number(defectId) : null,
        defect_client_id: defectClientId || null,
        latitude: latitude === "" ? null : Number(latitude),
        longitude: longitude === "" ? null : Number(longitude),
        captured_at: new Date().toISOString(),
        synced: false,
        status: "pending",
        attempts: 0,
        last_error: null,
      };
      await putPhoto(record);
      await refreshQueues();
      setFile(null);
      setInspectionId("");
      setInspectionClientId("");
      setDefectId("");
      setDefectClientId("");
      setLatitude("");
      setLongitude("");
      setMessage(`Photo ${file.name} saved offline and will synchronize automatically.`);
      event.target.reset();
    } catch (error) {
      setMessage(`Photo storage error: ${error.message}`);
    }
  }

  async function removePhoto(id) {
    await deletePhoto(id);
    await refreshQueues();
  }

  async function retryPhoto(item) {
    await putPhoto({
      ...item,
      status: "pending",
      attempts: 0,
      last_error: null,
      synced: false,
    });
    await refreshQueues();
    if (navigator.onLine) await syncQueue();
  }

  function exportQueue() {
    const metadata = queue.map(({ file, ...item }) => item);
    const blob = new Blob([JSON.stringify(metadata, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rams-photos-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function clearQueue() {
    if (queue.length && window.confirm(`Delete ${queue.length} offline photo(s)?`)) {
      for (const item of queue) await deletePhoto(item.id);
      await refreshQueues();
      setMessage("Offline photo queue cleared.");
    }
  }

  return (
    <section className="form-panel offline-photo-panel">
      <div className="form-header">
        <div>
          <h2>Offline Photo Capture</h2>
          <p>
            Photos are stored on this device and can link to an offline inspection or
            defect. Conflicts stop auto-retry until you Retry or Discard.
          </p>
        </div>
      </div>

      <div className="offline-queue-summary" aria-label="Photo queue counts">
        <div className="card">
          <span>Pending</span>
          <strong>{counts.pending}</strong>
        </div>
        <div className="card">
          <span>Conflicts</span>
          <strong>{counts.conflict}</strong>
        </div>
        <div className="card">
          <span>Total</span>
          <strong>{counts.total}</strong>
        </div>
      </div>

      <form onSubmit={savePhoto}>
        <label>
          Road Photo
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            required
          />
        </label>
        {file && (
          <p>
            Selected: {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
          </p>
        )}
        <div className="form-grid">
          <label>
            Offline Inspection
            <select
              value={inspectionClientId}
              onChange={(event) => setInspectionClientId(event.target.value)}
            >
              <option value="">None</option>
              {offlineInspections.map((item) => (
                <option key={item.client_id} value={item.client_id}>
                  {item.section_code || `Section #${item.section_id}`} ·{" "}
                  {item.inspection_date}
                  {item.synced ? " · synced" : " · pending"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Existing Inspection ID
            <input
              type="number"
              value={inspectionId}
              onChange={(event) => setInspectionId(event.target.value)}
            />
          </label>
          <label>
            Offline Defect
            <select
              value={defectClientId}
              onChange={(event) => setDefectClientId(event.target.value)}
            >
              <option value="">None</option>
              {offlineDefects.map((item) => (
                <option key={item.client_id} value={item.client_id}>
                  {item.defect_type} · {item.severity || "unknown"}
                  {item.synced ? " · synced" : " · pending"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Existing Defect ID
            <input
              type="number"
              value={defectId}
              onChange={(event) => setDefectId(event.target.value)}
            />
          </label>
          <label>
            Latitude
            <input
              type="number"
              step="any"
              value={latitude}
              onChange={(event) => setLatitude(event.target.value)}
            />
          </label>
          <label>
            Longitude
            <input
              type="number"
              step="any"
              value={longitude}
              onChange={(event) => setLongitude(event.target.value)}
            />
          </label>
        </div>
        <div className="form-footer">
          <button type="button" onClick={captureGPS}>
            Capture GPS
          </button>
          <button type="submit">Save Photo Offline</button>
          <button
            type="button"
            onClick={syncQueue}
            disabled={syncing || !navigator.onLine}
          >
            {syncing ? "Syncing…" : "Sync Now"}
          </button>
          {message && <span className="message-info">{message}</span>}
        </div>
      </form>

      <div className="form-header">
        <div>
          <h3>Pending Offline Photos</h3>
          <p>
            {queue.length
              ? "Stored on this device until synchronized or discarded."
              : "No photos queued."}
          </p>
        </div>
        <div className="actions">
          <button type="button" onClick={exportQueue} disabled={!queue.length}>
            Export Data
          </button>
          <button type="button" onClick={clearQueue} disabled={!queue.length}>
            Clear Queue
          </button>
        </div>
      </div>

      {queue.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Photo</th>
                <th>Inspection</th>
                <th>Defect</th>
                <th>Status</th>
                <th>Error</th>
                <th>Captured</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((item) => {
                const st = statusOf(item);
                return (
                  <tr
                    key={item.id}
                    className={st === "conflict" ? "offline-row-conflict" : undefined}
                  >
                    <td>{item.file_name}</td>
                    <td>
                      {item.inspection_client_id
                        ? "Offline inspection"
                        : item.inspection_id ?? "—"}
                    </td>
                    <td>
                      {item.defect_client_id
                        ? "Offline defect"
                        : item.defect_id ?? "—"}
                    </td>
                    <td>
                      <span className={`status-pill ${st}`}>{st}</span>
                      {item.attempts ? (
                        <span style={{ marginLeft: 6, fontSize: 11, color: "#64748b" }}>
                          ×{item.attempts}
                        </span>
                      ) : null}
                    </td>
                    <td className="offline-error-cell">{item.last_error || "—"}</td>
                    <td>
                      {item.captured_at
                        ? new Date(item.captured_at).toLocaleString()
                        : "—"}
                    </td>
                    <td>
                      <div className="offline-actions">
                        {st === "conflict" && (
                          <button type="button" onClick={() => retryPhoto(item)}>
                            Retry
                          </button>
                        )}
                        <button type="button" onClick={() => removePhoto(item.id)}>
                          Discard
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
