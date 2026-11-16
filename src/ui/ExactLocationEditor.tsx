import { useEffect, useState } from "react";
import type { Entity, Module } from "../domain/model";
import { putRecord } from "../data/repository";
import { ensureExactLocation, exactLocationField, locationHint } from "../data/exact-location";
import type { Write } from "./Admin";
export function ExactLocationEditor({row,module,write}:{row:Entity;module:Module;write:Write}){
 const existing=exactLocationField(module);
 const [value,setValue]=useState(String(row.values[existing?.id||""]||"")),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 useEffect(()=>{setValue(String(row.values[existing?.id||""]||""));},[row.id,row.rev,existing?.id]);
 return <div className="exactLocationEditor"><label>Ubicación exacta<input value={value} onChange={e=>setValue(e.target.value)} placeholder="Ej.: H3D · planta 2 · RR. HH. · despacho 214"/></label><small>{locationHint}</small><button type="button" disabled={busy} onClick={async()=>{
  setBusy(true);setMessage("");
  try{await write("Actualizar ubicación exacta",row.id,d=>{
   const mod=d.modules.find(m=>m.id===module.id),current=d.records.find(r=>r.id===row.id);
   if(!mod||!current||current.rev!==row.rev)throw Error("El dispositivo ha cambiado. Vuelve a abrir su ficha antes de guardar.");
   const location=ensureExactLocation(mod);
   putRecord(d,mod,{...current,values:{...current.values,[location.id]:value.trim()},rev:current.rev+1});
  });setMessage("Ubicación exacta guardada.");}catch(e){setMessage(String(e));}finally{setBusy(false);}
 }}>Guardar ubicación exacta</button>{message&&<p role="status">{message}</p>}</div>;
}
