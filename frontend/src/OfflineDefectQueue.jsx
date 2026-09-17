import { useEffect, useState } from "react";
import { getInspections, getDefects, putDefect, deleteDefect } from "./offlineDb";
import { syncOfflineQueues } from "./offlineSync";

export default function OfflineDefectQueue({ sections = [] }) {
  const [inspections, setInspections] = useState([]);
  const [queue, setQueue] = useState([]);
  const [inspectionClientId, setInspectionClientId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [defectType, setDefectType] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [chainageKm, setChainageKm] = useState("");
  const [lengthM, setLengthM] = useState("");
  const [widthM, setWidthM] = useState("");
  const [depthMm, setDepthMm] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [syncing, setSyncing] = useState(false);

  async function refresh() {
    try {
      const [allInspections, allDefects] = await Promise.all([getInspections(), getDefects()]);
      setInspections(allInspections);
      setQueue(allDefects.filter((item) => !item.synced));
    } catch (error) { setMessage(`Offline storage error: ${error.message}`); }
  }

  useEffect(() => { refresh(); }, []);

  async function saveOffline(event) {
    event.preventDefault();
    if (!inspectionClientId) { setMessage("Select an inspection before recording a defect."); return; }
    if (!defectType.trim()) { setMessage("Enter the defect type."); return; }
    const selectedInspection = inspections.find((item) => item.client_id === inspectionClientId);
    if (!selectedInspection) { setMessage("Selected inspection is no longer available on this device."); return; }
    const selectedSection = sections.find((item) => String(item.section_id) === String(sectionId || selectedInspection.section_id));
    const clientId = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const record = {
      client_id: clientId,
      inspection_client_id: inspectionClientId,
      inspection_id: selectedInspection.synced ? selectedInspection.inspection_id : null,
      section_id: sectionId ? Number(sectionId) : selectedInspection.section_id ?? null,
      section_code: selectedSection?.section_code || null,
      road_id: selectedSection?.road_id ?? selectedInspection.road_id ?? null,
      defect_type: defectType.trim(), severity: severity || null,
      chainage_km: chainageKm === "" ? null : Number(chainageKm),
      length_m: lengthM === "" ? null : Number(lengthM), width_m: widthM === "" ? null : Number(widthM), depth_mm: depthMm === "" ? null : Number(depthMm),
      description: description || null, detected_by: "manual", synced: false, captured_at: new Date().toISOString(),
    };
    try {
      await putDefect(record); await refresh();
      setMessage(`Defect saved offline for ${record.section_code || "the selected inspection"}.`);
      setDefectType(""); setChainageKm(""); setLengthM(""); setWidthM(""); setDepthMm(""); setDescription("");
    } catch (error) { setMessage(`Could not save defect offline: ${error.message}`); }
  }

  async function syncQueue() {
    if (!navigator.onLine || syncing) return;
    setSyncing(true); setMessage("Synchronizing inspections, defects and photos…");
    try {
      const result = await syncOfflineQueues(); await refresh();
      setMessage(`Synced ${result.inspections} inspection(s), ${result.defects} defect(s) and ${result.photos} photo(s). ${result.remainingDefects} defect(s) remain queued.`);
    } catch (error) { setMessage(`Synchronization failed: ${error.message}`); }
    finally { setSyncing(false); }
  }

  useEffect(() => {
    const onOnline = () => syncQueue();
    window.addEventListener("online", onOnline);
    window.addEventListener("rams:offline-sync-complete", refresh);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("rams:offline-sync-complete", refresh); };
  }, []);

  return (
    <section className="form-panel offline-inspection-panel">
      <div className="form-header"><div><h2>⚠️ Offline Defect Capture</h2><p>Record road defects without internet. Each defect stays linked to its parent inspection and synchronizes automatically.</p></div><div className="card"><span>Queued</span><strong>{queue.length}</strong></div></div>
      <form onSubmit={saveOffline}>
        <div className="form-grid">
          <label>Inspection<select value={inspectionClientId} onChange={(event) => setInspectionClientId(event.target.value)} required><option value="">Select inspection</option>{inspections.map((item) => <option key={item.client_id} value={item.client_id}>{item.section_code || `Section #${item.section_id}`} · {item.inspection_date}{item.synced ? " · synced" : " · pending"}</option>)}</select></label>
          <label>Road Section<select value={sectionId} onChange={(event) => setSectionId(event.target.value)}><option value="">Use inspection section</option>{sections.map((section) => <option key={section.section_id} value={section.section_id}>{section.section_code} ({section.start_chainage}–{section.end_chainage} km)</option>)}</select></label>
          <label>Defect Type<input value={defectType} onChange={(event) => setDefectType(event.target.value)} placeholder="Pothole, cracking…" required /></label>
          <label>Severity<select value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label>
          <label>Chainage (km)<input type="number" min="0" step="0.001" value={chainageKm} onChange={(event) => setChainageKm(event.target.value)} /></label>
          <label>Length (m)<input type="number" min="0" step="0.01" value={lengthM} onChange={(event) => setLengthM(event.target.value)} /></label>
          <label>Width (m)<input type="number" min="0" step="0.01" value={widthM} onChange={(event) => setWidthM(event.target.value)} /></label>
          <label>Depth (mm)<input type="number" min="0" step="0.01" value={depthMm} onChange={(event) => setDepthMm(event.target.value)} /></label>
        </div>
        <label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Field observation…" /></label>
        <div className="form-footer"><button type="submit">Save Defect Offline</button><button type="button" onClick={syncQueue} disabled={syncing || !navigator.onLine}>{syncing ? "Syncing…" : "Sync Now"}</button>{message && <span>{message}</span>}</div>
      </form>
      {queue.length > 0 && <div className="table-wrap"><table><thead><tr><th>Section</th><th>Defect</th><th>Severity</th><th>Chainage</th><th>Captured</th><th>Action</th></tr></thead><tbody>{queue.map((item) => <tr key={item.client_id}><td>{item.section_code || `#${item.section_id || "—"}`}</td><td>{item.defect_type}</td><td>{item.severity || "—"}</td><td>{item.chainage_km ?? "—"}</td><td>{new Date(item.captured_at).toLocaleString()}</td><td><button type="button" onClick={async () => { await deleteDefect(item.client_id); await refresh(); }}>Remove</button></td></tr>)}</tbody></table></div>}
    </section>
  );
}
