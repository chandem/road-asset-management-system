import { useEffect, useState } from "react";
import { syncOfflineQueues } from "./offlineSync";
import { deleteInspection, getPendingInspections, putInspection } from "./offlineDb";

export default function OfflineInspectionQueue({ sections = [] }) {
  const [queue, setQueue] = useState([]);
  const [sectionId, setSectionId] = useState("");
  const [inspectionDate, setInspectionDate] = useState(new Date().toISOString().slice(0, 10));
  const [conditionRating, setConditionRating] = useState("");
  const [weather, setWeather] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [syncing, setSyncing] = useState(false);

  async function refresh() {
    try { setQueue(await getPendingInspections()); }
    catch (error) { setMessage(`Offline storage error: ${error.message}`); }
  }

  useEffect(() => { refresh(); }, []);

  async function syncQueue() {
    if (!navigator.onLine || syncing) return;
    setSyncing(true); setMessage("Synchronizing offline inspections and photos…");
    try {
      const result = await syncOfflineQueues();
      await refresh();
      setMessage(`Synced ${result.inspections} inspection(s), ${result.photos} photo(s). ${result.remainingInspections} inspection(s) and ${result.remainingPhotos} photo(s) remain queued.`);
    } catch (error) { setMessage(`Synchronization failed: ${error.message}`); }
    finally { setSyncing(false); }
  }

  useEffect(() => {
    const onOnline = () => syncQueue();
    const onSyncComplete = () => refresh();
    window.addEventListener("online", onOnline);
    window.addEventListener("rams:offline-sync-complete", onSyncComplete);
    const timer = window.setInterval(syncQueue, 15000);
    if (navigator.onLine) syncQueue();
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("rams:offline-sync-complete", onSyncComplete);
      window.clearInterval(timer);
    };
  }, []);

  async function saveOffline(event) {
    event.preventDefault();
    if (!sectionId) { setMessage("Select a road section."); return; }
    const section = sections.find((item) => String(item.section_id) === String(sectionId));
    const clientId = `${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
    const record = {
      client_id: clientId,
      section_id: Number(sectionId), section_code: section?.section_code || null,
      road_id: section?.road_id || null, inspection_date: inspectionDate,
      condition_rating: conditionRating === "" ? null : Number(conditionRating),
      weather: weather || null, notes: notes || null,
      captured_at: new Date().toISOString(), synced: false,
    };
    try {
      await putInspection(record); await refresh();
      setMessage(`Inspection for ${record.section_code || `section #${record.section_id}`} saved offline.`);
      setConditionRating(""); setWeather(""); setNotes("");
    } catch (error) { setMessage(`Could not save inspection offline: ${error.message}`); }
  }

  async function removeRecord(clientId) { await deleteInspection(clientId); await refresh(); }
  async function clearQueue() {
    if (!queue.length || !window.confirm(`Delete ${queue.length} pending offline inspection record(s)?`)) return;
    for (const item of queue) await deleteInspection(item.client_id);
    await refresh(); setMessage("Pending offline inspection queue cleared.");
  }
  function exportQueue() {
    const blob = new Blob([JSON.stringify(queue, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = `rams-inspections-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url);
  }

  return (
    <section className="form-panel offline-inspection-panel">
      <div className="form-header"><div><h2>📋 Offline Inspection Capture</h2><p>Capture inspections without internet. Records persist in IndexedDB and synchronize automatically when connectivity returns.</p></div><div className="card"><span>Pending</span><strong>{queue.length}</strong></div></div>
      <form onSubmit={saveOffline}><div className="form-grid">
        <label>Road Section<select value={sectionId} onChange={(event) => setSectionId(event.target.value)} required><option value="">Select section</option>{sections.map((section) => <option key={section.section_id} value={section.section_id}>{section.section_code} ({section.start_chainage}–{section.end_chainage} km)</option>)}</select></label>
        <label>Inspection Date<input type="date" value={inspectionDate} onChange={(event) => setInspectionDate(event.target.value)} required /></label>
        <label>Condition Rating (0–100)<input type="number" min="0" max="100" step="0.01" value={conditionRating} onChange={(event) => setConditionRating(event.target.value)} /></label>
        <label>Weather<input value={weather} onChange={(event) => setWeather(event.target.value)} placeholder="Sunny, rainy…" /></label>
      </div><label>Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Field observations…" /></label>
      <div className="form-footer"><button type="submit">Save Inspection Offline</button><button type="button" onClick={syncQueue} disabled={syncing || !navigator.onLine}>{syncing ? "Syncing…" : "Sync Now"}</button>{message && <span>{message}</span>}</div></form>
      <div className="offline-inspection-queue"><div className="form-header"><div><h3>Pending Offline Inspections</h3><p>{queue.length ? "Stored on this device." : "No pending offline inspections queued."}</p></div><div className="actions"><button type="button" onClick={exportQueue} disabled={!queue.length}>Export Data</button><button type="button" onClick={clearQueue} disabled={!queue.length}>Clear Queue</button></div></div>
      {queue.length > 0 && <div className="table-wrap"><table><thead><tr><th>Section</th><th>Date</th><th>Condition</th><th>Weather</th><th>Captured</th><th>Action</th></tr></thead><tbody>{queue.map((item) => <tr key={item.client_id}><td>{item.section_code || `#${item.section_id}`}</td><td>{item.inspection_date}</td><td>{item.condition_rating ?? "—"}</td><td>{item.weather || "—"}</td><td>{new Date(item.captured_at).toLocaleString()}</td><td><button type="button" onClick={() => removeRecord(item.client_id)}>Remove</button></td></tr>)}</tbody></table></div>}</div>
    </section>
  );
}
