import { createInspection, uploadImage } from "./api";

const INSPECTION_QUEUE_KEY = "rams.offline.inspection.queue";
const PHOTO_QUEUE_KEY = "rams.offline.photo.queue";
const INSPECTION_MAP_KEY = "rams.offline.inspection.map";
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

function readInspectionMap() {
  try {
    const value = localStorage.getItem(INSPECTION_MAP_KEY);
    return value ? JSON.parse(value) : {};
  } catch {
    return {};
  }
}

function writeInspectionMap(map) {
  localStorage.setItem(INSPECTION_MAP_KEY, JSON.stringify(map));
}

function dataUrlToFile(dataUrl, fileName, mimeType) {
  const [header, body] = dataUrl.split(",");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const detectedMime = header.match(/data:(.*?);base64/)?.[1] || mimeType || "image/jpeg";
  return new File([bytes], fileName || "road-photo.jpg", { type: detectedMime });
}

export function syncOfflineQueues() {
  if (activeSync) return activeSync;
  if (!navigator.onLine) {
    return Promise.resolve({
      inspections: 0,
      photos: 0,
      remainingInspections: readQueue(INSPECTION_QUEUE_KEY).length,
      remainingPhotos: readQueue(PHOTO_QUEUE_KEY).length,
    });
  }

  activeSync = (async () => {
    const inspections = readQueue(INSPECTION_QUEUE_KEY);
    const photos = readQueue(PHOTO_QUEUE_KEY);
    const inspectionMap = readInspectionMap();
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
        inspectionMap[clientId] = result.inspection_id;
        syncedInspections += 1;
      } catch {
        failedInspections.push({ ...item, client_id: clientId });
      }
    }
    writeQueue(INSPECTION_QUEUE_KEY, failedInspections);
    writeInspectionMap(inspectionMap);

    const failedPhotos = [];
    let syncedPhotos = 0;
    for (const item of photos) {
      const resolvedInspectionId = item.inspection_client_id
        ? inspectionMap[item.inspection_client_id]
        : item.inspection_id;

      if (item.inspection_client_id && !resolvedInspectionId) {
        failedPhotos.push(item);
        continue;
      }

      try {
        const file = dataUrlToFile(item.data_url, item.file_name, item.mime_type);
        await uploadImage({
          file,
          inspectionId: resolvedInspectionId || null,
          defectId: item.defect_id || null,
          capturedAt: item.captured_at,
          latitude: item.latitude,
          longitude: item.longitude,
        });
        syncedPhotos += 1;
      } catch {
        failedPhotos.push(item);
      }
    }
    writeQueue(PHOTO_QUEUE_KEY, failedPhotos);

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
