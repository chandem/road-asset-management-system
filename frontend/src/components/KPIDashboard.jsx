function pct(value) {
  if (value === null || value === undefined) return "—";
  return `${Number(value).toFixed(1)}%`;
}

function money(value) {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function KpiTile({ label, value, hint, tone = "neutral", loading }) {
  return (
    <article className={`kpi-tile kpi-tone-${tone}`} aria-label={label}>
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value" aria-live="polite">
        {loading ? "…" : value}
      </strong>
      {hint ? <span className="kpi-hint">{hint}</span> : null}
    </article>
  );
}

function KpiGroup({ title, children }) {
  return (
    <div className="kpi-group">
      <h3 className="kpi-group-title">{title}</h3>
      <div className="kpi-grid">{children}</div>
    </div>
  );
}

export default function KPIDashboard({ kpis, loading }) {
  if (loading && !kpis) {
    return (
      <section className="panel kpi-dashboard" aria-busy="true">
        <div className="panel-heading">
          <div>
            <h2>Portfolio KPIs</h2>
            <p>Loading maintenance, cost, and work-order metrics…</p>
          </div>
        </div>
        <div className="kpi-skeleton-row" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="kpi-tile kpi-skeleton" />
          ))}
        </div>
      </section>
    );
  }

  if (!kpis) return null;

  const m = kpis.maintenance || {};
  const c = kpis.cost || {};
  const w = kpis.work_orders || {};

  const overdueTone = (m.overdue || 0) > 0 ? "warn" : "good";
  const variance = Number(c.variance);
  const varianceTone =
    !Number.isFinite(variance) || variance === 0
      ? "neutral"
      : variance > 0
        ? "warn"
        : "good";
  const rejectTone = (w.rejected || 0) > 0 ? "danger" : "good";
  const completion = Number(m.completion_rate_percent);
  const completionTone =
    !Number.isFinite(completion)
      ? "neutral"
      : completion >= 80
        ? "good"
        : completion >= 50
          ? "warn"
          : "danger";

  return (
    <section className="panel kpi-dashboard" aria-label="Portfolio KPIs">
      <div className="panel-heading">
        <div>
          <h2>Portfolio KPIs</h2>
          <p>
            Maintenance progress, cost control, and work-order quality across the
            network.
          </p>
        </div>
        {kpis.as_of && (
          <p className="kpi-as-of">As of {kpis.as_of}</p>
        )}
      </div>

      <div className="kpi-groups">
        <KpiGroup title="Maintenance">
          <KpiTile
            loading={loading}
            label="Completed"
            value={`${m.completed ?? 0} / ${m.total ?? 0}`}
            hint="Activities finished vs planned"
            tone="neutral"
          />
          <KpiTile
            loading={loading}
            label="Completion rate"
            value={pct(m.completion_rate_percent)}
            hint="Share of maintenance closed"
            tone={completionTone}
          />
          <KpiTile
            loading={loading}
            label="Overdue"
            value={m.overdue ?? 0}
            hint="Past planned date"
            tone={overdueTone}
          />
        </KpiGroup>

        <KpiGroup title="Cost">
          <KpiTile
            loading={loading}
            label="Estimated"
            value={money(c.estimated)}
            hint="Planned spend"
            tone="neutral"
          />
          <KpiTile
            loading={loading}
            label="Actual"
            value={money(c.actual)}
            hint="Recorded spend"
            tone="neutral"
          />
          <KpiTile
            loading={loading}
            label="Variance"
            value={money(c.variance)}
            hint={pct(c.variance_percent)}
            tone={varianceTone}
          />
        </KpiGroup>

        <KpiGroup title="Work orders">
          <KpiTile
            loading={loading}
            label="Verified / completed"
            value={`${w.verified ?? 0} / ${w.completed ?? 0}`}
            hint="QA vs closed orders"
            tone="neutral"
          />
          <KpiTile
            loading={loading}
            label="Verification rate"
            value={pct(w.verification_rate_percent)}
            hint="Verified of completed"
            tone="neutral"
          />
          <KpiTile
            loading={loading}
            label="Accepted"
            value={w.accepted ?? 0}
            hint="Passed verification"
            tone="good"
          />
          <KpiTile
            loading={loading}
            label="Rejected"
            value={w.rejected ?? 0}
            hint="Failed verification"
            tone={rejectTone}
          />
        </KpiGroup>
      </div>
    </section>
  );
}
