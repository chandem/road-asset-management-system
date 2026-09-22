export default function AttentionPanel({ attention, loading, onNavigate }) {
  const normalizedAttention = attention || { totals: {}, overdue_work_orders: [], high_severity_defects: [], overdue_maintenance: [], over_budget_plans: [] };
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
              {safeNumber(totals[key])} {label}
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
            <>
              <strong>{wo.order_number}</strong>
              <span>Due {wo.due_date} · {wo.status}</span>
              {wo.assigned_to && <span>{wo.assigned_to}</span>}
            </>
          )}
          onOpen={() => onNavigate?.("workorders")}
        />
        <AttentionColumn
          title="High-severity defects"
          empty="No high-severity defects"
          items={normalizedAttention.high_severity_defects}
          render={(d) => (
            <>
              <strong>{d.defect_type}</strong>
              <span className="sev">{d.severity}</span>
              {d.chainage_km != null && <span>km {d.chainage_km}</span>}
            </>
          )}
          onOpen={() => onNavigate?.("reports")}
        />
        <AttentionColumn
          title="Overdue maintenance"
          empty="No overdue maintenance"
          items={normalizedAttention.overdue_maintenance}
          render={(m) => (
            <>
              <strong>{m.activity_type}</strong>
              <span>Planned {m.planned_date} · {m.status}</span>
              {m.priority && <span>{m.priority}</span>}
            </>
          )}
          onOpen={() => onNavigate?.("maintenance")}
        />
        <AttentionColumn
          title="Plans over budget"
          empty="No over-budget plans"
          items={normalizedAttention.over_budget_plans}
          render={(p) => (
            <>
              <strong>
                {p.name} ({p.plan_year})
              </strong>
              <span>
                Spent {Number(p.spent).toLocaleString()} / budget {Number(p.budget).toLocaleString()}
              </span>
              <span className="sev">+{Number(p.over_by).toLocaleString()}</span>
            </>
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
            <span className="attention-open-arrow" aria-hidden="true">→</span>
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ul>
          {list.slice(0, 8).map((item, index) => (
            <li key={item.work_order_id || item.defect_id || item.maintenance_id || item.plan_id || index}>
              {render(item)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
