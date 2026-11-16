import { field, uid, type Module } from "../domain/model";
export const locationHint="Edificio, planta, servicio y despacho o sala. Ejemplo: H3D · planta 2 · RR. HH. · despacho 214.";
const normalize=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const aliases=["ubicacionexacta","ubicacionconcreta","ubicacionfina","ubicacion","localizacionexacta","localizacion"];
export function exactLocationField(module:Module){
 for(const alias of aliases){const found=module.fields.find(f=>["texto","texto largo","autocompletado"].includes(f.type)&&(normalize(f.id)===alias||normalize(f.label)===alias));if(found)return found;}
 return undefined;
}
export function ensureExactLocation(module:Module){
 let existing=exactLocationField(module);
 if(!existing){existing={...field(module.fields.some(f=>f.id==="ubicacion")?uid():"ubicacion","Ubicación exacta"),hint:locationHint};module.fields.push(existing);}
 else if(["ubicacion","ubicacionconcreta"].includes(normalize(existing.label))&&["ubicacion","ubicacionexacta"].includes(normalize(existing.id))){existing.label="Ubicación exacta";existing.hint=existing.hint||locationHint;}
 return existing;
}
