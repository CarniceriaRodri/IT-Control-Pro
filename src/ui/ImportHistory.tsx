import { useState } from "react";
import type { Dataset } from "../domain/model";
import type { Write } from "./Admin";
export function ImportHistory({data,module,write}:{data:Dataset;module:string;write:Write}){
 const [error,setError]=useState("");
 const history=(data.imports||[]).filter(x=>x.module===module).slice().reverse();
 if(!history.length)return null;
 return <details><summary>Historial de importaciones ({history.length})</summary>{history.map(batch=><div className="inline" key={batch.id}><span>{new Date(batch.at).toLocaleString("es-ES")} · {batch.source} · {batch.sheet} · {batch.recordIds.length} registros {batch.undone?"· Deshecha":""}</span><button disabled={batch.undone} onClick={async()=>{
  if(!confirm("¿Deshacer esta importación? Se restaurarán los datos anteriores del módulo si no ha habido cambios posteriores."))return;
  try{await write("Deshacer importación",module,d=>{
   const entry=d.imports?.find(x=>x.id===batch.id);if(!entry||entry.undone||!entry.after)throw Error("No hay un punto reversible para esta importación.");
   const current={module:d.modules.find(m=>m.id===module),records:d.records.filter(r=>r.module===module)};
   if(JSON.stringify(current)!==JSON.stringify(entry.after))throw Error("El módulo ha cambiado después de importar. Deshaz primero la importación más reciente o restaura una copia revisada.");
   const removed=new Set(current.records.filter(r=>!entry.before.records.some(old=>old.id===r.id)).map(r=>r.id));
   if(d.records.some(r=>r.module!==module&&Object.values(r.values).some(v=>removed.has(String(v))||(Array.isArray(v)&&v.some(x=>removed.has(String(x)))))))throw Error("Hay registros de otros módulos relacionados con los importados. Revisa esas relaciones antes de deshacer.");
   d.records=[...d.records.filter(r=>r.module!==module),...structuredClone(entry.before.records)];
   const i=d.modules.findIndex(m=>m.id===module);if(entry.before.module)d.modules[i]=structuredClone(entry.before.module);else d.modules.splice(i,1);
   entry.undone=true;
  });setError("Importación deshecha.");}catch(e){setError(String(e));}
 }}>Deshacer importación</button></div>)}{error&&<p role="status">{error}</p>}</details>;
}
