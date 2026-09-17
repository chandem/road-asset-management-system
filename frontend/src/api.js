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
    const detail = await response.text();
    throw new Error(detail || `API request failed: ${response.status}`);
  }
  return response.status === 204 ? null : response.json();
}

export function getRoads() { return request("/roads"); }
export function getRoadGeoJSON() { return request("/roads/geojson"); }
export function getGPSTrackGeoJSON() { return request("/gps-tracks/geojson"); }
export function getGPSMatch(latitude, longitude, maxDistanceM = 100) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    max_distance_m: String(maxDistanceM),
  });
  return request(`/gps/match?${params.toString()}`);
}
export function getRoadSectionGeoJSON(roadId) { return request(`/roads/${roadId}/sections/geojson`); }
export function getRoadAssetGeoJSON(roadId) { return request(`/roads/${roadId}/assets/geojson`); }
export function getDefectGeoJSON() { return request("/defects/geojson"); }
export function getRoadSections(roadId) { return request(`/roads/${roadId}/sections`); }
export function getChainagePoints(sectionId) { return request(`/sections/${sectionId}/chainage-points`); }
export function getRoadInspections(roadId) { return request(`/roads/${roadId}/inspections`); }
export function getInspection(inspectionId) { return request(`/inspections/${inspectionId}`); }
export function getInspectionWorkflow(inspectionId) { return request(`/inspections/${inspectionId}/workflow`); }
export function getRoadMaintenance(roadId) { return request(`/roads/${roadId}/maintenance`); }
export function getMaintenance(maintenanceId) { return request(`/maintenance/${maintenanceId}`); }
export function getMaintenanceHistory(maintenanceId) { return request(`/maintenance/${maintenanceId}/history`); }
export function getDefectMaintenance(defectId) { return request(`/defects/${defectId}/maintenance`); }
export function createMaintenance(roadId, payload) {
  return request(`/roads/${roadId}/maintenance`, { method: "POST", body: JSON.stringify(payload) });
}
export function updateMaintenance(maintenanceId, payload) {
  return request(`/maintenance/${maintenanceId}`, { method: "PATCH", body: JSON.stringify(payload) });
}
export function createInspection(sectionId, payload) {
  return request(`/sections/${sectionId}/inspections`, { method: "POST", body: JSON.stringify(payload) });
}
export function createDefect(inspectionId, payload) {
  return request(`/inspections/${inspectionId}/defects`, { method: "POST", body: JSON.stringify(payload) });
}

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

export function runAIDetection(imageId) {
  return request(`/images/${imageId}/ai-detect`, { method: "POST" });
}

export function getAIDetections(imageId) {
  return request(`/images/${imageId}/ai-detections`);
}

export { API_BASE };
