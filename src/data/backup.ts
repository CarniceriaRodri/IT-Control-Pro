import {
  initialModules,
  legacy,
  types,
  uid,
  type Dataset,
  type Entity,
} from "../domain/model";
const obj = (v: unknown) => !!v && typeof v === "object" && !Array.isArray(v);
const uuid = (v: unknown) =>
  typeof v === "string" &&
  /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(v);
const safe = (s: unknown) =>
  typeof s === "string" &&
  !!s.trim() &&
  !["__proto__", "constructor", "prototype"].includes(s);
function check(test: unknown) {
  if (!test)
    throw Error(
      "Copia incompatible o dañada. Revisa el formato antes de continuar.",
    );
}
export function fromLegacy(
  raw: Record<string, unknown>,
  partial = false,
): Dataset {
  check(obj(raw) && Object.keys(raw).every((k) => Object.hasOwn(legacy, k)));
  const records: Entity[] = [];
  for (const module of Object.keys(legacy)) {
    if (partial && !Object.hasOwn(raw, module)) continue;
    const rows = raw[module];
    check(Array.isArray(rows));
    for (const values of rows as Entity["values"][]) {
      check(obj(values));
      records.push({ id: uid(), module, values, rev: 1, archived: false });
    }
  }
  return { modules: initialModules(), records, history: [] };
}
export const envelope = (data: Dataset) => ({
  app: "IT Control Pro",
  version: 2,
  data,
});
export function parseBackup(raw: string): Dataset {
  const b = JSON.parse(raw);
  check(b?.app === "IT Control Pro");
  if (b.version === 1) return fromLegacy(b.data);
  check(b.version === 2 && obj(b.data));
  const d = b.data as Dataset;
  check(
    Array.isArray(d.modules) &&
      Array.isArray(d.records) &&
      Array.isArray(d.history),
  );
  const mods = new Set<string>(),
    ids = new Set<string>();
  for (const m of d.modules) {
    check(
      safe(m.id) &&
        safe(m.name) &&
        !mods.has(m.id) &&
        typeof m.active === "boolean" &&
        Array.isArray(m.fields) &&
        m.fields.length,
    );
    mods.add(m.id);
    const keys = new Set<string>();
    for (const f of m.fields) {
      check(
        safe(f.id) &&
          safe(f.label) &&
          !keys.has(f.id) &&
          types.includes(f.type) &&
          typeof f.visible === "boolean" &&
          typeof f.required === "boolean" &&
          Array.isArray(f.options) &&
          f.options.every((v) => typeof v === "string") &&
          [f.initial, f.hint, f.target, f.section].every(
            (v) => v === undefined || typeof v === "string",
          ),
      );
      if (f.when)
        check(
          typeof f.when.equals === "string" &&
            m.fields.some((x) => x.id === f.when!.field && x.id !== f.id),
        );
      keys.add(f.id);
    }
  }
  check(Object.keys(legacy).every((k) => mods.has(k)));
  for (const m of d.modules)
    for (const f of m.fields)
      if (f.type === "relación") check(mods.has(f.target!));
  for (const r of d.records) {
    check(
      uuid(r.id) &&
        !ids.has(r.id) &&
        mods.has(r.module) &&
        Number.isInteger(r.rev) &&
        r.rev > 0 &&
        typeof r.archived === "boolean" &&
        obj(r.values),
    );
    ids.add(r.id);
  }
  const events = new Set<string>();
  for (const h of d.history) {
    check(!events.has(h.id));
    events.add(h.id);
    check(
      uuid(h.id) &&
        typeof h.at === "string" &&
        typeof h.action === "string" &&
        typeof h.target === "string",
    );
  }
  return d;
}
