/**
 * Empty / zero-data guidance for overview and registers.
 * Fills the content area so pages do not look broken on mobile.
 */
export default function EmptyState({
  title = "Nothing here yet",
  children,
  actions = [],
  tone = "info",
  icon = "◇",
}) {
  return (
    <div className={`empty-state-card empty-state-${tone}`} role="status">
      <div className="empty-state-icon" aria-hidden="true">{icon}</div>
      <div className="empty-state-body">
        <h3 className="empty-state-title">{title}</h3>
        {children ? <div className="empty-state-copy">{children}</div> : null}
      </div>
      {actions.length > 0 && (
        <div className="empty-state-actions" aria-label="Suggested actions">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={action.primary ? "primary" : undefined}
              onClick={action.onClick}
              disabled={action.disabled}
              aria-label={action.ariaLabel || action.label}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
