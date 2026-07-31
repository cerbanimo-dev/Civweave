const DB_NAME = 'anarchadia-charter-forge';
const STORE = 'workspace';
const KEY = 'active';

function repairDatabase(currentVersion = 1) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, Math.max(1, Number(currentVersion || 1) + 1));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to repair local database.'));
    request.onblocked = () => reject(new Error('Close other Anarchadia tabs so the local database can be repaired.'));
  });
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) {
      reject(new Error('IndexedDB is unavailable in this browser.'));
      return;
    }

    // Open the newest version already present on this device. This avoids the
    // VersionError caused by an earlier repair creating a version newer than a
    // hard-coded application constant.
    const request = indexedDB.open(DB_NAME);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = async () => {
      const db = request.result;
      if (db.objectStoreNames.contains(STORE)) {
        resolve(db);
        return;
      }
      const version = db.version;
      db.close();
      try { resolve(await repairDatabase(version)); }
      catch (error) { reject(error); }
    };
    request.onerror = () => reject(request.error || new Error('Unable to open local database.'));
  });
}

async function withStore(mode, operation) {
  let db = await openDb();
  if (!db.objectStoreNames.contains(STORE)) {
    const version = db.version;
    db.close();
    db = await repairDatabase(version);
  }
  return new Promise((resolve, reject) => {
    let tx;
    try { tx = db.transaction(STORE, mode); }
    catch (error) { db.close(); reject(error); return; }
    const store = tx.objectStore(STORE);
    let request;
    try { request = operation(store); }
    catch (error) { db.close(); reject(error); return; }
    if (request) {
      request.onerror = () => reject(request.error || new Error('Local database request failed.'));
    }
    tx.oncomplete = () => { db.close(); resolve(request?.result ?? null); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error('Local database transaction failed.')); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error('Local database transaction was aborted.')); };
  });
}

export async function loadWorkspace() {
  return withStore('readonly', store => store.get(KEY));
}

export async function saveWorkspace(state) {
  await withStore('readwrite', store => store.put(state, KEY));
}

export async function clearWorkspace() {
  await withStore('readwrite', store => store.delete(KEY));
}

export async function storageEstimate() {
  if (!navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota, percent: quota ? Math.round((usage / quota) * 1000) / 10 : 0 };
}

export async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return false;
  return navigator.storage.persist();
}
