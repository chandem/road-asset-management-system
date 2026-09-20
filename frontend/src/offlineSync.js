import { createDefect, createInspection, uploadImage } from "./api";
import {
  deletePhoto,
  getDefectMapping,
  getInspectionMapping,
  getPendingDefects,
  getPendingInspections,
  getPhotos,
  putDefect,
  putDefectMapping,
  putInspection,
  putInspectionMapping,
  putPhoto,
} from "./offlineDb";

const LEGACY_INSPECTION_QUEUE_KEY = "rams.offline.inspection.queue";
const LEGACY_DEFECT_QUEUE_KEY = "rams.offline.defect.queue";
const LEGACY_PHOTO_QUEUE_KEY = "rams.offline.photo.queue";
const MAX_ATTEMPTS = 8;
let activeSync = null;

function readLegacyQueue(key) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
}

function fallbackClientId(prefix, item, index) {
  return (
    item.client_id ||
    item.id ||
    `${prefix}-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`
  );
}

function classifyError(error) {
  const message = String(error?.message || error || "Unknown error");
  const lower = message.toLowerCase();
  // Permanent / conflict-style failures should not spin forever
  if (
    lower.includes("already exists") ||
    lower.includes("duplicate") ||
    lower.includes("conflict") ||
    lower.includes("409") ||
    lower.includes("not found") ||
    lower.includes("404") ||
    lower.includes("validation") ||
    lower.includes("422")
  ) {
    return { status: "conflict", message };
  }
  return { status: "pending", message };
}

async function markInspectionAttempt(item, error) {
  const attempts = (item.attempts || 0) + 1;
  const { status, message } = classifyError(error);
  const nextStatus =
    status === "conflict" || attempts >= MAX_ATTEMPTS ? "conflict" : "pending";
  await putInspection({
    ...item,
    attempts,
    last_error: message,
    last_attempt_at: new Date().toISOString(),
    status: nextStatus,
    synced: false,
  });
  return nextStatus;
}

async function markDefectAttempt(item, error) {
  const attempts = (item.attempts || 0) + 1;
  const { status, message } = classifyError(error);
  const nextStatus =
    status === "conflict" || attempts >= MAX_ATTEMPTS ? "conflict" : "pending";
  await putDefect({
    ...item,
    attempts,
    last_error: message,
    last_attempt_at: new Date().toISOString(),
    status: nextStatus,
    synced: false,
  });
  return nextStatus;
}

async function markPhotoAttempt(item, error) {
  const attempts = (item.attempts || 0) + 1;
  const { status, message } = classifyError(error);
  const nextStatus =
    status === "conflict" || attempts >= MAX_ATTEMPTS ? "conflict" : "pending";
  await putPhoto({
    ...item,
    attempts,
    last_error: message,
    last_attempt_at: new Date().toISOString(),
    status: nextStatus,
  });
  return nextStatus;
}

async function migrateLegacyInspections() {
  const legacy = readLegacyQueue(LEGACY_INSPECTION_QUEUE_KEY);
  if (!Array.isArray(legacy) || !legacy.length) return;
  for (const [index, item] of legacy.entries()) {
    await putInspection({
      ...item,
      client_id: fallbackClientId("inspection", item, index),
      synced: false,
      status: "pending",
      attempts: 0,
    });
  }
  localStorage.removeItem(LEGACY_INSPECTION_QUEUE_KEY);
}

async function migrateLegacyDefects() {
  const legacy = readLegacyQueue(LEGACY_DEFECT_QUEUE_KEY);
  if (!Array.isArray(legacy) || !legacy.length) return;
  for (const [index, item] of legacy.entries()) {
    await putDefect({
      ...item,
      client_id: fallbackClientId("defect", item, index),
      synced: false,
      status: "pending",
      attempts: 0,
    });
  }
  localStorage.removeItem(LEGACY_DEFECT_QUEUE_KEY);
}

function dataUrlToFile(dataUrl, fileName, mimeType) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    throw new Error("Offline photo is missing valid image data");
  }
  const [header, body] = dataUrl.split(",");
  if (!body) throw new Error("Offline photo data is incomplete");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const detectedMime =
    header.match(/data:(.*?);base64/)?.[1] || mimeType || "image/jpeg";
  return new File([bytes], fileName || "road-photo.jpg", { type: detectedMime });
}

