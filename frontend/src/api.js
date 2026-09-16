const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
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
export function getRoadSectionGeoJSON(roadId) { return request(`/roads/${roadId}/sections/geojson`); }
export function getRoadAssetGeoJSON(roadId) { return request(`/roads/${roadId}/assets/geojson`); }
export function getDefectGeoJSON() { return request("/defects/geojson"); }
export function getRoadSections(roadId) { return request(`/roads/${roadId}/sections`); }
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

export { API_BASE };
