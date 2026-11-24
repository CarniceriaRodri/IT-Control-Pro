import { field, type Field } from "../domain/model";

/** Campos adicionales: no modifica ni crea tareas en el sistema CA_SIS. */
export const taskPasteFields: Field[] = [
  field("referencia", "Identificador CA_SIS"),
  field("referenciaExterna", "Referencia externa"),
  field("tipoTarea", "Tipo de tarea"),
  field("subtipo", "Subtipo"),
  field("areaTic", "Área TIC"),
  field("centroGestion", "Centro de gestión"),
  field("estadoOrigen", "Estado original"),
  field("prioridadOrigen", "Prioridad original"),
  field("resolucionOrigen", "Resolución original"),
  field("telefono", "Teléfono de contacto", "teléfono"),
  field("tarificacion", "Tarificación"),
  field("avanceTecnico", "Avance técnico (%)", "entero"),
  field("avanceEconomico", "Avance económico (%)", "entero"),
  field("historial", "Comentarios e historial importados", "texto largo"),
];
export type ParsedTask = Record<string, string>;
const tidy = (value: string) => value.replace(/\s+/g, " ").trim();
const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const keyLine = (s: string) => normalize(s).replace(/\s*:\s*$/, "").trim();
const labels: Record<string, string> = {
  "resolucion":"resolucionOrigen", "prioridad":"prioridadOrigen",
  "miembro asignado":"responsable", "tarificacion":"tarificacion",
  "area tic":"areaTic", "centros de gestion":"centroGestion",
  "referencia externa":"referenciaExterna", "tipo de tarea":"tipoTarea",
  "subtipo":"subtipo", "grado de avance tecnico (%)":"avanceTecnico",
  "grado de avance economico (%)":"avanceEconomico",
};
const stops = new Set(["adjuntos","actividad","todo","comentarios","comentarios fijados",
  "bitacora de trabajo","historico de cambios","propiedades proyecto","transiciones",
  "timepiece","advanced activity","links hierarchy","mas antiguas primero",
  "detalles","etiquetas","opciones", "anadir comentario"]);
export function parseTaskPaste(raw: string): ParsedTask {
  const lines = raw.replace(/\r/g,"").split("\n").map(s=>s.trim()).filter(Boolean);
  const result: ParsedTask = {};
  const joined = lines.join("\n");
  const ref = joined.match(/\b(?:CAAT2|[A-Z][A-Z0-9]{1,15})-\d{2,10}\b/i);
  if(ref) result.referencia = ref[0].toUpperCase();
  const titleLine = lines.find(s=>/^(?:Informaci[oó]n del usuario|Tarea:|Asunto:)/i.test(s));
  if(titleLine) result.asunto = tidy(titleLine.replace(/^(?:Tarea|Asunto):\s*/i,""));
  const status = joined.match(/(?:^|\n)(Pdte\.?\s*revisi[oó]n t[eé]cnica|En curso|Pendiente|Cerrada|Abierta|Resuelta)(?:\n|$)/i);
  if(status) {
    result.estadoOrigen = status[1];
    result.estado = /cerrada|resuelta/i.test(status[1]) ? "Completada" :
      /en curso/i.test(status[1]) ? "En curso" : "Pendiente";
  }
  const headings = new Set([...Object.keys(labels),...stops,"descripcion", "tipo"]);
  const ignore = /^(?:icon:|ninguno$|\d+\s+de\s+\d+$|pin$|anclar$|contraer el comentario|compartir esta incidencia|exportar$)/i;
  for(let i=0;i<lines.length;i++) {
    let s=lines[i];
    const direct=s.match(/^([^:]{2,50}):\s*(.*)$/);
    const key=keyLine(direct ? direct[1] : s);
    const target=labels[key];
    if(target) {
      let val=direct?.[2]?.trim() || "";
      if(!val && i+1<lines.length) {
        const next=lines[i+1], nextKey=keyLine(next.split(":")[0]);
        if(!headings.has(nextKey) && !ignore.test(next))val=next;
      }
      if(val)result[target]=tidy(val.replace(/^Icon:\s*/i,"").replace(/^P([1-4])\s+P\1$/i,"P$1"));
    }
  }
  const descriptionAt=lines.findIndex(s=>keyLine(s)==="descripcion");
  if(descriptionAt>=0){
    const desc: string[]=[];
    for(let i=descriptionAt+1;i<lines.length;i++){
      const s=lines[i], k=keyLine(s);
      if(stops.has(k))break;
      desc.push(s);
    }
    if(desc.length)result.descripcion=desc.join("\n");
  }
  const phone=joined.match(/Tel[eé]fono de contacto(?: para la solicitud)?\s*:\s*([+\d][\d\s-]{6,})/i);
  if(phone)result.telefono=tidy(phone[1]);
  // Los comentarios se conservan como histórico editable, sin repetir encabezados.
  const activityAt=lines.findIndex(s=>keyLine(s)==="actividad");
  if(activityAt>=0){
    const activity=lines.slice(activityAt+1).filter(s=>
      !/^(?:pin|anclar|m[aá]s antiguas primero|opciones|todo|comentarios|comentarios fijados|bit[aá]cora de trabajo|hist[oó]rico de cambios|actividad|propiedades proyecto|transiciones|timepiece|advanced activity|links hierarchy)$/i.test(s)
      && !/^contraer el comentario:/i.test(s)
    );
    const compact=activity.filter((s,i)=>i===0 || s!==activity[i-1]);
    if(compact.length)result.historial=compact.join("\n");
  }
  if(!result.asunto && result.referencia)result.asunto="Tarea "+result.referencia;
  return result;
}
