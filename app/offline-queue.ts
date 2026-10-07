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

const DATABASE = "parkflow-garita";
const STORE = "offline-entries";

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