export async function syncOfflineQueues() {
  if (activeSync) return activeSync;
  if (!navigator.onLine) {
    const inspections = await getPendingInspections().catch(() => []);
    const defects = await getPendingDefects().catch(() => []);
    const photos = await getPhotos().catch(() => []);
    return {
      inspections: 0,
      defects: 0,
      photos: 0,
      conflicts: 0,
      remainingInspections: inspections.filter((i) => i.status !== "conflict")
        .length,
      remainingDefects: defects.filter((i) => i.status !== "conflict").length,
      remainingPhotos: photos.filter((i) => i.status !== "conflict").length,
    };
  }

  activeSync = (async () => {
    await migrateLegacyInspections();
    await migrateLegacyDefects();

    let syncedInspections = 0;
    let conflicts = 0;

    const inspections = (await getPendingInspections()).filter(
      (item) => item.status !== "conflict",
    );
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
      } catch (error) {
        const status = await markInspectionAttempt(item, error);
        if (status === "conflict") conflicts += 1;
      }
    }

    let syncedDefects = 0;
    const defects = (await getPendingDefects()).filter(
      (item) => item.status !== "conflict",
    );
    for (const item of defects) {
      const inspectionId = item.inspection_client_id
        ? await getInspectionMapping(item.inspection_client_id)
        : item.inspection_id;
      if (!inspectionId) {
        // Parent inspection not synced yet — leave pending without counting as conflict
        continue;
      }
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
      } catch (error) {
        const status = await markDefectAttempt(item, error);
        if (status === "conflict") conflicts += 1;
      }
    }

    let syncedPhotos = 0;
    const photos = await getPhotos();
    for (const item of photos) {
      if (item.status === "conflict") continue;
      const resolvedInspectionId = item.inspection_client_id
        ? await getInspectionMapping(item.inspection_client_id)
        : item.inspection_id;
      const resolvedDefectId = item.defect_client_id
        ? await getDefectMapping(item.defect_client_id)
        : item.defect_id;
      if (item.inspection_client_id && !resolvedInspectionId) continue;
      if (item.defect_client_id && !resolvedDefectId) continue;
      if (!item.file && !item.data_url) {
        await markPhotoAttempt(item, new Error("Offline photo is missing image data"));
        conflicts += 1;
        continue;
      }
      try {
        const file =
          item.file instanceof Blob
            ? new File([item.file], item.file_name || "road-photo.jpg", {
                type: item.mime_type || item.file.type || "image/jpeg",
              })
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
      } catch (error) {
        const status = await markPhotoAttempt(item, error);
        if (status === "conflict") conflicts += 1;
      }
    }

    const remainingInspections = await getPendingInspections();
    const remainingDefects = await getPendingDefects();
    const remainingPhotos = await getPhotos();

    const result = {
      inspections: syncedInspections,
      defects: syncedDefects,
      photos: syncedPhotos,
      conflicts,
      remainingInspections: remainingInspections.filter((i) => i.status !== "conflict")
        .length,
      remainingDefects: remainingDefects.filter((i) => i.status !== "conflict")
        .length,
      remainingPhotos: remainingPhotos.filter((i) => i.status !== "conflict")
        .length,
      conflictInspections: remainingInspections.filter((i) => i.status === "conflict")
        .length,
      conflictDefects: remainingDefects.filter((i) => i.status === "conflict").length,
      conflictPhotos: remainingPhotos.filter((i) => i.status === "conflict").length,
    };
    window.dispatchEvent(
      new CustomEvent("rams:offline-sync-complete", { detail: result }),
    );
    return result;
  })().finally(() => {
    activeSync = null;
  });
  return activeSync;
}

export function readLegacyPhotoQueue() {
  return readLegacyQueue(LEGACY_PHOTO_QUEUE_KEY);
}
export function clearLegacyPhotoQueue() {
  localStorage.removeItem(LEGACY_PHOTO_QUEUE_KEY);
}
