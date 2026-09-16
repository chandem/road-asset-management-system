import { useMemo } from "react";

function money(value) {
  return `${(Number(value) || 0).toLocaleString()} ETB`;
}

function monthKey(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function MaintenanceTrends({ maintenance = [] }) {
  const months = useMemo(() => {
    const map = {};
    maintenance.forEach((item) => {
      const key = monthKey(item.planned_date || item.completed_date);
      if (!key) return;
      if (!map[key]) map[key] = { planned: 0, completed: 0, estimated: 0, actual: 0 };
      map[key].planned += 1;
      if (String(item.status).toLowerCase() === "completed") map[key].completed += 1;
      map[key].estimated += Number(item.estimated_cost) || 0;
      map[key].actual += Number(item.actual_cost) || 0;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-12);
  }, [maintenance]);

  const maxCount = Math.max(1, ...months.map(([, x]) => Math.max(x.planned, x.completed)));
  const maxCost = Math.max(1, ...months.map(([, x]) => Math.max(x.estimated, x.actual)));

  return (
    <div className="report-box analytics-wide maintenance-trends">
      <h3>📈 Monthly Maintenance Trends</h3>
      {!months.length && <p>No dated maintenance activities available.</p>}
      {months.length > 0 && (
        <>
          <div className="trend-legend"><span>Activities</span><span>Cost</span></div>
          <div className="trend-table">
            {months.map(([month, data]) => (
              <div className="trend-row" key={month}>
                <strong>{month}</strong>
                <div className="trend-bars">
                  <div className="trend-bar-group">
                    <i title={`Planned: ${data.planned}`} style={{ height: `${(data.planned / maxCount) * 100}%` }} />
                    <i title={`Completed: ${data.completed}`} style={{ height: `${(data.completed / maxCount) * 100}%` }} />
                  </div>
                  <div className="trend-bar-group cost-bars">
                    <i title={`Estimated: ${money(data.estimated)}`} style={{ height: `${(data.estimated / maxCost) * 100}%` }} />
                    <i title={`Actual: ${money(data.actual)}`} style={{ height: `${(data.actual / maxCost) * 100}%` }} />
                  </div>
                </div>
                <span>{data.planned} planned · {data.completed} completed · {money(data.actual)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
