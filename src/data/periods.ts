export interface Retention {
  day: number;
  week: number;
  month: number;
}
export const defaults: Retention = { day: 7, week: 4, month: 3 };
export interface RestorePoint {
  key: string;
  period: keyof Retention;
  stamp: string;
  version: number;
}
export const periods = ["day", "week", "month"] as const;
export const labels = { day: "Diarias", week: "Semanales", month: "Mensuales" };
export function buckets(date: Date) {
  const local = (d: Date) =>
    [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return {
    day: local(date),
    week: local(monday),
    month: local(date).slice(0, 7),
  };
}
export const get = <T>(r: IDBRequest<T>): Promise<T> =>
  new Promise((ok, fail) => {
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fail(r.error);
  });
export async function rotate(
  t: IDBTransaction,
  version: number,
  readData: () => Promise<unknown>,
  now = new Date(),
) {
  const retention: Retention =
    (await get(t.objectStore("meta").get("retention"))) ?? defaults;
  const dates = buckets(now),
    points = t.objectStore("points"),
    bodies = t.objectStore("snapshots");
  const entries: RestorePoint[] = await get(points.getAll()),
    old = new Set(entries.map((p) => p.version)),
    keep = new Set<number>();
  let changed = false;
  for (const period of periods) {
    const list = entries
      .filter((p) => p.period === period)
      .sort((a, b) => b.key.localeCompare(a.key));
    const key = period + "/" + dates[period];
    if (retention[period] > 0) {
      const current = list.find((p) => p.key === key);
      if (!current || current.version !== version) {
        const entry = { key, period, stamp: now.toISOString(), version };
        points.put(entry);
        changed = true;
        if (current) list.splice(list.indexOf(current), 1);
        list.unshift(entry);
      }
    }
    for (const [i, p] of list.entries()) {
      if (i >= retention[period]) points.delete(p.key);
      else keep.add(p.version);
    }
  }
  if (changed && !old.has(version)) bodies.put(await readData(), version);
  for (const v of old) if (!keep.has(v)) bodies.delete(v);
}
