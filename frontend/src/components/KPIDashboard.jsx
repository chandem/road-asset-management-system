function pct(value) {
  if (value === null || value === undefined) return "—";
  return `${Number(value).toFixed(1)}%`;
}

function money(value) {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function KPIDashboard({ kpis, loading }) {
  if (loading && !kpis) {
    return (
      <section className="panel kpi-dashboard">
        <h2>Portfolio KPIs</h2>
        <p>Loading…</p>
      </section>
    );
  }

  if (!kpis) return null;

  const m = kpis.maintenance || {};
  const c = kpis.cost || {};
  const w = kpis.work_orders || {};

  return (
    <section className="panel kpi-dashboard">
      <div className="panel-heading">
        <h2>Portfolio KPIs</h2>
        {kpis.as_of && <p className="muted">As of {kpis.as_of}</p>}
      </div>

      <div className="stats-grid">
        <div>
          <strong>{loading ? "…" : m.completed ?? 0}/{m.total ?? 0}</strong>
          <span>Maintenance completed</span>
        </div>
        <div>
          <strong>{loading ? "…" : pct(m.completion_rate_percent)}</strong>
          <span>Completion rate</span>
        </div>
        <div>
          <strong>{loading ? "…" : m.overdue ?? 0}</strong>
          <span>Overdue activities</span>
        </div>
        <div>
          <strong>{loading ? "…" : money(c.estimated)}</strong>
          <span>Estimated cost</span>
        </div>
        <div>
          <strong>{loading ? "…" : money(c.actual)}</strong>
          <span>Actual cost</span>
        </div>
        <div>
          <strong>{loading ? "…" : money(c.variance)}</strong>
          <span>Cost variance ({pct(c.variance_percent)})</span>
        </div>
        <div>
          <strong>{loading ? "…" : w.verified ?? 0}/{w.completed ?? 0}</strong>
          <span>WO verified / completed</span>
        </div>
        <div>
          <strong>{loading ? "…" : pct(w.verification_rate_percent)}</strong>
          <span>Verification rate</span>
        </div>
        <div>
          <strong>{loading ? "…" : w.accepted ?? 0}</strong>
          <span>Accepted</span>
        </div>
        <div>
          <strong>{loading ? "…" : w.rejected ?? 0}</strong>
          <span>Rejected</span>
        </div>
      </div>
    </section>
  );
}
