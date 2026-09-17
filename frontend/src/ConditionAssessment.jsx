import { useEffect, useState } from "react";
import { getRoadConditionAssessment, getRoads } from "./api";

export default function ConditionAssessment() {
  const [roads, setRoads] = useState([]);
  const [roadId, setRoadId] = useState("");
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => { getRoads().then(setRoads).catch((err) => setError(err.message)); }, []);

  async function assess() {
    if (!roadId) return;
    setError("");
    try { setReport(await getRoadConditionAssessment(Number(roadId))); }
    catch (err) { setReport(null); setError(err.message); }
  }

  return <section className="panel">
    <h2>Condition Rating & Maintenance Priority</h2>
    <div className="button-row"><select value={roadId} onChange={(e) => setRoadId(e.target.value)}><option value="">Select road</option>{roads.map((road) => <option key={road.road_id} value={road.road_id}>{road.road_code} — {road.road_name}</option>)}</select><button type="button" onClick={assess} disabled={!roadId}>Assess road</button></div>
    {error && <div className="auth-error">{error}</div>}
    {report && <><p>Average condition score: <strong>{report.average_score}</strong> / 100 · {report.section_count} sections</p><div className="table-wrap"><table><thead><tr><th>Section</th><th>Chainage</th><th>Score</th><th>Condition</th><th>Priority</th><th>Recommendation</th></tr></thead><tbody>{report.items.map((item) => <tr key={item.section_id}><td>{item.section_code}</td><td>{item.start_chainage}–{item.end_chainage}</td><td>{item.score}</td><td>{item.category}</td><td>{item.priority}</td><td>{item.recommendation}</td></tr>)}</tbody></table></div></>}
  </section>;
}
