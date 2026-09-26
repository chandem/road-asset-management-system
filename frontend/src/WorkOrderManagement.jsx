import { useEffect, useMemo, useState } from "react";
import {
  createWorkOrder,
  getRoadMaintenance,
  getRoads,
  getWorkOrderHistory,
  getWorkOrders,
  updateWorkOrder,
  getWorkOrderExecution,
  createWorkOrderExecution,
  updateWorkOrderExecution,
  getWorkOrderVerification,
  createWorkOrderVerification,
} from "./api";
import EmptyState from "./components/EmptyState";

const STATUSES = ["draft", "issued", "in progress", "completed", "closed", "cancelled"];
const TRANSITIONS = {
  draft: ["issued", "cancelled"],
  issued: ["in progress", "cancelled"],
  "in progress": ["completed", "cancelled"],
  completed: ["closed", "in progress"],
  closed: [],
  cancelled: [],
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function statusClass(status = "") {
  const s = String(status).toLowerCase();
  if (s === "completed" || s === "closed") return "status-ok";
  if (s === "cancelled") return "status-bad";
  if (s === "in progress" || s === "issued") return "status-warn";
  return "status-neutral";
}

export default function WorkOrderManagement() {
  const [roads, setRoads] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [execution, setExecution] = useState(null);
  const [verification, setVerification] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [roadFilter, setRoadFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [assignOrderId, setAssignOrderId] = useState(null);
  const [assignValue, setAssignValue] = useState("");
  const [form, setForm] = useState({
    maintenance_id: "",
    order_number: "",
    issue_date: today(),
    due_date: "",
    status: "draft",
    assigned_to: "",
    instructions: "",
  });

  async function load() {
    setLoading(true);
    try {
      const [roadData, orderData] = await Promise.all([getRoads(), getWorkOrders()]);
      const maintenanceData = (
        await Promise.all(roadData.map((road) => getRoadMaintenance(road.road_id)))
      ).flat();
      setRoads(roadData);
      setMaintenance(maintenanceData);
      setWorkOrders(orderData);
    } catch (error) {
      setMessage(`Work-order load error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const roadById = useMemo(
    () => new Map(roads.map((road) => [Number(road.road_id), road])),
    [roads],
  );
  const maintenanceById = useMemo(
    () => new Map(maintenance.map((activity) => [Number(activity.maintenance_id), activity])),
    [maintenance],
  );

  const filteredOrders = useMemo(
    () =>
      workOrders.filter((order) => {
        const activity = maintenanceById.get(Number(order.maintenance_id));
        return (
          (statusFilter === "all" || order.status === statusFilter) &&
          (roadFilter === "all" || Number(activity?.road_id) === Number(roadFilter))
        );
      }),
    [workOrders, maintenanceById, statusFilter, roadFilter],
  );

  const availableMaintenance = maintenance.filter(
    (activity) =>
      !workOrders.some(
        (order) => Number(order.maintenance_id) === Number(activity.maintenance_id),
      ) && activity.status !== "cancelled",
  );

  const stats = useMemo(() => {
    const counts = { total: workOrders.length, open: 0, inProgress: 0, completed: 0, cancelled: 0 };
    for (const order of workOrders) {
      const s = String(order.status).toLowerCase();
      if (s === "draft" || s === "issued") counts.open += 1;
      else if (s === "in progress") counts.inProgress += 1;
      else if (s === "completed" || s === "closed") counts.completed += 1;
      else if (s === "cancelled") counts.cancelled += 1;
    }
    return counts;
  }, [workOrders]);

  function openCreate() {
    setForm({
      maintenance_id: "",
      order_number: `WO-${new Date().getFullYear()}-${String(workOrders.length + 1).padStart(4, "0")}`,
      issue_date: today(),
      due_date: "",
      status: "draft",
      assigned_to: "",
      instructions: "",
    });
    setShowForm(true);
    setMessage("");
  }

  async function submitCreate(event) {
    event.preventDefault();
    try {
      await createWorkOrder({
        maintenance_id: Number(form.maintenance_id),
        order_number: form.order_number,
        issue_date: form.issue_date,
        due_date: form.due_date || null,
        status: form.status,
        assigned_to: form.assigned_to || null,
        instructions: form.instructions || null,
      });
      setShowForm(false);
      setMessage("Work order created.");
      await load();
    } catch (error) {
      setMessage(`Create work order error: ${error.message}`);
    }
  }

  async function loadHistory(id) {
    try {
      setHistory(await getWorkOrderHistory(id));
    } catch (error) {
      setMessage(`History error: ${error.message}`);
    }
  }

  async function changeStatus(order, status) {
    if (status === order.status) return;
    if (!TRANSITIONS[order.status]?.includes(status)) {
      setMessage(`Invalid lifecycle transition: ${order.status} → ${status}`);
      return;
    }
    if (status === "cancelled" || status === "closed") {
      const ok = window.confirm(
        `Mark work order ${order.order_number} as "${status}"? This is an important lifecycle change.`,
      );
      if (!ok) return;
    }
    try {
      await updateWorkOrder(order.work_order_id, { status });
      setMessage(`Work order ${order.order_number} is now ${status}.`);
      await load();
      if (selectedId === order.work_order_id) await loadHistory(order.work_order_id);
    } catch (error) {
      setMessage(`Status update error: ${error.message}`);
    }
  }

  function startAssign(order) {
    setAssignOrderId(order.work_order_id);
    setAssignValue(order.assigned_to || "");
  }

  async function saveAssign(order) {
    try {
      await updateWorkOrder(order.work_order_id, {
        assigned_to: assignValue.trim() || null,
      });
      setMessage("Assignment updated.");
      setAssignOrderId(null);
      await load();
      if (selectedId === order.work_order_id) await loadHistory(order.work_order_id);
    } catch (error) {
      setMessage(`Assignment error: ${error.message}`);
    }
  }

  async function toggleDetails(id) {
    if (selectedId === id) {
      setSelectedId(null);
      setHistory([]);
      setExecution(null);
      setVerification(null);
      return;
    }
    setSelectedId(id);
    await loadHistory(id);
    try {
      setExecution(await getWorkOrderExecution(id));
      try {
        setVerification(await getWorkOrderVerification(id));
      } catch {
        setVerification(null);
      }
    } catch {
      setExecution(null);
    }
  }

  return (
    <section className="action-panel work-order-management insight-page">
      <div className="insight-hero">
        <div>
          <span className="eyebrow">OPERATIONS</span>
          <h2>Work Order Management</h2>
          <p>Create, assign, issue, track, and audit maintenance work orders.</p>
        </div>
        <button type="button" className="primary" onClick={openCreate}>
          + Create Work Order
        </button>
      </div>

      <div className="insight-kpi-grid compact">
        <div className="insight-kpi">
          <span>Total</span>
          <strong>{loading ? "…" : stats.total}</strong>
          <small>work orders</small>
        </div>
        <div className="insight-kpi">
          <span>Open</span>
          <strong>{loading ? "…" : stats.open}</strong>
          <small>draft / issued</small>
        </div>
        <div className="insight-kpi">
          <span>In progress</span>
          <strong>{loading ? "…" : stats.inProgress}</strong>
          <small>active field work</small>
        </div>
        <div className="insight-kpi">
          <span>Completed</span>
          <strong>{loading ? "…" : stats.completed}</strong>
          <small>done / closed</small>
        </div>
      </div>

      <div className="insight-selector panel">
        <div className="insight-selector-copy">
          <strong>Filters</strong>
          <span>Narrow the list by road and lifecycle status.</span>
        </div>
        <div className="filter-row">
          <label className="insight-select-label">
            Road
            <select value={roadFilter} onChange={(e) => setRoadFilter(e.target.value)}>
              <option value="all">All roads</option>
              {roads.map((road) => (
                <option key={road.road_id} value={road.road_id}>
                  {road.road_name || road.road_code}
                </option>
              ))}
            </select>
          </label>
          <label className="insight-select-label">
            Status
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {showForm && (
        <form className="form-grid panel" onSubmit={submitCreate}>
          <label>
            Maintenance activity
            <select
              value={form.maintenance_id}
              onChange={(e) => setForm({ ...form, maintenance_id: e.target.value })}
              required
            >
              <option value="">Select maintenance activity</option>
              {availableMaintenance.map((a) => (
                <option key={a.maintenance_id} value={a.maintenance_id}>
                  {a.maintenance_id} — {a.activity_type}
                </option>
              ))}
            </select>
          </label>
          <label>
            Order number
            <input
              value={form.order_number}
              onChange={(e) => setForm({ ...form, order_number: e.target.value })}
              required
            />
          </label>
          <label>
            Issue date
            <input
              type="date"
              value={form.issue_date}
              onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
              required
            />
          </label>
          <label>
            Due date
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </label>
          <label>
            Assign to
            <input
              value={form.assigned_to}
              onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
              placeholder="Contractor or responsible person"
            />
          </label>
          <label>
            Status
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="full-width">
            Instructions
            <textarea
              value={form.instructions}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              rows="3"
            />
          </label>
          <div className="form-footer">
            <button type="submit" className="primary">
              Create
            </button>
            <button type="button" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <EmptyState title="Loading work orders…" icon="⟳" tone="info">
          <p>Fetching work orders and linked maintenance activities.</p>
        </EmptyState>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Maintenance</th>
                <th>Road</th>
                <th>Priority</th>
                <th>Issue</th>
                <th>Due</th>
                <th>Assigned</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => {
                const a = maintenanceById.get(Number(order.maintenance_id));
                const road = roadById.get(Number(a?.road_id));
                const isAssigning = assignOrderId === order.work_order_id;
                return (
                  <tr key={order.work_order_id}>
                    <td>
                      <button type="button" className="linkish" onClick={() => toggleDetails(order.work_order_id)}>
                        {order.order_number}
                      </button>
                    </td>
                    <td>{a?.activity_type || order.maintenance_id}</td>
                    <td>{road?.road_name || a?.road_id || "—"}</td>
                    <td>{a?.priority || "—"}</td>
                    <td>{order.issue_date}</td>
                    <td>{order.due_date || "—"}</td>
                    <td>
                      {isAssigning ? (
                        <div className="inline-assign">
                          <input
                            aria-label="Assignee name"
                            value={assignValue}
                            onChange={(e) => setAssignValue(e.target.value)}
                            placeholder="Name"
                          />
                          <button type="button" className="primary" onClick={() => saveAssign(order)}>
                            Save
                          </button>
                          <button type="button" onClick={() => setAssignOrderId(null)}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        order.assigned_to || "—"
                      )}
                    </td>
                    <td>
                      <span className={`status-pill ${statusClass(order.status)}`}>
                        {order.status}
                      </span>
                      <select
                        aria-label={`Change status for ${order.order_number}`}
                        value={order.status}
                        onChange={(e) => changeStatus(order, e.target.value)}
                        disabled={!TRANSITIONS[order.status]?.length}
                        className="status-select"
                      >
                        <option value={order.status}>{order.status}</option>
                        {(TRANSITIONS[order.status] || []).map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button type="button" onClick={() => startAssign(order)}>
                        Assign
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!filteredOrders.length && (
                <tr>
                  <td colSpan="9">No work orders match the selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selectedId && (
        <div className="action-panel insight-detail">
          <h3>Field Execution — #{selectedId}</h3>
          <form
            className="form-grid"
            onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const payload = Object.fromEntries(formData.entries());
              for (const key of [
                "planned_quantity",
                "actual_quantity",
                "actual_cost",
                "gps_latitude",
                "gps_longitude",
              ]) {
                payload[key] = payload[key] === "" ? null : Number(payload[key]);
              }
              for (const key of ["started_at", "completed_at"]) {
                if (payload[key] === "") payload[key] = null;
              }
              try {
                const currentOrder = workOrders.find((order) => order.work_order_id === selectedId);
                if (currentOrder?.status === "issued") {
                  await updateWorkOrder(selectedId, { status: "in progress" });
                }
                const saved = execution
                  ? await updateWorkOrderExecution(selectedId, payload)
                  : await createWorkOrderExecution(selectedId, payload);
                setExecution(saved);
                if (payload.completed_at) {
                  await updateWorkOrder(selectedId, { status: "completed" });
                }
                await load();
                setMessage(
                  payload.completed_at
                    ? "Field execution saved and work order marked completed."
                    : "Field execution saved.",
                );
                await loadHistory(selectedId);
              } catch (error) {
                setMessage(`Execution save error: ${error.message}`);
              }
            }}
          >
            <label>
              Started at
              <input
                name="started_at"
                type="datetime-local"
                defaultValue={execution?.started_at ? execution.started_at.slice(0, 16) : ""}
              />
            </label>
            <label>
              Completed at
              <input
                name="completed_at"
                type="datetime-local"
                defaultValue={execution?.completed_at ? execution.completed_at.slice(0, 16) : ""}
              />
            </label>
            <label>
              Crew
              <input name="crew" defaultValue={execution?.crew || ""} />
            </label>
            <label>
              Equipment
              <input name="equipment" defaultValue={execution?.equipment || ""} />
            </label>
            <label>
              Materials
              <input name="materials" defaultValue={execution?.materials || ""} />
            </label>
            <label>
              Planned quantity
              <input
                name="planned_quantity"
                type="number"
                step="0.001"
                min="0"
                defaultValue={execution?.planned_quantity ?? ""}
              />
            </label>
            <label>
              Actual quantity
              <input
                name="actual_quantity"
                type="number"
                step="0.001"
                min="0"
                defaultValue={execution?.actual_quantity ?? ""}
              />
            </label>
            <label>
              Unit
              <input
                name="quantity_unit"
                defaultValue={execution?.quantity_unit || ""}
                placeholder="m2, m3, km, etc."
              />
            </label>
            <label>
              Actual cost (ETB)
              <input
                name="actual_cost"
                type="number"
                step="0.01"
                min="0"
                defaultValue={execution?.actual_cost ?? ""}
              />
            </label>
            <label>
              GPS latitude
              <input
                name="gps_latitude"
                type="number"
                step="any"
                min="-90"
                max="90"
                defaultValue={execution?.gps_latitude ?? ""}
              />
            </label>
            <label>
              GPS longitude
              <input
                name="gps_longitude"
                type="number"
                step="any"
                min="-180"
                max="180"
                defaultValue={execution?.gps_longitude ?? ""}
              />
            </label>
            <label className="full-width">
              Field notes
              <textarea name="notes" rows="3" defaultValue={execution?.notes || ""} />
            </label>
            <div className="form-footer">
              <button type="submit" className="primary">
                Save Execution
              </button>
            </div>
          </form>

          {workOrders.find((order) => order.work_order_id === selectedId)?.status ===
            "completed" && (
            <>
              <h3>Completion Verification</h3>
              <form
                className="form-grid"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const payload = Object.fromEntries(formData.entries());
                  payload.completed_quantity =
                    payload.completed_quantity === "" ? null : Number(payload.completed_quantity);
                  payload.gps_latitude =
                    payload.gps_latitude === "" ? null : Number(payload.gps_latitude);
                  payload.gps_longitude =
                    payload.gps_longitude === "" ? null : Number(payload.gps_longitude);
                  try {
                    const saved = await createWorkOrderVerification(selectedId, payload);
                    setVerification(saved);
                    await load();
                    await loadHistory(selectedId);
                    setMessage(
                      payload.result === "rejected"
                        ? "Verification rejected; work order returned to in progress."
                        : "Completion verified; work order closed.",
                    );
                  } catch (error) {
                    setMessage(`Verification error: ${error.message}`);
                  }
                }}
              >
                <label>
                  Verified by
                  <input
                    name="verified_by"
                    required
                    defaultValue={verification?.verified_by || ""}
                  />
                </label>
                <label>
                  Result
                  <select name="result" defaultValue={verification?.result || "accepted"}>
                    <option>accepted</option>
                    <option>accepted with observations</option>
                    <option>rejected</option>
                  </select>
                </label>
                <label>
                  Completed quantity
                  <input
                    name="completed_quantity"
                    type="number"
                    step="0.001"
                    min="0"
                    defaultValue={
                      verification?.completed_quantity ?? execution?.actual_quantity ?? ""
                    }
                  />
                </label>
                <label>
                  Final condition
                  <input
                    name="final_condition"
                    defaultValue={verification?.final_condition || ""}
                    placeholder="Excellent, Good, Fair, Poor, Critical"
                  />
                </label>
                <label>
                  GPS latitude
                  <input
                    name="gps_latitude"
                    type="number"
                    step="any"
                    min="-90"
                    max="90"
                    defaultValue={verification?.gps_latitude ?? execution?.gps_latitude ?? ""}
                  />
                </label>
                <label>
                  GPS longitude
                  <input
                    name="gps_longitude"
                    type="number"
                    step="any"
                    min="-180"
                    max="180"
                    defaultValue={verification?.gps_longitude ?? execution?.gps_longitude ?? ""}
                  />
                </label>
                <label className="full-width">
                  Verification remarks
                  <textarea
                    name="remarks"
                    rows="3"
                    defaultValue={verification?.remarks || ""}
                  />
                </label>
                <div className="form-footer">
                  <button type="submit" className="primary" disabled={Boolean(verification)}>
                    Verify Completion
                  </button>
                </div>
              </form>
            </>
          )}

          <h3>Work Order History — #{selectedId}</h3>
          {history.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>User</th>
                    <th>Time</th>
                    <th>Changes</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item.history_id}>
                      <td>{item.action}</td>
                      <td>{item.changed_by ?? "—"}</td>
                      <td>{item.changed_at}</td>
                      <td>
                        <pre className="history-json">
                          {JSON.stringify(item.new_values || {}, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted-note">No history recorded.</p>
          )}
          <div className="form-footer">
            <button
              type="button"
              onClick={() => {
                setSelectedId(null);
                setHistory([]);
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {message && <p className="form-message">{message}</p>}
    </section>
  );
}
