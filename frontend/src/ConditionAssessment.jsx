import { useEffect, useMemo, useState } from "react";
import {
  createMaintenanceFromConditionAssessment,
  getRoadConditionAssessment,
  getRoads,
} from "./api";

function categoryClass(category = "") {
  const value = String(category).toLowerCase();
  if (value.includes("critical") || value.includes("very poor")) return "condition-critical";
  if (value.includes("poor")) return "condition-poor";
  if (value.includes("fair")) return "condition-fair";
  if (value.includes("good") || value.includes("excellent")) return "condition-good";
  return "condition-neutral";
}

function priorityClass(priority = "") {
  const value = String(priority).toLowerCase();
  if (value.includes("critical") || value.includes("high") || value.includes("urgent")) return "priority-high";
  if (value.includes("medium") || value.includes("moderate")) return "priority-medium";
  return "priority-low";
}

export default function ConditionAssessment() {
  const [roads, setRoads] = useState([]);
  const [roadId, setRoadId] = useState("");
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [loadingRoads, setLoadingRoads] = useState(true);
  const [assessing, setAssessing] = useState(false);
  const [creatingSection, setCreatingSection] = useState(null);
  const [created, setCreated] = useState({});
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    setLoadingRoads(true);
    getRoads()
      .then(setRoads)
      .catch((err) => setError(err.message || "Could not load roads"))
      .finally(() => setLoadingRoads(false));
  }, []);

  async function assess() {
    if (!roadId) return;
    setError("");
    setCreated({});
    setAssessing(true);
    try {
      setReport(await getRoadConditionAssessment(Number(roadId)));
    } catch (err) {
      setReport(null);
      setError(err.message || "Condition assessment failed");
    } finally {
      setAssessing(false);
    }
  }

  async function createRecommendation(sectionId) {
    setCreatingSection(sectionId);
    setError("");
    try {
      const activity = await createMaintenanceFromConditionAssessment(sectionId);
      setCreated((current) => ({ ...current, [sectionId]: activity.maintenance_id }));
    } catch (err) {
      setError(err.message || "Could not create maintenance");
    } finally {
      setCreatingSection(null);
    }
  }

  const items = report?.items || [];

  const stats = useMemo(() => {
    const counts = { good: 0, fair: 0, poor: 0, critical: 0 };
    items.forEach((item) => {
      const value = String(item?.category || "").toLowerCase();
      if (value.includes("critical") || value.includes("very poor")) counts.critical += 1;
      else if (value.includes("poor")) counts.poor += 1;
      else if (value.includes("fair")) counts.fair += 1;
      else if (value.includes("good") || value.includes("excellent")) counts.good += 1;
    });
    return counts;
  }, [items]);

  const filteredItems = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((item) => {
      const value = String(item?.category || "").toLowerCase();
      if (filter === "critical") return value.includes("critical") || value.includes("very poor");
      if (filter === "poor") return value.includes("poor") && !value.includes("very poor");
      if (filter === "fair") return value.includes("fair");
      if (filter === "good") return value.includes("good") || value.includes("excellent");
      return true;
    });
  }, [items, filter]);

  return (
    <section className="condition-page">
      <div className="condition-hero">
        <div>
          <span className="eyebrow">INSIGHTS</span>
          <h2>Road Condition Assessment</h2>
          <p>
            Assess section condition, identify maintenance priorities, and turn findings
            into actionable maintenance activities.
          </p>
        </div>
        <div className="condition-hero-mark" aria-hidden="true">CI</div>
      </div>

      <div className="condition-selector panel">
        <div className="condition-selector-copy">
          <strong>Select a road to assess</strong>
          <span>Condition scores and maintenance priorities are calculated for its sections.</span>
        </div>
        <div className="condition-selector-actions">
          <select
            aria-label="Select road"
            value={roadId}
            onChange={(e) => setRoadId(e.target.value)}
            disabled={loadingRoads || assessing}
          >
            <option value="">
              {loadingRoads ? "Loading roads…" : "Select road"}
            </option>
            {roads.map((road) => (
              <option key={road.road_id} value={road.road_id}>
                {road.road_code} — {road.road_name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="condition-primary-action"
            onClick={assess}
            disabled={!roadId || assessing}
          >
            {assessing ? "Assessing…" : "Assess road"}
          </button>
        </div>
      </div>

      {error && <div className="condition-error">{error}</div>}

      {!report && !assessing && !error && (
        <div className="condition-empty panel">
          <div className="condition-empty-icon" aria-hidden="true">✓</div>
          <h3>Condition insights will appear here</h3>
          <p>
            Choose a road above and select <strong>Assess road</strong> to see its
            section condition, priority, recommendations, and maintenance actions.
          </p>
        </div>
      )}

      {assessing && (
        <div className="condition-loading panel">
          <div className="condition-spinner" aria-hidden="true" />
          <div>
            <strong>Assessing road condition…</strong>
            <span>Calculating section scores and maintenance priorities.</span>
          </div>
        </div>
      )}

      {report && !assessing && (
        <>
          <div className="condition-summary-grid">
            <div className="condition-summary-card condition-summary-primary">
              <span>Average condition</span>
              <strong>{report.average_score ?? "—"}</strong>
              <small>out of 100</small>
            </div>
            <div className="condition-summary-card">
              <span>Sections assessed</span>
              <strong>{report.section_count ?? items.length}</strong>
              <small>road sections</small>
            </div>
            <div className="condition-summary-card">
              <span>Needs attention</span>
              <strong>{stats.poor + stats.critical}</strong>
              <small>poor or critical sections</small>
            </div>
            <div className="condition-summary-card">
              <span>Priority actions</span>
              <strong>{items.filter((item) => {
                const value = String(item?.priority || "").toLowerCase();
                return value.includes("critical") || value.includes("high") || value.includes("urgent");
              }).length}</strong>
              <small>high-priority sections</small>
            </div>
          </div>

          <div className="condition-distribution panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">PORTFOLIO VIEW</span>
                <h3>Condition distribution</h3>
              </div>
              <span className="condition-total">{items.length} sections</span>
            </div>
            <div className="condition-bars">
              {[
                ["good", "Good", stats.good],
                ["fair", "Fair", stats.fair],
                ["poor", "Poor", stats.poor],
                ["critical", "Critical", stats.critical],
              ].map(([key, label, count]) => (
                <button
                  type="button"
                  key={key}
                  className={`condition-bar-row ${filter === key ? "selected" : ""}`}
                  onClick={() => setFilter(filter === key ? "all" : key)}
                >
                  <span className="condition-bar-label">{label}</span>
                  <span className="condition-bar-track">
                    <span
                      className={`condition-bar-fill ${key}`}
                      style={{ width: `${items.length ? (count / items.length) * 100 : 0}%` }}
                    />
                  </span>
                  <strong>{count}</strong>
                </button>
              ))}
            </div>
          </div>

          <div className="condition-table-panel panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">SECTION DETAIL</span>
                <h3>Condition & maintenance priorities</h3>
              </div>
              <button
                type="button"
                className="condition-filter-button"
                onClick={() => setFilter("all")}
                disabled={filter === "all"}
              >
                {filter === "all" ? "All sections" : `Showing ${filter}`}
              </button>
            </div>

            {filteredItems.length === 0 ? (
              <div className="condition-table-empty">
                No sections match this condition filter.
              </div>
            ) : (
              <div className="table-wrap condition-table-wrap">
                <table className="condition-table">
                  <thead>
                    <tr>
                      <th>Section</th>
                      <th>Chainage</th>
                      <th>Score</th>
                      <th>Condition</th>
                      <th>Priority</th>
                      <th>Recommendation</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => (
                      <tr key={item.section_id}>
                        <td><strong>{item.section_code}</strong></td>
                        <td>{item.start_chainage}–{item.end_chainage}</td>
                        <td><strong>{item.score}</strong></td>
                        <td>
                          <span className={`condition-badge ${categoryClass(item.category)}`}>
                            {item.category || "Unknown"}
                          </span>
                        </td>
                        <td>
                          <span className={`priority-badge ${priorityClass(item.priority)}`}>
                            {item.priority || "Normal"}
                          </span>
                        </td>
                        <td>{item.recommendation || "No recommendation"}</td>
                        <td>
                          {created[item.section_id] ? (
                            <span className="maintenance-created">
                              ✓ Created #{created[item.section_id]}
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="condition-action-button"
                              onClick={() => createRecommendation(item.section_id)}
                              disabled={creatingSection === item.section_id}
                            >
                              {creatingSection === item.section_id ? "Creating…" : "Create maintenance"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
