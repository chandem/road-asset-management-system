/**
 * Empty / zero-data guidance for overview and registers.
 */
export default function EmptyState({
  title = "Nothing here yet",
  children,
  actions = [],
  tone = "info",
}) {
  return (
    <div className={`empty-state-card empty-state-${tone}`} role="status">
      <div className="empty-state-body">
        <h3 className="empty-state-title">{title}</h3>
        {children ? <div className="empty-state-copy">{children}</div> : null}
      </div>
      {actions.length > 0 && (
        <div className="empty-state-actions">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={action.primary ? "primary" : undefined}
              onClick={action.onClick}
              disabled={action.disabled}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
