import { useEffect, useState } from "react";
import { createInspection } from "./api";

const QUEUE_KEY = "rams.offline.inspection.queue";

function loadQueue() {
  try {
    const value = localStorage.getItem(QUEUE_KEY);
    return value ? JSON.parse(value) : [];
  } catch { return []; }
}

export default function OfflineInspectionQueue({ sections = [] }) {
  const [queue, setQueue] = useState(loadQueue);
  const [sectionId, setSectionId] = useState("");
  const [inspectionDate, setInspectionDate] = useState(new Date().toISOString().slice(0, 10));
  const [conditionRating, setConditionRating] = useState("");
  const [weather, setWeather] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)); }
    catch { setMessage("Offline storage is unavailable on this device."); }
  }, [queue]);

  async function syncQueue() {
    if (!navigator.onLine || syncing || !queue.length) return;
    setSyncing(true); setMessage("Synchronizing offline inspections…");
    const pending = [...queue];
    const failed = [];
    let syncedCount = 0;
    for (const item of pending) {
      try {
        await createInspection(item.section_id, {
          inspection_date: item.inspection_date,
          inspector_id: item.inspector_id ?? null,
          condition_rating: item.condition_rating,
          weather: item.weather,
          notes: item.notes,
        });
        syncedCount += 1;
      } catch { failed.push(item); }
    }
    setQueue(failed);
    setMessage(failed.length ? `Synced ${syncedCount}; ${failed.length} inspection(s) remain queued.` : `Synced ${syncedCount} offline inspection(s).`);
    setSyncing(false);
  }

  useEffect(() => {
    const onOnline = () => syncQueue();
    window.addEventListener("online", onOnline);
    const timer = window.setInterval(syncQueue, 15000);
    if (navigator.onLine && queue.length) syncQueue();
    return () => { window.removeEventListener("online", onOnline); window.clearInterval(timer); };
  }, [queue.length]);

  function saveOffline(event) {
    event.preventDefault();
    if (!sectionId) { setMessage("Select a road section."); return; }
    const section = sections.find((item) => String(item.section_id) === String(sectionId));
    const record = {
      id: `${Date.now()}-${sectionId}`,
      section_id: Number(sectionId), section_code: section?.section_code || null,
      road_id: section?.road_id || null, inspection_date: inspectionDate,
      condition_rating: conditionRating === "" ? null : Number(conditionRating),
      weather: weather || null, notes: notes || null,
      captured_at: new Date().toISOString(), synced: false,
    };
    setQueue((current) => [...current, record]);
    setMessage(`Inspection for ${record.section_code || `section #${record.section_id}`} saved offline.`);
    setConditionRating(""); setWeather(""); setNotes("");
  }

  function removeRecord(id) { setQueue((current) => current.filter((item) => item.id !== id)); }
  function clearQueue() { if (queue.length && window.confirm(`Delete ${queue.length} offline inspection record(s)?`)) { setQueue([]); setMessage("Offline inspection queue cleared."); } }
  function exportQueue() {
    const blob = new Blob([JSON.stringify(queue, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = `rams-inspections-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url);
  }

  return (
    <section className="form-panel offline-inspection-panel">
      <div className="form-header"><div><h2>📋 Offline Inspection Capture</h2><p>Capture inspection records without internet. When connectivity returns, RAMS automatically synchronizes them.</p></div><div className="card"><span>Queued</span><strong>{queue.length}</strong></div></div>
      <form onSubmit={saveOffline}><div className="form-grid">
        <label>Road Section<select value={sectionId} onChange={(event) => setSectionId(event.target.value)} required><option value="">Select section</option>{sections.map((section) => <option key={section.section_id} value={section.section_id}>{section.section_code} ({section.start_chainage}–{section.end_chainage} km)</option>)}</select></label>
        <label>Inspection Date<input type="date" value={inspectionDate} onChange={(event) => setInspectionDate(event.target.value)} required /></label>
        <label>Condition Rating (0–100)<input type="number" min="0" max="100" step="0.01" value={conditionRating} onChange={(event) => setConditionRating(event.target.value)} /></label>
        <label>Weather<input value={weather} onChange={(event) => setWeather(event.target.value)} placeholder="Sunny, rainy…" /></label>
      </div><label>Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Field observations…" /></label>
      <div className="form-footer"><button type="submit">Save Inspection Offline</button><button type="button" onClick={syncQueue} disabled={syncing || !queue.length || !navigator.onLine}>{syncing ? "Syncing…" : "Sync Now"}</button>{message && <span>{message}</span>}</div></form>
      <div className="offline-inspection-queue"><div className="form-header"><div><h3>Pending Offline Inspections</h3><p>{queue.length ? "Stored on this device." : "No offline inspections queued."}</p></div><div className="actions"><button type="button" onClick={exportQueue} disabled={!queue.length}>Export Data</button><button type="button" onClick={clearQueue} disabled={!queue.length}>Clear Queue</button></div></div>
      {queue.length > 0 && <div className="table-wrap"><table><thead><tr><th>Section</th><th>Date</th><th>Condition</th><th>Weather</th><th>Captured</th><th>Action</th></tr></thead><tbody>{queue.map((item) => <tr key={item.id}><td>{item.section_code || `#${item.section_id}`}</td><td>{item.inspection_date}</td><td>{item.condition_rating ?? "—"}</td><td>{item.weather || "—"}</td><td>{new Date(item.captured_at).toLocaleString()}</td><td><button type="button" onClick={() => removeRecord(item.id)}>Remove</button></td></tr>)}</tbody></table></div>}</div>
    </section>
  );
}
