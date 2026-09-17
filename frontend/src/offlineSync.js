import { createDefect, createInspection, uploadImage } from "./api";
import {
  deleteDefect,
  deleteInspection,
  getDefectMapping,
  getDefects,
  getInspectionMapping,
  getInspections,
  getPhotos,
  putDefectMapping,
  putInspectionMapping,
  deletePhoto,
  putInspection,
  putDefect,
} from "./offlineDb";

const LEGACY_INSPECTION_QUEUE_KEY = "rams.offline.inspection.queue";
const LEGACY_DEFECT_QUEUE_KEY = "rams.offline.defect.queue";
const LEGACY_PHOTO_QUEUE_KEY = "rams.offline.photo.queue";
let activeSync = null;

function readLegacyQueue(key) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : [];
  } catch { return []; }
}

async function migrateLegacyInspections() {
  const legacy = readLegacyQueue(LEGACY_INSPECTION_QUEUE_KEY);
  if (!legacy.length) return;
  for (const item of legacy) {
    const clientId = item.client_id || item.id || `${Date.now()}-${item.section_id}`;
    await putInspection({ ...item, client_id: clientId, synced: false });
  }
  localStorage.removeItem(LEGACY_INSPECTION_QUEUE_KEY);
}

async function migrateLegacyDefects() {
  const legacy = readLegacyQueue(LEGACY_DEFECT_QUEUE_KEY);
  if (!legacy.length) return;
  for (const item of legacy) {
    const clientId = item.client_id || item.id || `${Date.now()}-${item.inspection_client_id || item.inspection_id}`;
    await putDefect({ ...item, client_id: clientId, synced: false });
  }
  localStorage.removeItem(LEGACY_DEFECT_QUEUE_KEY);
}

function dataUrlToFile(dataUrl, fileName, mimeType) {
  const [header, body] = dataUrl.split(",");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const detectedMime = header.match(/data:(.*?);base64/)?.[1] || mimeType || "image/jpeg";
  return new File([bytes], fileName || "road-photo.jpg", { type: detectedMime });
}

export async function syncOfflineQueues() {
  if (activeSync) return activeSync;
  if (!navigator.onLine) {
    const inspections = await getInspections().catch(() => []);
    const defects = await getDefects().catch(() => []);
    const photos = await getPhotos().catch(() => []);
    return {
      inspections: 0,
      defects: 0,
      photos: 0,
      remainingInspections: inspections.filter((x) => !x.synced).length,
      remainingDefects: defects.filter((x) => !x.synced).length,
      remainingPhotos: photos.length,
    };
  }

  activeSync = (async () => {
    await migrateLegacyInspections();
    await migrateLegacyDefects();

    const inspections = (await getInspections()).filter((item) => !item.synced);
    let syncedInspections = 0;
    for (const item of inspections) {
      try {
        const result = await createInspection(item.section_id, {
          inspection_date: item.inspection_date,
          inspector_id: item.inspector_id ?? null,
          client_id: item.client_id,
          condition_rating: item.condition_rating,
          weather: item.weather,
          notes: item.notes,
        });
        await putInspectionMapping(item.client_id, result.inspection_id);
        syncedInspections += 1;
      } catch { /* Keep the record for the next retry. */ }
    }

    const defects = (await getDefects()).filter((item) => !item.synced);
    let syncedDefects = 0;
    for (const item of defects) {
      const inspectionId = item.inspection_client_id
        ? await getInspectionMapping(item.inspection_client_id)
        : item.inspection_id;
      if (!inspectionId) continue;
      try {
        const result = await createDefect(inspectionId, {
          section_id: item.section_id ?? null,
          client_id: item.client_id,
          defect_type: item.defect_type,
          severity: item.severity ?? null,
          chainage_km: item.chainage_km ?? null,
          length_m: item.length_m ?? null,
          width_m: item.width_m ?? null,
          depth_mm: item.depth_mm ?? null,
          description: item.description ?? null,
          detected_by: item.detected_by || "manual",
          geometry_wkt: item.geometry_wkt ?? null,
        });
        await putDefectMapping(item.client_id, result.defect_id);
        syncedDefects += 1;
      } catch { /* Keep the record for the next retry. */ }
    }

    const photos = await getPhotos();
    const failedPhotos = [];
    let syncedPhotos = 0;
    for (const item of photos) {
      const resolvedInspectionId = item.inspection_client_id
        ? await getInspectionMapping(item.inspection_client_id)
        : item.inspection_id;
      const resolvedDefectId = item.defect_client_id
        ? await getDefectMapping(item.defect_client_id)
        : item.defect_id;
      if (item.inspection_client_id && !resolvedInspectionId) { failedPhotos.push(item); continue; }
      if (item.defect_client_id && !resolvedDefectId) { failedPhotos.push(item); continue; }
      try {
        const file = item.file instanceof Blob
          ? new File([item.file], item.file_name || "road-photo.jpg", { type: item.mime_type || item.file.type })
          : dataUrlToFile(item.data_url, item.file_name, item.mime_type);
        await uploadImage({
          file,
          inspectionId: resolvedInspectionId || null,
          defectId: resolvedDefectId || null,
          capturedAt: item.captured_at,
          latitude: item.latitude,
          longitude: item.longitude,
        });
        await deletePhoto(item.id);
        syncedPhotos += 1;
      } catch { failedPhotos.push(item); }
    }

    const remainingInspections = (await getInspections()).filter((item) => !item.synced);
    const remainingDefects = (await getDefects()).filter((item) => !item.synced);
    const result = {
      inspections: syncedInspections,
      defects: syncedDefects,
      photos: syncedPhotos,
      remainingInspections: remainingInspections.length,
      remainingDefects: remainingDefects.length,
      remainingPhotos: failedPhotos.length,
    };
    window.dispatchEvent(new CustomEvent("rams:offline-sync-complete"));
    return result;
  })().finally(() => { activeSync = null; });
  return activeSync;
}

export function readLegacyPhotoQueue() { return readLegacyQueue(LEGACY_PHOTO_QUEUE_KEY); }
export function clearLegacyPhotoQueue() { localStorage.removeItem(LEGACY_PHOTO_QUEUE_KEY); }
