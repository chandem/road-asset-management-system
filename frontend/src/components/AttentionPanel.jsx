export default function AttentionPanel({ attention, loading, onNavigate }) {
  const normalizedAttention = attention || {
    totals: {},
    overdue_work_orders: [],
    high_severity_defects: [],
    overdue_maintenance: [],
    over_budget_plans: [],
  };
  const totals = normalizedAttention.totals || {};

  const safeNumber = (value) => Number(value) || 0;
  const total =
    safeNumber(totals.overdue_work_orders) +
    safeNumber(totals.high_severity_defects) +
    safeNumber(totals.overdue_maintenance) +
    safeNumber(totals.over_budget_plans);

  const severityCounts = [
    { key: "overdue_work_orders", label: "overdue WOs", tone: "warn" },
    { key: "high_severity_defects", label: "high defects", tone: "danger" },
    { key: "overdue_maintenance", label: "overdue maint.", tone: "warn" },
    { key: "over_budget_plans", label: "over budget", tone: "danger" },
  ];

  if (loading && !attention) {
    return (
      <section className="attention-panel" aria-live="polite" aria-busy="true">
        <div className="panel-heading">
          <div>
            <h2>Needs attention</h2>
            <p>Loading operational alerts…</p>
          </div>
        </div>
      </section>
    );
  }

  if (!loading && total === 0) {
    return (
      <section className="attention-panel attention-ok" aria-live="polite">
        <div className="panel-heading">
          <div>
            <h2>Needs attention</h2>
            <p>No overdue work orders, high-severity defects, or over-budget plans right now.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="attention-panel" aria-label="Operational alerts summary">
      <div className="panel-heading">
        <div>
          <h2>Needs attention</h2>
          <p aria-live="polite">
            {total} item{total === 1 ? "" : "s"} as of {normalizedAttention.as_of || "—"}
          </p>
        </div>
        <div className="attention-pills" aria-label="Operational alert totals">
          {severityCounts.map(({ key, label, tone }) => (
            <span key={key} className={`pill ${tone}`}>
              <strong>{safeNumber(totals[key])}</strong>
              <span className="pill-label">{label}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="attention-grid">
        <AttentionColumn
          title="Overdue work orders"
          empty="No overdue work orders"
          items={normalizedAttention.overdue_work_orders}
          render={(wo) => (
            <div className="attention-item">
              <strong className="attention-item-title">{wo.order_number}</strong>
              <span className="attention-item-meta">
                Due {wo.due_date}
                <span className="dot" aria-hidden="true">·</span>
                {wo.status}
              </span>
              {wo.assigned_to ? (
                <span className="attention-item-meta">{wo.assigned_to}</span>
              ) : null}
            </div>
          )}
          onOpen={() => onNavigate?.("workorders")}
        />
        <AttentionColumn
          title="High-severity defects"
          empty="No high-severity defects"
          items={normalizedAttention.high_severity_defects}
          render={(d) => (
            <div className="attention-item">
              <strong className="attention-item-title">{d.defect_type}</strong>
              <span className="attention-item-meta">
                <span className={`sev-badge sev-${String(d.severity || "").toLowerCase()}`}>
                  {d.severity}
                </span>
                {d.chainage_km != null && (
                  <>
                    <span className="dot" aria-hidden="true">·</span>
                    <span>km {d.chainage_km}</span>
                  </>
                )}
              </span>
            </div>
          )}
          onOpen={() => onNavigate?.("reports")}
        />
        <AttentionColumn
          title="Overdue maintenance"
          empty="No overdue maintenance"
          items={normalizedAttention.overdue_maintenance}
          render={(m) => (
            <div className="attention-item">
              <strong className="attention-item-title">{m.activity_type}</strong>
              <span className="attention-item-meta">
                Planned {m.planned_date}
                <span className="dot" aria-hidden="true">·</span>
                {m.status}
                {m.priority ? (
                  <>
                    <span className="dot" aria-hidden="true">·</span>
                    <span className="priority-text">{m.priority}</span>
                  </>
                ) : null}
              </span>
            </div>
          )}
          onOpen={() => onNavigate?.("maintenance")}
        />
        <AttentionColumn
          title="Plans over budget"
          empty="No over-budget plans"
          items={normalizedAttention.over_budget_plans}
          render={(p) => (
            <div className="attention-item">
              <strong className="attention-item-title">
                {p.name} ({p.plan_year})
              </strong>
              <span className="attention-item-meta">
                Spent {Number(p.spent).toLocaleString()} ETB
                <span className="dot" aria-hidden="true">·</span>
                Budget {Number(p.budget).toLocaleString()} ETB
              </span>
              <span className="attention-item-meta sev-text">
                Over by {Number(p.over_by).toLocaleString()} ETB
              </span>
            </div>
          )}
          onOpen={() => onNavigate?.("planning")}
        />
      </div>
    </section>
  );
}

function AttentionColumn({ title, empty, items, render, onOpen }) {
  const list = Array.isArray(items) ? items : [];

  return (
    <div className="attention-col">
      <div className="attention-col-head">
        <h3>{title}</h3>
        {onOpen && (
          <button
            type="button"
            className="attention-open-button"
            onClick={onOpen}
            aria-label={`Open ${title.toLowerCase()}`}
          >
            <span>View details</span>
            <span className="attention-open-arrow" aria-hidden="true">
              →
            </span>
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ul className="attention-list">
          {list.slice(0, 8).map((item, index) => (
            <li
              key={
                item.work_order_id ||
                item.defect_id ||
                item.maintenance_id ||
                item.plan_id ||
                index
              }
            >
              {render(item)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
