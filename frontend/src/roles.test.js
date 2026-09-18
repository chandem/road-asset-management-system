import { describe, expect, it } from "vitest";
import { canAccessTab, filterNavGroups } from "./roles";

describe("roles", () => {
  it("allows field staff field tabs only", () => {
    expect(canAccessTab("overview", "field_staff")).toBe(true);
    expect(canAccessTab("map", "field_staff")).toBe(true);
    expect(canAccessTab("field", "field_staff")).toBe(true);
    expect(canAccessTab("workflow", "field_staff")).toBe(true);
    expect(canAccessTab("maintenance", "field_staff")).toBe(false);
    expect(canAccessTab("reports", "field_staff")).toBe(false);
  });

  it("lets inspectors see condition but not operations", () => {
    expect(canAccessTab("condition", "inspector")).toBe(true);
    expect(canAccessTab("planning", "inspector")).toBe(false);
    expect(canAccessTab("workorders", "inspector")).toBe(false);
    expect(canAccessTab("assets", "inspector")).toBe(true);
    expect(canAccessTab("assets", "field_staff")).toBe(false);
  });

  it("gives engineers full operations and insights", () => {
    expect(canAccessTab("maintenance", "engineer")).toBe(true);
    expect(canAccessTab("reports", "engineer")).toBe(true);
    expect(canAccessTab("decision", "engineer")).toBe(true);
    expect(canAccessTab("assets", "engineer")).toBe(true);
    expect(canAccessTab("audit", "engineer")).toBe(true);
    expect(canAccessTab("audit", "inspector")).toBe(false);
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

  it("includes assets under operations for engineer", () => {
    const groups = filterNavGroups("engineer");
    const ops = groups.find((g) => g.id === "operations");
    expect(ops.tabs.map((t) => t.id)).toContain("assets");
  });

  it("includes audit under insights for engineer", () => {
    const groups = filterNavGroups("engineer");
    const insights = groups.find((g) => g.id === "insights");
    expect(insights.tabs.map((t) => t.id)).toContain("audit");
  });
});
