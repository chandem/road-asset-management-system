import { useEffect, useMemo, useState } from "react";
import {
  getRoadInspections,
  getRoadMaintenance,
  getWorkOrderExecution,
  getWorkOrderVerification,
  getWorkOrders,
} from "./api";

export default function SectionDetails({ section, defects = [], onClose }) {
  const [inspections, setInspections] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [executionByOrder, setExecutionByOrder] = useState({});
  const [verificationByOrder, setVerificationByOrder] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const props = section?.properties || {};
  const sectionId = Number(props.section_id);
  const roadId = Number(props.road_id);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!sectionId || !roadId) return;
      setLoading(true);
      setMessage("");
      try {
        const [inspectionData, maintenanceData, allOrders] = await Promise.all([
          getRoadInspections(roadId),
          getRoadMaintenance(roadId),
          getWorkOrders(),
        ]);
        if (cancelled) return;
        const sectionInspections = (inspectionData || []).filter((item) => Number(item.section_id) === sectionId);
        const sectionMaintenance = (maintenanceData || []).filter((item) => Number(item.section_id) === sectionId);
        const maintenanceIds = new Set(sectionMaintenance.map((item) => Number(item.maintenance_id)));
        const sectionOrders = (allOrders || []).filter((item) => maintenanceIds.has(Number(item.maintenance_id)));
        setInspections(sectionInspections);
        setMaintenance(sectionMaintenance);
        setWorkOrders(sectionOrders);

        const pairs = await Promise.all(sectionOrders.map(async (order) => {
          const [execution, verification] = await Promise.all([
            getWorkOrderExecution(order.work_order_id).catch(() => null),
            getWorkOrderVerification(order.work_order_id).catch(() => null),
          ]);
          return [order.work_order_id, execution, verification];
        }));
        if (cancelled) return;
        setExecutionByOrder(Object.fromEntries(pairs.map(([id, execution]) => [id, execution])));
        setVerificationByOrder(Object.fromEntries(pairs.map(([id, , verification]) => [id, verification])));
      } catch (error) {
        if (!cancelled) setMessage(error.message || String(error));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [sectionId, roadId]);

  const severityCounts = useMemo(() => defects.reduce((counts, defect) => {
    const severity = String(defect?.properties?.severity || "unknown").toLowerCase();
    counts[severity] = (counts[severity] || 0) + 1;
    return counts;
  }, {}), [defects]);

  if (!section) return null;

  return (
    <section className="action-panel gis-section-details" aria-label="Road section details">
      <div className="panel-heading">
        <div>
          <h2>{props.section_code || `Section ${sectionId}`}</h2>
          <p>Integrated GIS record: inspections, defects, maintenance, work orders, execution and verification.</p>
        </div>
        <button type="button" onClick={onClose}>Close</button>
      </div>

      {loading && <p>Loading section records…</p>}
      {message && <p className="form-message">{message}</p>}

      <div className="summary-grid">
        <div><strong>Condition</strong><span>{Number.isFinite(Number(props.condition_rating)) ? Number(props.condition_rating).toFixed(1) : "Not rated"}</span></div>
        <div><strong>Category</strong><span>{props.condition_rating == null ? "Not rated" : Number(props.condition_rating) >= 85 ? "Excellent" : Number(props.condition_rating) >= 70 ? "Good" : Number(props.condition_rating) >= 50 ? "Fair" : Number(props.condition_rating) >= 30 ? "Poor" : "Critical"}</span></div>
        <div><strong>Inspections</strong><span>{inspections.length}</span></div>
        <div><strong>Defects</strong><span>{defects.length}</span></div>
        <div><strong>Maintenance</strong><span>{maintenance.length}</span></div>
        <div><strong>Work orders</strong><span>{workOrders.length}</span></div>
        <div><strong>Verified</strong><span>{Object.values(verificationByOrder).filter(Boolean).length}</span></div>
      </div>

      <div className="table-wrap">
        <h3>Defects</h3>
        {defects.length ? <table><thead><tr><th>Type</th><th>Severity</th><th>Chainage</th><th>Description</th></tr></thead><tbody>
          {defects.map((defect, index) => {
            const d = defect.properties || {};
            return <tr key={d.defect_id || index}><td>{d.defect_type || "—"}</td><td>{d.severity || "—"}</td><td>{d.chainage_km ?? "—"}</td><td>{d.description || "—"}</td></tr>;
          })}
        </tbody></table> : <p>No defects recorded for this section.</p>}
        {defects.length > 0 && <small>Severity: {Object.entries(severityCounts).map(([key, value]) => `${key}: ${value}`).join(" · ")}</small>}
      </div>

      <div className="table-wrap">
        <h3>Inspections</h3>
        {inspections.length ? <table><thead><tr><th>Date</th><th>Condition</th><th>Weather</th><th>Notes</th></tr></thead><tbody>
          {inspections.map((item) => <tr key={item.inspection_id}><td>{item.inspection_date}</td><td>{item.condition_rating ?? "—"}</td><td>{item.weather || "—"}</td><td>{item.notes || "—"}</td></tr>)}
        </tbody></table> : <p>No inspections recorded for this section.</p>}
      </div>

      <div className="table-wrap">
        <h3>Maintenance & work orders</h3>
        {maintenance.length ? <table><thead><tr><th>Activity</th><th>Priority</th><th>Status</th><th>Cost</th><th>Work order</th><th>Execution</th><th>Verification</th></tr></thead><tbody>
          {maintenance.map((item) => {
            const order = workOrders.find((wo) => Number(wo.maintenance_id) === Number(item.maintenance_id));
            const execution = order ? executionByOrder[order.work_order_id] : null;
            const verification = order ? verificationByOrder[order.work_order_id] : null;
            return <tr key={item.maintenance_id}>
              <td>{item.activity_type || item.maintenance_id}</td>
              <td>{item.priority || "—"}</td>
              <td>{item.status || "—"}</td>
              <td>{item.actual_cost ?? item.estimated_cost ?? "—"}</td>
              <td>{order ? `${order.order_number} · ${order.status}` : "Not created"}</td>
              <td>{execution ? (execution.completed_at ? "Completed" : "Started") : "Not recorded"}</td>
              <td>{verification?.result || "Not verified"}</td>
            </tr>;
          })}
        </tbody></table> : <p>No maintenance activities recorded for this section.</p>}
      </div>
    </section>
  );
}
