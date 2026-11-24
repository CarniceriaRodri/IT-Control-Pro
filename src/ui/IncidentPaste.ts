import { field, type Field } from "../domain/model";

/** Importación local de texto CGES: no crea ni modifica registros del sistema externo. */
export const incidentPasteFields: Field[] = [
  field("tipificacion", "Tipificación CGES"),
  field("recurso", "Recurso afectado"),
  field("fechaApertura", "Fecha de apertura (origen)"),
  field("descripcion", "Descripción", "texto largo"),
  field("lineaAfectada", "Línea afectada"),
  field("telefonoContacto", "Teléfono de contacto", "teléfono"),
  field("ubicacion", "Ubicación"),
  field("estadoOrigen", "Estado original CGES"),
  field("prioridadOrigen", "Prioridad original CGES"),
  field("actuaciones", "Historial de actuaciones", "texto largo"),
  field("textoOrigen", "Texto original importado", "texto largo"),
];
export type ParsedIncident = Record<string,string>;
const clean = (v:string) => v.replace(/&nbsp;|&#xA0;/gi," ").replace(/\u00a0/g," ").trim();
const key = (v:string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/:$/,"").trim();
const labels: Record<string,string> = {
  "estado":"estadoOrigen", "tipificacion":"tipificacion","recurso":"recurso",
  "fecha apertura":"fechaApertura","prioridad":"prioridadOrigen",
};
const stopDescriptions = new Set(["etiquetas","resumen de actividades","registro de actividad",
 "relacionadas","documentos","resumen de actuaciones","soluciones","interesados","actividad"]);
export function parseIncidentPaste(raw:string):ParsedIncident {
  const lines=raw.replace(/\r/g,"").split("\n").map(clean).filter(Boolean);
  const out:ParsedIncident={};
  const normal=lines.join("\n");
  // CGES: número junto a prioridad Normal/Alta o aislado en la cabecera.
  const header=lines.slice(0,12).join(" ");
  const id=header.match(/\b(?:Normal|Alta|Baja|Urgente|Cr[ií]tica)\s+(\d{6,12})\b/i)
    || header.match(/\b(?:N[uú]mero(?:\s+incidencia)?|Incidencia\s*(?:nº|n[oú]m\.?|#)?)\s*[:#-]?\s*(\d{6,12})\b/i);
  if(id)out["número"]=id[1];
  const titleAt=lines.findIndex(s=>key(s)==="descripcion");
  const issueTitle=lines.find((s,i)=>i<14 && /[a-záéíóúñ]/i.test(s) && s.length>12 &&
    !/^(?:estado|tipificaci[oó]n|recurso|fecha apertura|descripci[oó]n|seguir|normal|alta|baja)/i.test(s)
    && !/https?:\/\//i.test(s));
  if(issueTitle)out.asunto=issueTitle.replace(/^#{1,6}\s*/,"").trim();
  for(let i=0;i<lines.length;i++){
    const s=lines[i];
    const colon=s.match(/^([^:]{3,40}):\s*(.*)$/);
    const label=key(colon?colon[1]:s);
    const fieldId=labels[label];
    if(fieldId){
      let value=colon?.[2]||"";
      if(!value && lines[i+1] && !labels[key(lines[i+1].split(":")[0])]) value=lines[i+1];
      if(value)out[fieldId]=clean(value);
    }
  }
  if(titleAt>=0){
    const desc:string[]=[];
    for(let i=titleAt+1;i<lines.length;i++){
      if(stopDescriptions.has(key(lines[i])))break;
      desc.push(lines[i]);
    }
    if(desc.length)out.descripcion=desc.join("\n");
  }
  const rawDescription=out.descripcion||normal;
  const line=rawDescription.match(/L[ií]nea afectada\s*:\s*([^\n]+)/i);
  if(line)out.lineaAfectada=line[1].trim();
  const phone=rawDescription.match(/Tel[eé]fono de contacto\s*:\s*([^\n]+)/i);
  if(phone)out.telefonoContacto=phone[1].trim();
  const location=rawDescription.match(/Ubicaci[oó]n\s*:\s*([^\n]+)/i);
  if(location)out.ubicacion=location[1].trim();
  // Historial bruto: preservar íntegro el contenido sin interpretar datos tabulares de forma incorrecta.
  const activityAt=lines.findIndex(s=>key(s)==="registro de actividad");
  const index=activityAt>=0?activityAt:lines.findIndex(s=>key(s)==="actuaciones");
  if(index>=0)out.actuaciones=lines.slice(index+1).join("\n");
  out.textoOrigen=raw.trim();
  return out;
}
