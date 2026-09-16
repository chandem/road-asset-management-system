const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

async function request(path) {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  return response.json();
}

export function getRoads() {
  return request("/roads");
}

export function getRoadGeoJSON() {
  return request("/roads/geojson");
}

export function getGPSTrackGeoJSON() {
  return request("/gps-tracks/geojson");
}

export { API_BASE };
