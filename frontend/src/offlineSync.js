import { createInspection, uploadImage } from "./api";
import { deleteInspection, getInspections, getInspectionMapping, getPhotos, putInspectionMapping, deletePhoto } from "./offlineDb";

const LEGACY_INSPECTION_QUEUE_KEY = "rams.offline.inspection.queue";
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
    await import("./offlineDb").then(({ putInspection }) => putInspection({ ...item, client_id: clientId, synced: false }));
  }
  localStorage.removeItem(LEGACY_INSPECTION_QUEUE_KEY);
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
    const photos = await getPhotos().catch(() => []);
    return { inspections: 0, photos: 0, remainingInspections: inspections.filter((x) => !x.synced).length, remainingPhotos: photos.length };
  }

  activeSync = (async () => {
    await migrateLegacyInspections();
    const inspections = (await getInspections()).filter((item) => !item.synced);
    const photos = await getPhotos();
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

    const remainingInspections = (await getInspections()).filter((item) => !item.synced);
    // Synced mappings are retained for a short-lived relationship between offline
    // inspection IDs and server IDs, so photos can be uploaded after inspection sync.
    const failedPhotos = [];
    let syncedPhotos = 0;
    for (const item of photos) {
      const resolvedInspectionId = item.inspection_client_id ? await getInspectionMapping(item.inspection_client_id) : item.inspection_id;
      if (item.inspection_client_id && !resolvedInspectionId) { failedPhotos.push(item); continue; }
      try {
        const file = item.file instanceof Blob
          ? new File([item.file], item.file_name || "road-photo.jpg", { type: item.mime_type || item.file.type })
          : dataUrlToFile(item.data_url, item.file_name, item.mime_type);
        await uploadImage({ file, inspectionId: resolvedInspectionId || null, defectId: item.defect_id || null, capturedAt: item.captured_at, latitude: item.latitude, longitude: item.longitude });
        await deletePhoto(item.id); syncedPhotos += 1;
      } catch { failedPhotos.push(item); }
    }

    const result = { inspections: syncedInspections, photos: syncedPhotos, remainingInspections: remainingInspections.length, remainingPhotos: failedPhotos.length };
    window.dispatchEvent(new CustomEvent("rams:offline-sync-complete"));
    return result;
  })().finally(() => { activeSync = null; });
  return activeSync;
}

export function readLegacyPhotoQueue() { return readLegacyQueue(LEGACY_PHOTO_QUEUE_KEY); }
export function clearLegacyPhotoQueue() { localStorage.removeItem(LEGACY_PHOTO_QUEUE_KEY); }
