export type OfflineEntry = {
  operationId: string;
  code: string;
  licensePlate: string;
  typeCode: string;
  observation: string | null;
  createdAt: string;
  status: "PENDING" | "CONFLICT" | "ERROR";
  message?: string;
};

export type CatalogSnapshot = {
  types: Array<{ code: string; name: string }>;
  capacities: Array<{ typeCode: string; typeName: string; capacity: number; occupied: number }>;
  savedAt: string;
};

const DATABASE = "parkflow-garita";
const STORE = "offline-entries";
const SNAPSHOT_KEY = "parkflow:catalog-snapshot";

function openQueue(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "operationId" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("No se pudo abrir la cola local."));
  });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openQueue();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, mode);
    const request = action(transaction.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("No se pudo actualizar la cola local."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
}

export const listOfflineEntries = () => run<OfflineEntry[]>("readonly", (store) => store.getAll());
export const saveOfflineEntry = (entry: OfflineEntry) => run<IDBValidKey>("readwrite", (store) => store.put(entry));
export const removeOfflineEntry = (operationId: string) => run<undefined>("readwrite", (store) => store.delete(operationId));

export function saveCatalogSnapshot(snapshot: CatalogSnapshot) {
  try {
    window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch { /* almacenamiento local opcional */ }
}

export function loadCatalogSnapshot(): CatalogSnapshot | null {
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CatalogSnapshot>;
    if (!Array.isArray(parsed.types) || !Array.isArray(parsed.capacities) || typeof parsed.savedAt !== "string") return null;
    return parsed as CatalogSnapshot;
  } catch {
    return null;
  }
}
