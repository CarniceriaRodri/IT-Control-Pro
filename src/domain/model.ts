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
  "relación múltiple",
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
  relationMode?: "off" | "read" | "select" | "full";
  keyRole?: "primary" | "alternate";
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
  Agenda: ["fecha", "centro", "estado"],
  Documentación: ["título", "tipo", "referencia", "observaciones"],
};
export function tasksModule(): Module {
  return {
    id: "Tareas",
    name: "Tareas",
    active: true,
    fields: [
      { ...field("asunto", "Tarea"), required: true },
      field("descripcion", "Descripción", "texto largo"),
      field("responsable", "Responsable"),
      { ...field("estado", "Estado", "estado"), options: ["Pendiente", "En curso", "Bloqueada", "Completada"], initial: "Pendiente" },
      { ...field("prioridad", "Prioridad", "prioridad"), options: ["Baja", "Media", "Alta", "Urgente"], initial: "Media" },
      field("fechaPrevista", "Fecha prevista", "fecha"),
      { ...field("incidenciaId", "Incidencia relacionada", "relación"), target: "Incidencias" },
      { ...field("equipoId", "Equipo relacionado", "relación"), target: "Inventario" },
    ],
  };
}

// Módulos maestros y campos relacionales compartidos. No existe módulo Fabricantes.
export function contactsModule(): Module {
  return {
    id: "Contactos",
    name: "Contactos",
    active: true,
    fields: [
      { ...field("nombre", "Nombre y apellidos"), required: true },
      field("telefono", "Teléfono", "teléfono"),
      field("extension", "Extensión"),
      field("correo", "Correo", "correo"),
      { ...field("centroId", "Centro", "relación"), target: "Centros" },
      field("observaciones", "Observaciones", "texto largo"),
    ],
  };
}
export function agendaExtras(): Field[] {
  return [
    { ...field("asunto", "Asunto / motivo de la llamada") },
    field("hora", "Hora", "hora"),
    field("telefono", "Teléfono para llamar", "teléfono"),
    { ...field("estado", "Estado", "estado"), options: ["Pendiente", "En proceso", "En espera", "Aplazado", "Finalizado", "Cancelado"], initial: "Pendiente" },
    { ...field("contactoId", "Contacto relacionado", "relación"), target: "Contactos" },
    { ...field("incidenciaId", "Incidencia relacionada", "relación"), target: "Incidencias" },
    { ...field("tareaId", "Tarea relacionada", "relación"), target: "Tareas" },
  ];
}
export function incidenceExtras(): Field[] {
  return [{ ...field("contactoId", "Contacto relacionado", "relación"), target: "Contactos" }];
}

export function movementsModule(): Module {
  return {
    id: "Movimientos",
    name: "Movimientos",
    active: true,
    fields: [
      { ...field("referencia", "Referencia de movimiento"), required: true, unique: true },
      { ...field("fecha", "Fecha", "fecha"), required: true },
      { ...field("tipo", "Operación", "lista"), required: true,
        options: ["Entrada", "Salida", "Préstamo", "Devolución", "Traslado"] },
      { ...field("equipoId", "Equipo o material", "relación"), target: "Inventario" },
      { ...field("centroOrigen", "Centro de origen", "relación"), target: "Centros" },
      { ...field("centroDestino", "Centro de destino", "relación"), target: "Centros" },
      field("serie", "Número de serie / referencia adicional"),
      { ...field("cantidad", "Cantidad", "entero"), initial: "1" },
      { ...field("incidenciaId", "Incidencia asociada", "relación"), target: "Incidencias" },
      { ...field("responsableId", "Contacto responsable", "relación"), target: "Contactos" },
      field("devolucionPrevista", "Devolución prevista", "fecha"),
      { ...field("estado", "Situación", "estado"),
        options: ["Pendiente", "Entregado", "Devuelto", "Finalizado", "Cancelado"], initial: "Pendiente" },
      field("observaciones", "Observaciones", "texto largo"),
    ],
  };
}

export function initialModules(): Module[] {
  return [...Object.entries(legacy).map(([id, keys]) => ({
    id,
    name: id,
    active: true,
    fields: [
      ...keys.filter((key) => id !== "Agenda" || key !== "estado").map((key, i) => ({
        ...field(key, key[0].toUpperCase() + key.slice(1), id === "Agenda" && key === "fecha" ? "fecha" : "texto"),
        required: i === 0,
      })),
      ...(id === "Agenda" ? agendaExtras() : []),
      ...(id === "Incidencias" ? incidenceExtras() : []),
      ...(id === "Incidencias"
        ? [
            {
              ...field("equipoId", "Equipo relacionado", "relación"),
              target: "Inventario",
            },
          ]
        : []),
    ],
  })), tasksModule(), contactsModule(), movementsModule()];
}
export function shown(f: Field, values: Entity["values"]) {
  return (
    f.visible && f.relationMode !== "off" &&
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
    if (!s || (Array.isArray(v) && v.length === 0)) {
      if (f.required) fail("Campo obligatorio");
      continue;
    }
    if (mod.id === "Movimientos" && f.id === "cantidad" &&
      (!Number.isSafeInteger(Number(s)) || Number(s) <= 0))
      fail("La cantidad debe ser un entero positivo");
    if (mod.id === "Movimientos" && f.id === "devolucionPrevista" && s &&
      values["fecha"] && String(s) < String(values["fecha"]))
      fail("La devolución prevista no puede ser anterior al movimiento");
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
    if (f.type === "relación" || f.type === "relación múltiple") {
      if (f.type === "relación múltiple" && !Array.isArray(v))
        fail("Se requiere una lista de registros");
      const selected = f.type === "relación múltiple" ? (v as unknown[]) : [v];
      if (selected.some((ref) =>
        typeof ref !== "string" ||
        !rows.some((r) => r.id === ref && !r.archived &&
          (f.target === "*" || r.module === f.target))
      )) fail("Referencia desconocida o archivada");
    }
    if (
      ["lista", "estado", "prioridad", "selección múltiple"].includes(f.type) &&
      !(Array.isArray(v) ? v : [v]).every((a) => f.options.includes(String(a)))
    )
      fail("Opción desconocida");
    if (
      (f.unique || f.keyRole === "primary") &&
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
