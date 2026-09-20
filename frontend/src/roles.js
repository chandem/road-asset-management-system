/** Role → tab access rules (keep in sync with backend require_roles intent). */

export const TAB_ROLES = {
  overview: ["admin", "engineer", "inspector", "field_staff"],
  map: ["admin", "engineer", "inspector", "field_staff"],
  field: ["admin", "engineer", "inspector", "field_staff"],
  workflow: ["admin", "engineer", "inspector", "field_staff"],
  roads: ["admin", "engineer"],
  maintenance: ["admin", "engineer"],
  planning: ["admin", "engineer"],
  workorders: ["admin", "engineer"],
  assets: ["admin", "engineer", "inspector"],
  condition: ["admin", "engineer", "inspector"],
  analytics: ["admin", "engineer"],
  effectiveness: ["admin", "engineer"],
  decision: ["admin", "engineer"],
  reports: ["admin", "engineer"],
  audit: ["admin", "engineer"],
};

export const ALL_NAV_GROUPS = [
  {
    id: "home",
    label: "Home",
    tabs: [
      { id: "overview", label: "Overview" },
      { id: "map", label: "Map" },
    ],
  },
  {
    id: "field",
    label: "Field",
    tabs: [
      { id: "field", label: "Capture" },
      { id: "workflow", label: "Workflow" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    tabs: [
      { id: "roads", label: "Roads" },
      { id: "maintenance", label: "Activities" },
      { id: "planning", label: "Planning" },
      { id: "workorders", label: "Work orders" },
      { id: "assets", label: "Assets" },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    tabs: [
      { id: "condition", label: "Condition" },
      { id: "analytics", label: "Analytics" },
      { id: "effectiveness", label: "Effectiveness" },
      { id: "decision", label: "Decision support" },
      { id: "reports", label: "Reports" },
      { id: "audit", label: "Audit" },
    ],
  },
];

export function normalizeRole(role) {
  return String(role || "inspector").toLowerCase();
}

export function canAccessTab(tabId, role) {
  const r = normalizeRole(role);
  return (TAB_ROLES[tabId] || ["admin"]).includes(r);
}

export function filterNavGroups(role) {
  return ALL_NAV_GROUPS
    .map((group) => ({
      ...group,
      tabs: group.tabs.filter((t) => canAccessTab(t.id, role)),
    }))
    .filter((group) => group.tabs.length > 0);
}
