import type { Attachment } from "../data/media";
export const types = [
  "texto",
  "texto largo",
  "entero",
  "decimal",
  "fecha",
  "hora",
  "fecha y hora",
  "casilla",
  "lista",
  "selección múltiple",
  "autocompletado",
  "teléfono",
  "correo",
  "IP",
  "MAC",
  "código de barras",
  "QR",
  "relación",
  "identificador",
  "estado",
  "prioridad",
] as const;
export type Kind = (typeof types)[number];
export interface Field {
  id: string;
  label: string;
  type: Kind;
  required: boolean;
  visible: boolean;
  options: string[];
  target?: string;
  hint?: string;
  when?: { field: string; equals: string };
  section?: string;
  initial?: string;
  unique?: boolean;
}
export interface Module {
  files?: Attachment[];
  id: string;
  name: string;
  active: boolean;
  fields: Field[];
}
export interface Entity {
  files?: Attachment[];
  id: string;
  module: string;
  values: Record<string, unknown>;
  rev: number;
  archived: boolean;
}
export interface Change {
  id: string;
  at: string;
  action: string;
  target: string;
  before?: Entity;
  after?: Entity;
}
export interface Dataset {
  modules: Module[];
  records: Entity[];
  history: Change[];
}
export const uid = () => crypto.randomUUID();
export const field = (id: string, label = id, type: Kind = "texto"): Field => ({
  id,
  label,
  type,
  required: false,
  visible: true,
  options: [],
});
export const legacy: Record<string, string[]> = {
  Centros: ["nombre", "zona", "dirección", "teléfono"],
  Inventario: ["equipo", "tipo", "serie", "centro", "estado"],
  Incidencias: ["número", "asunto", "centro", "prioridad", "estado"],
  Almacén: ["artículo", "cantidad", "ubicación", "observaciones"],
  Redes: ["dispositivo", "ip", "centro", "observaciones"],
  Agenda: ["tarea", "fecha", "centro", "estado"],
  Documentación: ["título", "tipo", "referencia", "observaciones"],
};
export function initialModules(): Module[] {
  return Object.entries(legacy).map(([id, keys]) => ({
    id,
    name: id,
    active: true,
    fields: [
      ...keys.map((key, i) => ({
        ...field(key, key[0].toUpperCase() + key.slice(1)),
        required: i === 0,
      })),
      ...(id === "Incidencias"
        ? [
            {
              ...field("equipoId", "Equipo relacionado", "relación"),
              target: "Inventario",
            },
          ]
        : []),
    ],
  }));
}
export function shown(f: Field, values: Entity["values"]) {
  return (
    f.visible &&
    (!f.when ||
      String(values[f.when.field] ?? "")
        .trim()
        .toLocaleLowerCase() === f.when.equals.trim().toLocaleLowerCase())
  );
}
export function title(row: Entity, mod: Module) {
  return String(
    row.values[mod.fields.find((f) => f.visible)?.id ?? ""] || row.id,
  );
}
export function validate(
  mod: Module,
  values: Entity["values"],
  rows: Entity[],
  id: string,
) {
  for (const f of mod.fields.filter((f) => shown(f, values))) {
    const v = values[f.id],
      s = String(v ?? "").trim();
    function fail(msg: string): never {
      throw Error(f.label + " · " + msg);
    }
    if (!s) {
      if (f.required) fail("Campo obligatorio");
      continue;
    }
    if (
      (f.type === "entero" && !Number.isInteger(Number(s))) ||
      (f.type === "decimal" && !Number.isFinite(Number(s)))
    )
      fail("Número no válido");
    if (f.type === "correo" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
      fail("Correo no válido");
    if (
      f.type === "IP" &&
      !(
        s.split(".").length === 4 &&
        s
          .split(".")
          .every((n) => /^(0|[1-9]\d{0,2})$/.test(n) && Number(n) < 256)
      )
    ) {
      try {
        if (!s.includes(":") || new URL("http://[" + s + "]/").hostname === "")
          fail("IP no válida");
      } catch {
        fail("IP no válida");
      }
    }
    if (f.type === "MAC" && !/^([\da-f]{2}[:-]){5}[\da-f]{2}$/i.test(s))
      fail("MAC no válida");
    if (
      f.type === "relación" &&
      !rows.some((r) => r.module === f.target && r.id === s)
    )
      fail("Referencia desconocida");
    if (
      ["lista", "estado", "prioridad", "selección múltiple"].includes(f.type) &&
      !(Array.isArray(v) ? v : [v]).every((a) => f.options.includes(String(a)))
    )
      fail("Opción desconocida");
    if (
      f.unique &&
      rows.some(
        (r) =>
          r.module === mod.id &&
          r.id !== id &&
          !r.archived &&
          String(r.values[f.id] ?? "")
            .trim()
            .toLowerCase() === s.toLowerCase(),
      )
    )
      fail("Valor duplicado");
  }
}
