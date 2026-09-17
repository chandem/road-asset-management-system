export default function ReportPanel({ report, onRefresh }) {
  return (
    <section className="report-panel">
      <div className="panel-heading">
        <div>
          <h2>📊 Dashboard & Reports</h2>
          <p>Operational overview of road condition, inspections, defects and maintenance.</p>
        </div>
        <button type="button" onClick={onRefresh}>Refresh Report</button>
      </div>
      <div className="cards report-cards">
        <div className="card"><span>Average Section Condition</span><strong>{report.averageCondition == null ? "—" : report.averageCondition.toFixed(1)}/100</strong></div>
        <div className="card"><span>Inspections</span><strong>{report.inspectionCount}</strong></div>
        <div className="card"><span>Total Defects</span><strong>{report.defects}</strong></div>
        <div className="card"><span>Maintenance</span><strong>{report.planned}</strong></div>
        <div className="card"><span>Completed Maintenance</span><strong>{report.completed}</strong></div>
        <div className="card"><span>Estimated Cost</span><strong>{report.estimated.toLocaleString()} ETB</strong></div>
        <div className="card"><span>Actual Cost</span><strong>{report.actual.toLocaleString()} ETB</strong></div>
      </div>
      <div className="report-grid">
        <div className="report-box">
          <h3>Defects by Severity</h3>
          {Object.entries(report.severity).map(([key, value]) => (
            <div className="bar-row" key={key}>
              <span>{key}</span>
              <div className="bar"><i style={{ width: `${report.defects ? Math.max(2, (value / report.defects) * 100) : 0}%` }} /></div>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <div className="report-box">
          <h3>Defects by Type</h3>
          {Object.keys(report.types).length === 0 ? (
            <p>No defect records yet.</p>
          ) : (
            Object.entries(report.types)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8)
              .map(([key, value]) => (
                <div className="bar-row" key={key}>
                  <span>{key}</span>
                  <div className="bar"><i style={{ width: `${report.defects ? Math.max(2, (value / report.defects) * 100) : 0}%` }} /></div>
                  <strong>{value}</strong>
                </div>
              ))
          )}
        </div>
      </div>
      <div className="report-box">
        <h3>Road Condition Overview</h3>
        {report.roadCondition.length === 0 ? (
          <p>No roads available.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Road</th>
                  <th>Sections</th>
                  <th>Average Condition</th>
                  <th>Length (km)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {report.roadCondition.map((r) => (
                  <tr key={r.road_id}>
                    <td>{r.road_code} · {r.road_name}</td>
                    <td>{r.sectionCount}</td>
                    <td>{r.condition == null ? "—" : `${r.condition.toFixed(1)}/100`}</td>
                    <td>{r.total_length_km ?? "—"}</td>
                    <td>{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
