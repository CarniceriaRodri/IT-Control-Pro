import type { Dataset, Entity } from "../domain/model";
export type Target={ip:string;device:string;center:string;location:string;groups:string[];recordIds:string[];ports:number[];schedule?:{start:number;end:number};intervalSeconds?:number;failureThreshold?:number};
export const normalizeHeader=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
export function networkTargets(data:Dataset):Target[]{
 const found=new Map<string,Target>();
 for(const row of data.records){
  if(row.archived)continue;
  const mod=data.modules.find(m=>m.id===row.module);if(!mod?.active)continue;
  const read=(keys:string[],all=false)=>{
   const fields=mod.fields.filter(f=>keys.includes(normalizeHeader(f.id))||keys.includes(normalizeHeader(f.label)));
   const values=fields.map(f=>{const v=row.values[f.id];if(f.type==="relación"){const linked=data.records.find(r=>r.id===v);if(linked){const linkedMod=data.modules.find(m=>m.id===linked.module);const name=linkedMod?.fields.find(x=>normalizeHeader(x.label)==="nombre");return String(linked.values[name?.id||"nombre"]||Object.values(linked.values)[0]||"");}}return String(v??"").trim();}).filter(Boolean);
   return all?[...new Set(values)].join(" · "):values[0]||"";
  };
  const ip=read(["ip","ipprincipal","direccionip","direccionipv4","ipv4"])||String(row.values[mod.fields.find(f=>f.type==="IP")?.id||""]||"");
  if(!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)||ip.split(".").some(x=>+x>255))continue;
  const target:Target={ip,device:read(["dispositivo","equipo","nombre","impresora","descripcion","serie"])||ip,center:read(["centro","centros","centroid","sede","centrodesalud","nombrecentro"]),location:read(["ubicacion","ubicacionfina","ubicacionconcreta","localizacion","edificio","planta","servicio","despacho","sala","consulta"],true),groups:[row.module],recordIds:[row.id],ports:[80,443,9100]};
  const previous=found.get(ip);
  if(previous){previous.groups=[...new Set([...previous.groups,row.module])];previous.recordIds.push(row.id);previous.center=[...new Set([previous.center,target.center].filter(Boolean))].join(" · ");previous.location=[...new Set([previous.location,target.location].filter(Boolean))].join(" · ");}
  else found.set(ip,target);
 }
 return [...found.values()];
}
