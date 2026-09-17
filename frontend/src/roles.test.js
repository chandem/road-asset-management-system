import { describe, expect, it } from "vitest";
import { canAccessTab, filterNavGroups, normalizeRole } from "./roles";

describe("roles", () => {
  it("normalizes role strings", () => {
    expect(normalizeRole("Admin")).toBe("admin");
    expect(normalizeRole(undefined)).toBe("inspector");
  });

  it("allows field staff only field-oriented tabs", () => {
    expect(canAccessTab("field", "field_staff")).toBe(true);
    expect(canAccessTab("workflow", "field_staff")).toBe(true);
    expect(canAccessTab("maintenance", "field_staff")).toBe(false);
    expect(canAccessTab("reports", "field_staff")).toBe(false);
  });

  it("lets inspectors see condition but not operations", () => {
    expect(canAccessTab("condition", "inspector")).toBe(true);
    expect(canAccessTab("planning", "inspector")).toBe(false);
    expect(canAccessTab("workorders", "inspector")).toBe(false);
  });

  it("gives engineers full operations and insights", () => {
    expect(canAccessTab("maintenance", "engineer")).toBe(true);
    expect(canAccessTab("reports", "engineer")).toBe(true);
    expect(canAccessTab("decision", "engineer")).toBe(true);
  });

  it("filters nav groups for field_staff", () => {
    const groups = filterNavGroups("field_staff");
    const ids = groups.map((g) => g.id);
    expect(ids).toContain("home");
    expect(ids).toContain("field");
    expect(ids).not.toContain("operations");
    expect(ids).not.toContain("insights");
  });

  it("filters insights for inspector to condition only", () => {
    const groups = filterNavGroups("inspector");
    const insights = groups.find((g) => g.id === "insights");
    expect(insights).toBeTruthy();
    expect(insights.tabs.map((t) => t.id)).toEqual(["condition"]);
  });
});
