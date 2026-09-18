import { getToken } from "./auth";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const token = getToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    let message = text || `API request failed: ${response.status}`;
    try {
      const body = JSON.parse(text);
      if (body?.error?.message) message = body.error.message;
      else if (typeof body?.detail === "string") message = body.detail;
      else if (Array.isArray(body?.detail)) {
        message = body.detail
          .map((d) => d.msg || d.message || JSON.stringify(d))
          .join("; ");
      }
    } catch (_) {
      /* keep text message */
    }
    throw new Error(message);
  }
  return response.status === 204 ? null : response.json();
}

export function getRoads() { return request("/roads"); }
export function getDashboardSummary() { return request("/dashboard/summary"); }
export function getDashboardAttention() { return request("/dashboard/attention"); }
export function getRoadGeoJSON() { return request("/roads/geojson"); }
export function getGPSTrackGeoJSON() { return request("/gps-tracks/geojson"); }
export function getGPSMatch(latitude, longitude, maxDistanceM = 100) {
  const params = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), max_distance_m: String(maxDistanceM) });
  return request(`/gps/match?${params.toString()}`);
}
export function getRoadSectionGeoJSON(roadId) { return request(`/roads/${roadId}/sections/geojson`); }
export function getRoadAssetGeoJSON(roadId) { return request(`/roads/${roadId}/assets/geojson`); }
export function listAssets(params = {}) {
  const q = new URLSearchParams();
  if (params.road_id) q.set("road_id", params.road_id);
  if (params.asset_type) q.set("asset_type", params.asset_type);
  const qs = q.toString();
  return request(`/assets${qs ? `?${qs}` : ""}`);
}
export function getRoadAssets(roadId) { return request(`/roads/${roadId}/assets`); }
export function getAsset(assetId) { return request(`/assets/${assetId}`); }
export function createRoadAsset(roadId, payload) {
  return request(`/roads/${roadId}/assets`, { method: "POST", body: JSON.stringify(payload) });
}
export function getDefectGeoJSON() { return request("/defects/geojson"); }
export function getRoadSections(roadId) { return request(`/roads/${roadId}/sections`); }
export function getChainagePoints(sectionId) { return request(`/sections/${sectionId}/chainage-points`); }
export function getRoadInspections(roadId) { return request(`/roads/${roadId}/inspections`); }
export function getInspection(inspectionId) { return request(`/inspections/${inspectionId}`); }
export function getInspectionWorkflow(inspectionId) { return request(`/inspections/${inspectionId}/workflow`); }

