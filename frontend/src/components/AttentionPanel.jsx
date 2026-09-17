export default function AttentionPanel({ attention, loading, onNavigate }) {
  if (loading && !attention) {
    return (
      <section className="attention-panel">
        <div className="panel-heading">
          <h2>Needs attention</h2>
          <p>Loading operational alerts…</p>
        </div>
      </section>
    );
  }

  const totals = attention?.totals || {};
  const total =
    (totals.overdue_work_orders || 0) +
    (totals.high_severity_defects || 0) +
    (totals.overdue_maintenance || 0) +
    (totals.over_budget_plans || 0);

  if (!loading && total === 0) {
    return (
      <section className="attention-panel attention-ok">
        <div className="panel-heading">
          <h2>Needs attention</h2>
          <p>No overdue work orders, high-severity defects, or over-budget plans right now.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="attention-panel">
      <div className="panel-heading">
        <div>
          <h2>Needs attention</h2>
          <p>
            {total} item{total === 1 ? "" : "s"} as of {attention?.as_of || "—"}
          </p>
        </div>
        <div className="attention-pills">
          <span className="pill warn">{totals.overdue_work_orders || 0} overdue WOs</span>
          <span className="pill danger">{totals.high_severity_defects || 0} high defects</span>
          <span className="pill warn">{totals.overdue_maintenance || 0} overdue maint.</span>
          <span className="pill danger">{totals.over_budget_plans || 0} over budget</span>
        </div>
      </div>

      <div className="attention-grid">
        <AttentionColumn
          title="Overdue work orders"
          empty="None"
          items={attention?.overdue_work_orders}
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
          empty="None"
          items={attention?.high_severity_defects}
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
          empty="None"
          items={attention?.overdue_maintenance}
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
          empty="None"
          items={attention?.over_budget_plans}
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
  const list = items || [];
  return (
    <div className="attention-col">
      <div className="attention-col-head">
        <h3>{title}</h3>
        {onOpen && (
          <button type="button" className="linkish" onClick={onOpen}>
            Open
          </button>
        )}
      </div>
      {list.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ul>
          {list.slice(0, 8).map((item, i) => (
            <li key={item.work_order_id || item.defect_id || item.maintenance_id || item.plan_id || i}>
              {render(item)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
