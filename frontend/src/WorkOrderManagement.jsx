import { useEffect, useMemo, useState } from "react";
import {
  createWorkOrder,
  getMaintenanceWorkOrders,
  getRoadMaintenance,
  getRoads,
  getWorkOrders,
  updateWorkOrder,
} from "./api";

const STATUSES = ["draft", "issued", "in progress", "completed", "cancelled"];

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function WorkOrderManagement() {
  const [roads, setRoads] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [roadFilter, setRoadFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    maintenance_id: "",
    order_number: "",
    issue_date: today(),
    due_date: "",
    status: "draft",
    assigned_to: "",
    instructions: "",
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [roadData, orderData] = await Promise.all([getRoads(), getWorkOrders()]);
      const maintenanceData = (await Promise.all(roadData.map((road) => getRoadMaintenance(road.road_id)))).flat();
      setRoads(roadData);
      setMaintenance(maintenanceData);
      setWorkOrders(orderData);
    } catch (error) {
      setMessage(`Work-order load error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const roadById = useMemo(
    () => new Map(roads.map((road) => [Number(road.road_id), road])),
    [roads],
  );
  const maintenanceById = useMemo(
    () => new Map(maintenance.map((activity) => [Number(activity.maintenance_id), activity])),
    [maintenance],
  );

  const filteredOrders = useMemo(() => workOrders.filter((order) => {
    const activity = maintenanceById.get(Number(order.maintenance_id));
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    const matchesRoad = roadFilter === "all" || Number(activity?.road_id) === Number(roadFilter);
    return matchesStatus && matchesRoad;
  }), [workOrders, maintenanceById, statusFilter, roadFilter]);

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

  async function changeStatus(order, status) {
    try {
      await updateWorkOrder(order.work_order_id, { status });
      setMessage(`Work order ${order.order_number} is now ${status}.`);
      await load();
    } catch (error) {
      setMessage(`Status update error: ${error.message}`);
    }
  }

  async function assign(order) {
    const assignedTo = window.prompt("Assign to contractor/person", order.assigned_to || "");
    if (assignedTo === null) return;
    try {
      await updateWorkOrder(order.work_order_id, { assigned_to: assignedTo.trim() || null });
      setMessage("Assignment updated.");
      await load();
    } catch (error) {
      setMessage(`Assignment error: ${error.message}`);
    }
  }

  const availableMaintenance = maintenance.filter((activity) =>
    !workOrders.some((order) => Number(order.maintenance_id) === Number(activity.maintenance_id))
    && (roadFilter === "all" || Number(activity.road_id) === Number(roadFilter))
    && activity.status !== "cancelled",
  );

  return (
    <section className="action-panel work-order-management">
      <div className="panel-heading">
        <div>
          <h2>Work Order Management</h2>
          <p>Create, assign, issue, track, and complete maintenance work orders.</p>
        </div>
        <button type="button" onClick={openCreate}>Create Work Order</button>
      </div>

      <div className="planning-selector">
        <label>Road
          <select value={roadFilter} onChange={(e) => setRoadFilter(e.target.value)}>
            <option value="all">All roads</option>
            {roads.map((road) => <option key={road.road_id} value={road.road_id}>{road.road_name || road.road_code}</option>)}
          </select>
        </label>
        <label>Status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
      </div>

      {showForm && (
        <form className="form-grid" onSubmit={submitCreate}>
          <label>Maintenance activity
            <select value={form.maintenance_id} onChange={(e) => setForm({ ...form, maintenance_id: e.target.value })} required>
              <option value="">Select maintenance activity</option>
              {availableMaintenance.map((activity) => <option key={activity.maintenance_id} value={activity.maintenance_id}>{activity.maintenance_id} — {activity.activity_type}</option>)}
            </select>
          </label>
          <label>Order number<input value={form.order_number} onChange={(e) => setForm({ ...form, order_number: e.target.value })} required /></label>
          <label>Issue date<input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} required /></label>
          <label>Due date<input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></label>
          <label>Assign to<input value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} placeholder="Contractor or responsible person" /></label>
          <label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
          <label className="full-width">Instructions<textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} rows="3" /></label>
          <button type="submit">Create</button>
          <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
        </form>
      )}

      {loading ? <p>Loading work orders…</p> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Order</th><th>Maintenance</th><th>Road</th><th>Priority</th><th>Issue</th><th>Due</th><th>Assigned</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {filteredOrders.map((order) => {
                const activity = maintenanceById.get(Number(order.maintenance_id));
                const road = roadById.get(Number(activity?.road_id));
                return (
                  <tr key={order.work_order_id}>
                    <td>{order.order_number}</td>
                    <td>{activity?.activity_type || order.maintenance_id}</td>
                    <td>{road?.road_name || activity?.road_id || "—"}</td>
                    <td>{activity?.priority || "—"}</td>
                    <td>{order.issue_date}</td>
                    <td>{order.due_date || "—"}</td>
                    <td>{order.assigned_to || "—"}</td>
                    <td><select value={order.status} onChange={(e) => changeStatus(order, e.target.value)}>{STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></td>
                    <td><button type="button" onClick={() => { setSelectedId(order.work_order_id); assign(order); }}>Assign</button></td>
                  </tr>
                );
              })}
              {!filteredOrders.length && <tr><td colSpan="9">No work orders match the selected filters.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {selectedId && <button type="button" onClick={() => setSelectedId(null)}>Close selection</button>}
      {message && <p className="form-message">{message}</p>}
    </section>
  );
}