export function getRoadMaintenance(roadId) { return request(`/roads/${roadId}/maintenance`); }
export function getRoadMaintenanceGeoJSON(roadId) { return request(`/roads/${roadId}/maintenance/geojson`); }
export function getMaintenance(maintenanceId) { return request(`/maintenance/${maintenanceId}`); }
export function getMaintenanceHistory(maintenanceId) { return request(`/maintenance/${maintenanceId}/history`); }
export function getDefectMaintenance(defectId) { return request(`/defects/${defectId}/maintenance`); }
export function createMaintenance(roadId, payload) { return request(`/roads/${roadId}/maintenance`, { method: "POST", body: JSON.stringify(payload) }); }
export function updateMaintenance(maintenanceId, payload) { return request(`/maintenance/${maintenanceId}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export function getRoadMaintenanceEffectiveness(roadId) { return request(`/roads/${roadId}/maintenance-effectiveness`); }
export function getMaintenanceEffectiveness(maintenanceId) { return request(`/maintenance/${maintenanceId}/effectiveness`); }
export function getMaintenanceDecisionSupport(roadId) { return request(`/roads/${roadId}/maintenance-decision-support`); }
export function getMaintenanceStrategy(roadId) {
  const query = roadId ? `?road_id=${roadId}` : "";
  return request(`/maintenance-strategy${query}`);
}

export function getMaintenancePlans() { return request("/maintenance-plans"); }
export function getMaintenancePlan(planId) { return request(`/maintenance-plans/${planId}`); }
export function getMaintenancePlanActivities(planId) { return request(`/maintenance-plans/${planId}/activities`); }
export function getMaintenancePlanSummary(planId) { return request(`/maintenance-plans/${planId}/summary`); }
export function getMaintenancePlanOptimization(planId) { return request(`/maintenance-plans/${planId}/optimization`); }
export function createMaintenancePlan(payload) { return request("/maintenance-plans", { method: "POST", body: JSON.stringify(payload) }); }
export function updateMaintenancePlan(planId, payload) { return request(`/maintenance-plans/${planId}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export function updateMaintenancePlanStatus(planId, payload) { return request(`/maintenance-plans/${planId}/status`, { method: "PATCH", body: JSON.stringify(payload) }); }
export function assignMaintenanceToPlan(planId, maintenanceId) { return request(`/maintenance-plans/${planId}/activities/${maintenanceId}`, { method: "POST" }); }
export function unassignMaintenanceFromPlan(planId, maintenanceId) { return request(`/maintenance-plans/${planId}/activities/${maintenanceId}`, { method: "DELETE" }); }

export function getWorkOrders() { return request("/work-orders"); }
export function getMaintenanceWorkOrders(maintenanceId) { return request(`/maintenance/${maintenanceId}/work-orders`); }
export function getWorkOrder(workOrderId) { return request(`/work-orders/${workOrderId}`); }
export function getWorkOrderHistory(workOrderId) { return request(`/work-orders/${workOrderId}/history`); }
export function createWorkOrder(payload) { return request("/work-orders", { method: "POST", body: JSON.stringify(payload) }); }
export function updateWorkOrder(workOrderId, payload) { return request(`/work-orders/${workOrderId}`, { method: "PATCH", body: JSON.stringify(payload) }); }

export function getMaintenanceReport(params = "") { return request(`/reports/maintenance${params}`); }
export function getRoadConditionReport(params = "") { return request(`/reports/road-condition${params}`); }
export function getDefectReport(params = "") { return request(`/reports/defects${params}`); }
export function getCostReport(params = "") { return request(`/reports/costs${params}`); }
export function getSectionConditionAssessment(sectionId) { return request(`/sections/${sectionId}/condition-assessment`); }
export function getRoadConditionAssessment(roadId) { return request(`/roads/${roadId}/condition-assessment`); }
export function createMaintenanceFromConditionAssessment(sectionId) {
  return request(`/sections/${sectionId}/condition-assessment/maintenance`, { method: "POST" });
}

export function createInspection(sectionId, payload) { return request(`/sections/${sectionId}/inspections`, { method: "POST", body: JSON.stringify(payload) }); }
export function createDefect(inspectionId, payload) { return request(`/inspections/${inspectionId}/defects`, { method: "POST", body: JSON.stringify(payload) }); }
export function createGPSTrack(roadId, payload) { return request(`/roads/${roadId}/gps-tracks`, { method: "POST", body: JSON.stringify(payload) }); }

export function uploadImage({ file, inspectionId, defectId, capturedAt, latitude, longitude }) {
  const formData = new FormData();
  formData.append("file", file);
  if (inspectionId) formData.append("inspection_id", inspectionId);
  if (defectId) formData.append("defect_id", defectId);
  if (capturedAt) formData.append("captured_at", capturedAt);
  if (latitude !== null && latitude !== undefined) formData.append("latitude", latitude);
  if (longitude !== null && longitude !== undefined) formData.append("longitude", longitude);
  return request("/images/upload", { method: "POST", body: formData });
}
export function getAIStatus() { return request("/ai/status"); }
export function runAIDetection(imageId) { return request(`/images/${imageId}/ai-detect`, { method: "POST" }); }
export function getAIDetections(imageId) { return request(`/images/${imageId}/ai-detections`); }
export { API_BASE };

export function getWorkOrderExecution(workOrderId) { return request(`/work-orders/${workOrderId}/execution`); }
export function createWorkOrderExecution(workOrderId, payload) { return request(`/work-orders/${workOrderId}/execution`, { method: "POST", body: JSON.stringify(payload) }); }
export function updateWorkOrderExecution(workOrderId, payload) { return request(`/work-orders/${workOrderId}/execution`, { method: "PATCH", body: JSON.stringify(payload) }); }
