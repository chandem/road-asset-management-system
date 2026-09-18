import { useEffect, useState } from "react";
import { API_BASE, getMaintenancePlans, getRoads } from "./api";
import { getToken } from "./auth";

async function fetchReport(path) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function money(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

async function downloadBlob(path, filename) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Download failed: ${filename}`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const [roads, setRoads] = useState([]);
  const [plans, setPlans] = useState([]);
  const [roadId, setRoadId] = useState("");
  const [year, setYear] = useState("");
  const [maintenance, setMaintenance] = useState(null);
  const [condition, setCondition] = useState(null);
  const [defects, setDefects] = useState(null);
  const [costs, setCosts] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([getRoads(), getMaintenancePlans()])
      .then(([roadData, planData]) => { setRoads(roadData); setPlans(planData); })
      .catch((err) => setError(err.message));
  }, []);

  function queryString() {
    const params = new URLSearchParams();
    if (roadId) params.set("road_id", roadId);
    if (year) params.set("plan_year", year);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }

  async function loadReports() {
    setLoading(true); setError("");
    const query = queryString();
    try {
      const [maintenanceData, conditionData, defectData, costData] = await Promise.all([
        fetchReport(`/reports/maintenance${query}`),
        fetchReport(`/reports/roads/condition${roadId ? `?road_id=${roadId}` : ""}`),
        fetchReport(`/reports/defects${roadId ? `?road_id=${roadId}` : ""}`),
        fetchReport(`/reports/costs${query}`),
      ]);
      setMaintenance(maintenanceData); setCondition(conditionData); setDefects(defectData); setCosts(costData);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function exportMaintenanceCsv() {
    try {
      await downloadBlob(`/reports/maintenance.csv${queryString()}`, "maintenance-report.csv");
    } catch (err) { setError(err.message); }
  }

  async function exportExcel() {
    try {
      await downloadBlob(`/reports/export.xlsx${queryString()}`, "rams-reports.xlsx");
    } catch (err) { setError(err.message || "Excel export failed"); }
  }

  async function exportPdf() {
    try {
      await downloadBlob(`/reports/export.pdf${queryString()}`, "rams-reports.pdf");
    } catch (err) { setError(err.message || "PDF export failed"); }
  }

  return (
    <section className="panel">
      <h2>Reports & Export</h2>
      <div className="form-grid">
        <label>
          Road
          <select value={roadId} onChange={(e) => setRoadId(e.target.value)}>
            <option value="">All roads</option>
            {roads.map((road) => (
              <option key={road.road_id} value={road.road_id}>
                {road.road_code} — {road.road_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Plan year
          <select value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">All years</option>
            {plans.map((plan) => (
              <option key={plan.plan_id} value={plan.plan_year}>
                {plan.plan_year} — {plan.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="button-row">
        <button type="button" onClick={loadReports} disabled={loading}>
          {loading ? "Loading…" : "Generate reports"}
        </button>
        <button type="button" onClick={exportMaintenanceCsv}>Export maintenance CSV</button>
        <button type="button" onClick={exportExcel}>Export Excel</button>
        <button type="button" onClick={exportPdf}>Export PDF</button>
      </div>
      {error && <div className="auth-error">{error}</div>}

      {maintenance && (
        <div className="report-block">
          <h3>Maintenance report</h3>
          <div className="stats-grid">
            <div><strong>{maintenance.summary.activity_count}</strong><span>Activities</span></div>
            <div><strong>{maintenance.summary.completed_count}</strong><span>Completed</span></div>
            <div><strong>{money(maintenance.summary.estimated_cost)}</strong><span>Estimated cost</span></div>
            <div><strong>{money(maintenance.summary.actual_cost)}</strong><span>Actual cost</span></div>
          </div>
        </div>
      )}
      {condition && (
        <div className="report-block">
          <h3>Road condition report</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Road</th><th>Sections</th><th>Average condition</th><th>Minimum</th><th>Maximum</th></tr></thead>
              <tbody>
                {condition.items.map((item) => (
                  <tr key={item.road_id}>
                    <td>{item.road_code} — {item.road_name}</td>
                    <td>{item.section_count}</td>
                    <td>{item.average_condition ?? "—"}</td>
                    <td>{item.minimum_condition ?? "—"}</td>
                    <td>{item.maximum_condition ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {defects && (
        <div className="report-block">
          <h3>Defect report</h3>
          <p>Total defects: <strong>{defects.summary.defect_count}</strong></p>
        </div>
      )}
      {costs && (
        <div className="report-block">
          <h3>Cost & budget report</h3>
          <div className="stats-grid">
            <div><strong>{money(costs.summary.budget)}</strong><span>Budget</span></div>
            <div><strong>{money(costs.summary.estimated_cost)}</strong><span>Estimated</span></div>
            <div><strong>{money(costs.summary.actual_cost)}</strong><span>Actual</span></div>
            <div><strong>{costs.summary.budget_utilization_percent == null ? "—" : `${costs.summary.budget_utilization_percent.toFixed(1)}%`}</strong><span>Budget used</span></div>
          </div>
        </div>
      )}
    </section>
  );
}
