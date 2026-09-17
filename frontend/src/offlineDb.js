const DB_NAME = "rams-offline";
const DB_VERSION = 3;
const PHOTO_STORE = "photos";
const INSPECTION_STORE = "inspections";
const DEFECT_STORE = "defects";

function openDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB is not supported by this browser"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PHOTO_STORE)) db.createObjectStore(PHOTO_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(INSPECTION_STORE)) db.createObjectStore(INSPECTION_STORE, { keyPath: "client_id" });
      if (!db.objectStoreNames.contains(DEFECT_STORE)) db.createObjectStore(DEFECT_STORE, { keyPath: "client_id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open offline database"));
  });
}

async function transaction(storeName, mode, operation) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let request;
    try { request = operation(store); }
    catch (error) { reject(error); db.close(); return; }
    tx.oncomplete = () => { resolve(request?.result); db.close(); };
    tx.onerror = () => { reject(tx.error || request?.error || new Error("Offline database transaction failed")); db.close(); };
  });
}

export async function putPhoto(photo) { await transaction(PHOTO_STORE, "readwrite", (store) => store.put(photo)); }
export async function getPhotos() { return (await transaction(PHOTO_STORE, "readonly", (store) => store.getAll())) || []; }
export async function deletePhoto(id) { await transaction(PHOTO_STORE, "readwrite", (store) => store.delete(id)); }
export async function clearPhotos() { await transaction(PHOTO_STORE, "readwrite", (store) => store.clear()); }

export async function putInspection(inspection) { await transaction(INSPECTION_STORE, "readwrite", (store) => store.put(inspection)); }
export async function getInspections() { return (await transaction(INSPECTION_STORE, "readonly", (store) => store.getAll())) || []; }
export async function deleteInspection(clientId) { await transaction(INSPECTION_STORE, "readwrite", (store) => store.delete(clientId)); }

export async function putInspectionMapping(clientId, inspectionId) {
  await transaction(INSPECTION_STORE, "readwrite", (store) => store.put({ client_id: clientId, inspection_id: inspectionId, synced: true }));
}
export async function getInspectionMapping(clientId) {
  const record = await transaction(INSPECTION_STORE, "readonly", (store) => store.get(clientId));
  return record?.synced ? record.inspection_id ?? null : null;
}

export async function putDefect(defect) { await transaction(DEFECT_STORE, "readwrite", (store) => store.put(defect)); }
export async function getDefects() { return (await transaction(DEFECT_STORE, "readonly", (store) => store.getAll())) || []; }
export async function deleteDefect(clientId) { await transaction(DEFECT_STORE, "readwrite", (store) => store.delete(clientId)); }
export async function putDefectMapping(clientId, defectId) {
  await transaction(DEFECT_STORE, "readwrite", (store) => store.put({ client_id: clientId, defect_id: defectId, synced: true }));
}
export async function getDefectMapping(clientId) {
  const record = await transaction(DEFECT_STORE, "readonly", (store) => store.get(clientId));
  return record?.synced ? record.defect_id ?? null : null;
}
