import { createInspection, uploadImage } from "./api";
import { getInspectionMapping, getPhotos, putInspectionMapping, deletePhoto } from "./offlineDb";

const INSPECTION_QUEUE_KEY = "rams.offline.inspection.queue";
const LEGACY_PHOTO_QUEUE_KEY = "rams.offline.photo.queue";
let activeSync = null;

function readQueue(key) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
}

function writeQueue(key, queue) {
  localStorage.setItem(key, JSON.stringify(queue));
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
    const photos = await getPhotos().catch(() => []);
    return {
      inspections: 0,
      photos: 0,
      remainingInspections: readQueue(INSPECTION_QUEUE_KEY).length,
      remainingPhotos: photos.length,
    };
  }

  activeSync = (async () => {
    const inspections = readQueue(INSPECTION_QUEUE_KEY);
    const photos = await getPhotos();
    const failedInspections = [];
    let syncedInspections = 0;

    for (const item of inspections) {
      const clientId = item.client_id || item.id;
      try {
        const result = await createInspection(item.section_id, {
          inspection_date: item.inspection_date,
          inspector_id: item.inspector_id ?? null,
          client_id: clientId,
          condition_rating: item.condition_rating,
          weather: item.weather,
          notes: item.notes,
        });
        await putInspectionMapping(clientId, result.inspection_id);
        syncedInspections += 1;
      } catch {
        failedInspections.push({ ...item, client_id: clientId });
      }
    }
    writeQueue(INSPECTION_QUEUE_KEY, failedInspections);

    const failedPhotos = [];
    let syncedPhotos = 0;
    for (const item of photos) {
      const resolvedInspectionId = item.inspection_client_id
        ? await getInspectionMapping(item.inspection_client_id)
        : item.inspection_id;

      if (item.inspection_client_id && !resolvedInspectionId) {
        failedPhotos.push(item);
        continue;
      }

      try {
        const file = item.file instanceof Blob
          ? new File([item.file], item.file_name || "road-photo.jpg", { type: item.mime_type || item.file.type })
          : dataUrlToFile(item.data_url, item.file_name, item.mime_type);
        await uploadImage({
          file,
          inspectionId: resolvedInspectionId || null,
          defectId: item.defect_id || null,
          capturedAt: item.captured_at,
          latitude: item.latitude,
          longitude: item.longitude,
        });
        await deletePhoto(item.id);
        syncedPhotos += 1;
      } catch {
        failedPhotos.push(item);
      }
    }

    const result = {
      inspections: syncedInspections,
      photos: syncedPhotos,
      remainingInspections: failedInspections.length,
      remainingPhotos: failedPhotos.length,
    };
    window.dispatchEvent(new CustomEvent("rams:offline-sync-complete"));
    return result;
  })().finally(() => {
    activeSync = null;
  });

  return activeSync;
}

export function readLegacyPhotoQueue() {
  try {
    const value = localStorage.getItem(LEGACY_PHOTO_QUEUE_KEY);
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
}

export function clearLegacyPhotoQueue() {
  localStorage.removeItem(LEGACY_PHOTO_QUEUE_KEY);
}
