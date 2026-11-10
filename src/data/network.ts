import type { Repository, Snapshot } from "./repository";
import type { Dataset } from "../domain/model";
import type { Binaries } from "./media";
import type { Retention, RestorePoint } from "./periods";
async function api<T>(route: string, data?: unknown): Promise<T> {
  const res=await fetch("/api/"+route,{
    method:data===undefined?"GET":"POST",
    headers:data===undefined?{}:{"Content-Type":"application/json"},
    body:data===undefined?undefined:JSON.stringify(data),
    cache:"no-store",
  });
  if(!res.ok) {
    const error=await res.json().catch(()=>({error:res.statusText}));
    throw Error(String(error.error||"Error de servidor "+res.status));
  }
  return res.json();
}
async function encode(blob:Blob):Promise<string>{
  const buffer=await blob.arrayBuffer();
  const bytes=new Uint8Array(buffer);
  // Avoid call-stack overflow when importing files close to the 10 MB limit.
  let binary="";
  for(let i=0;i<bytes.length;i+=8192)
    binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(binary);
}
export async function openNetworkRepository():Promise<Repository>{
  const health=await api<{mode:string}>("health");
  if(health.mode!=="windows-server")throw Error("Servidor incompatible");
  return {
    read:()=>api<Snapshot>("state"),
    file:async(hash)=>{
      if(!/^[a-f0-9]{64}$/.test(hash))return undefined;
      const res=await fetch("/api/file/"+hash,{cache:"no-store"});
      if(res.status===404)return undefined;
      if(!res.ok)throw Error("No se pudo recuperar el archivo");
      return res.blob();
    },
    points:()=>api<RestorePoint[]>("points"),
    point:async()=>undefined,
    retention:()=>api<Retention>("retention"),
    setRetention:async(value)=>{await api("retention",value)},
    tick:async()=>{},
    recovery:()=>api<Dataset|undefined>("recovery"),
    commit:async(version,action,target,change,checkpoint=false,files:Binaries=new Map())=>{
      const snapshot=await api<Snapshot>("state");
      if(snapshot.version!==version)throw Error("Otro usuario ha guardado cambios. Actualiza la página antes de continuar.");
      const draft:Dataset=structuredClone(snapshot.data);
      change(draft);
      const payload:Record<string,string>={};
      for(const [hash,blob] of files)payload[hash]=await encode(blob);
      await api("commit",{version,action,target,data:draft,checkpoint,files:payload});
    },
  };
}
