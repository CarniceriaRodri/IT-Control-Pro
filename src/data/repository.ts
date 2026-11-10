import {
  type Dataset,
  type Entity,
  type Module,
  type Change,
  validate,
  uid,
} from "../domain/model";
import { fromLegacy } from "./backup";
export interface Snapshot {
  version: number;
  data: Dataset;
}
export interface Repository {
  read(): Promise<Snapshot>;
  commit(
    version: number,
    action: string,
    target: string,
    change: (draft: Dataset) => void,
    checkpoint?: boolean,
  ): Promise<void>;
  recovery(): Promise<Dataset | undefined>;
}
const tables = ["modules", "records", "history"] as const;
function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((ok, fail) => {
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fail(r.error);
  });
}
async function transaction<T>(
  db: IDBDatabase,
  stores: string[],
  mode: IDBTransactionMode,
  work: (t: IDBTransaction) => Promise<T>,
): Promise<T> {
  const tx = db.transaction(stores, mode);
  const completion = new Promise<void>((ok, fail) => {
    tx.oncomplete = () => ok();
    tx.onabort = () => fail(tx.error || Error("Transacción cancelada"));
  });
  try {
    const [value] = await Promise.all([work(tx), completion]);
    return value;
  } catch (e) {
    try {
      tx.abort();
    } catch {}
    throw e;
  }
}
async function dataset(t: IDBTransaction): Promise<Dataset> {
  const [modules, records, history] = await Promise.all(
    tables.map((k) => request(t.objectStore(k).getAll())),
  );
  history.sort((a: Change, b: Change) => a.at.localeCompare(b.at));
  return { modules, records, history };
}
export async function openRepository(): Promise<Repository> {
  const req = indexedDB.open("it-control-pro-platform", 1);
  req.onupgradeneeded = () => {
    const db = req.result;
    db.createObjectStore("meta");
    for (const k of tables) {
      const store = db.createObjectStore(k, { keyPath: "id" });
      if (k === "records") store.createIndex("byModule", "module");
      if (k === "history") store.createIndex("byTarget", "target");
    }
  };
  const db = await request(req);
  db.onversionchange = () => db.close();
  const stores = ["meta", ...tables];
  await transaction(db, stores, "readwrite", async (t) => {
    const meta = t.objectStore("meta");
    if (await request(meta.get("version"))) return;
    const raw = localStorage.getItem("it-control-pro-demo-v01"),
      d = fromLegacy(raw === null ? {} : JSON.parse(raw), true);
    for (const k of tables) for (const item of d[k]) t.objectStore(k).add(item);
    meta.put(1, "version");
  });
  return {
    read: () =>
      transaction(db, stores, "readonly", async (t) => ({
        version: await request(t.objectStore("meta").get("version")),
        data: await dataset(t),
      })),
    commit: (version, action, target, change, checkpoint = false) =>
      transaction(db, stores, "readwrite", async (t) => {
        const meta = t.objectStore("meta");
        if ((await request(meta.get("version"))) !== version)
          throw Error(
            "Otra pestaña ha guardado cambios. Recarga la página antes de continuar.",
          );
        const d = await dataset(t),
          before = d.records.find((r) => r.id === target);
        // Snapshot original values so even in-place changes to field definitions are detected.
        const originals = tables.map(
          (k) => new Map(d[k].map((row) => [row.id, JSON.stringify(row)])),
        );
        if (checkpoint) meta.put(d, "recovery");
        change(d);
        d.history.push({
          id: uid(),
          at: new Date().toISOString(),
          action,
          target,
          before,
          after: d.records.find((r) => r.id === target),
        });
        for (const [i, k] of tables.entries()) {
          const store = t.objectStore(k),
            original = originals[i];
          for (const row of d[k]) {
            if (original.get(row.id) !== JSON.stringify(row)) store.put(row);
            original.delete(row.id);
          }
          for (const id of original.keys()) store.delete(id);
        }
        meta.put(version + 1, "version");
      }),
    recovery: () =>
      transaction(db, ["meta"], "readonly", (t) =>
        request(t.objectStore("meta").get("recovery")),
      ),
  };
}
export function putRecord(d: Dataset, mod: Module, row: Entity) {
  validate(mod, row.values, d.records, row.id);
  const i = d.records.findIndex((r) => r.id === row.id);
  if (i < 0) d.records.push(row);
  else d.records[i] = row;
}
