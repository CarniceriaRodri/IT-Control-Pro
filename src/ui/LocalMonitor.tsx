import { useEffect, useState } from "react";
type Host={ip:string;ok:boolean|null;detail:string;at:string|null};
type Event={ip:string;at:string;kind:string};
type Status={running:boolean;intervalSeconds:number;hosts:Host[];events:Event[];message:string};
export function LocalMonitor({defaultIp}:{defaultIp:string}){
 const [status,setStatus]=useState<Status|null>(null);
 const [ip,change]=useState(defaultIp);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 async function request(action="status",body:object={}){
  const res=await fetch("/api/monitor/"+action,{
   method:action==="status"?"GET":"POST",
   ...(action==="status"?{}:{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}),
   cache:"no-store"
  });
  const result=await res.json();
  if(!res.ok)throw Error(result.error||"No se pudo consultar el monitor.");
  setStatus(result as Status);
 }
 useEffect(()=>{
  let live=true;
  const fetchStatus=()=>{fetch("/api/monitor/status",{cache:"no-store"}).then(r=>r.json()).then(x=>{if(live)setStatus(x)}).catch(()=>{})};
  fetchStatus();
  const timer=setInterval(fetchStatus,15000);
  return ()=>{live=false;clearInterval(timer)};
 },[]);
 async function action(kind:string,value:object={}){
  if(busy)return;setBusy(true);setError("");
  try{await request(kind,value)}catch(e){setError(String(e))}
  finally{setBusy(false)}
 }
 return <div className="localMonitor" aria-label="Monitor local de Windows">
  <div className="inline"><h3>Monitor local de dispositivos</h3><span>{status?.running?"Activo":"Detenido"}</span></div>
  <p>Hasta diez IP privadas autorizadas. Un sondeo cada dos minutos desde el servicio Windows, solo mientras esté ejecutándose. No se hacen barridos de red.</p>
  <div className="inline"><input aria-label="IP privada para monitorizar" value={ip} onChange={e=>change(e.target.value)} placeholder="10.1.2.3" inputMode="decimal"/>
   <button disabled={busy} type="button" onClick={()=>void action("add",{ip})}>Añadir IP</button>
   <button className="primary" disabled={busy||!status?.hosts.length||status.running} type="button" onClick={()=>void action("start")}>Iniciar</button>
   <button disabled={busy||!status?.running} type="button" onClick={()=>void action("stop")}>Detener</button>
  </div>
  {status?.hosts.length?<div className="tableScroll"><table><thead><tr><th>IP</th><th>Resultado</th><th>Última comprobación</th><th></th></tr></thead>
   <tbody>{status.hosts.map(h=><tr key={h.ip}><td>{h.ip}</td><td>{h.ok===null?"Pendiente":h.ok?"Responde":"No responde"}</td><td>{h.at?new Date(h.at).toLocaleString("es-ES"):"—"}</td>
    <td><button disabled={busy} type="button" onClick={()=>void action("remove",{ip:h.ip})}>Quitar</button></td></tr>)}</tbody></table></div>:<p>No hay IP registradas.</p>}
  {!!status?.events.length&&<details><summary>Historial de cambios ({status.events.length})</summary>
   <ul>{status.events.map((e,i)=><li key={i}>{new Date(e.at).toLocaleString("es-ES")} · {e.ip} · {e.kind}</li>)}</ul></details>}
  {error&&<p role="alert">{error}</p>}
  <small>No incluye notificaciones de Windows ni Android. Al reiniciar el servidor, hay que activar el monitor de nuevo.</small>
 </div>;
}
