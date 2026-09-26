import { useEffect, useState } from "react";
import { API_BASE, getMaintenancePlans, getRoads } from "./api";
import { getToken } from "./auth";
import EmptyState from "./components/EmptyState";

async function fetchReport(path) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function money(value) {
  return `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} ETB`;
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
      .then(([roadData, planData]) => {
        setRoads(roadData);
        setPlans(planData);
      })
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
    setLoading(true);
    setError("");
    const query = queryString();
    try {
      const [maintenanceData, conditionData, defectData, costData] = await Promise.all([
        fetchReport(`/reports/maintenance${query}`),
        fetchReport(`/reports/roads/condition${roadId ? `?road_id=${roadId}` : ""}`),
        fetchReport(`/reports/defects${roadId ? `?road_id=${roadId}` : ""}`),
        fetchReport(`/reports/costs${query}`),
      ]);
      setMaintenance(maintenanceData);
      setCondition(conditionData);
      setDefects(defectData);
      setCosts(costData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function exportMaintenanceCsv() {
    try {
      await downloadBlob(`/reports/maintenance.csv${queryString()}`, "maintenance-report.csv");
    } catch (err) {
      setError(err.message);
    }
  }

  async function exportExcel() {
    try {
      await downloadBlob(`/reports/export.xlsx${queryString()}`, "roadmi-reports.xlsx");
    } catch (err) {
      setError(err.message || "Excel export failed");
    }
  }

  async function exportPdf() {
    try {
      await downloadBlob(`/reports/export.pdf${queryString()}`, "rams-reports.pdf");
    } catch (err) {
      setError(err.message || "PDF export failed");
    }
  }

  return (
    <section className="panel insight-page">
      <div className="insight-hero">
        <div>
          <span className="eyebrow">INSIGHTS</span>
          <h2>Reports & Export</h2>
          <p>
            Generate maintenance, condition, defect, and cost summaries. Export CSV, Excel, or PDF
            for planning and audit.
          </p>
        </div>
      </div>

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
            {[...new Set((plans || []).map((p) => p.plan_year).filter(Boolean))]
              .sort()
              .map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
          </select>
        </label>
      </div>
      <div className="actions">
        <button type="button" className="primary" onClick={loadReports} disabled={loading}>
          {loading ? "Loading…" : "Generate reports"}
        </button>
        <button type="button" onClick={exportMaintenanceCsv}>
          Export maintenance CSV
        </button>
        <button type="button" onClick={exportExcel}>
          Export Excel
        </button>
        <button type="button" onClick={exportPdf}>
          Export PDF
        </button>
      </div>
      {error && <div className="auth-error" role="alert">{error}</div>}

      {!loading && !maintenance && !condition && !defects && !costs && (
        <EmptyState title="Run a report to fill this page" icon="▥" tone="info">
          <p>
            Choose optional road / year filters, then click <strong>Generate reports</strong>.
            Summary cards and tables appear here — until then this space shows guidance instead of a
            blank screen.
          </p>
        </EmptyState>
      )}

      {maintenance && (
        <div className="report-block">
          <h3>Maintenance report</h3>
          <div className="insight-kpi-grid compact">
            <div className="insight-kpi">
              <span>Activities</span>
              <strong>{maintenance.summary.activity_count}</strong>
              <small>recorded</small>
            </div>
            <div className="insight-kpi">
              <span>Completed</span>
              <strong>{maintenance.summary.completed_count}</strong>
              <small>finished</small>
            </div>
            <div className="insight-kpi">
              <span>Estimated cost</span>
              <strong>{money(maintenance.summary.estimated_cost)}</strong>
              <small>planned</small>
            </div>
            <div className="insight-kpi">
              <span>Actual cost</span>
              <strong>{money(maintenance.summary.actual_cost)}</strong>
              <small>spent</small>
            </div>
          </div>
        </div>
      )}
      {condition && (
        <div className="report-block">
          <h3>Road condition report</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Road</th>
                  <th>Sections</th>
                  <th>Average condition</th>
                  <th>Minimum</th>
                  <th>Maximum</th>
                </tr>
              </thead>
              <tbody>
                {condition.items.map((item) => (
                  <tr key={item.road_id}>
                    <td>
                      {item.road_code} — {item.road_name}
                    </td>
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
          <div className="insight-kpi-grid compact">
            <div className="insight-kpi">
              <span>Total defects</span>
              <strong>{defects.summary.defect_count}</strong>
              <small>reported</small>
            </div>
          </div>
        </div>
      )}
      {costs && (
        <div className="report-block">
          <h3>Cost & budget report</h3>
          <div className="insight-kpi-grid compact">
            <div className="insight-kpi">
              <span>Budget</span>
              <strong>{money(costs.summary.budget)}</strong>
              <small>plan ceiling</small>
            </div>
            <div className="insight-kpi">
              <span>Estimated</span>
              <strong>{money(costs.summary.estimated_cost)}</strong>
              <small>planned</small>
            </div>
            <div className="insight-kpi">
              <span>Actual</span>
              <strong>{money(costs.summary.actual_cost)}</strong>
              <small>spent</small>
            </div>
            <div className="insight-kpi">
              <span>Budget used</span>
              <strong>
                {costs.summary.budget_utilization_percent == null
                  ? "—"
                  : `${costs.summary.budget_utilization_percent.toFixed(1)}%`}
              </strong>
              <small>utilization</small>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
