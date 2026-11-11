import { useEffect, useMemo, useState } from "react";
import type { Dataset, Entity } from "../domain/model";
import { downloadBlob } from "../data/media";
import { Activity, Download, RefreshCw } from "lucide-react";

type Target={ip:string;device:string;center:string;ports:number[]};
type Host=Target&{status:"pending"|"online"|"tcp"|"alert"|"suspect"|"error";detail?:string;ms?:number|null;at?:string;failCount?:number};
type MonitorEvent={ip:string;at:string;kind:string;from:string;to:string};
type Status={running:boolean;intervalSeconds:number;failureThreshold:number;hosts:Host[];events:MonitorEvent[];lastCycle:string|null;nextCycle:string|null;message:string};
const isWindowsPython=location.port==="8788" && ["localhost","127.0.0.1"].includes(location.hostname);
const ipValid=(v:string)=>{const a=v.trim().split(".");return a.length===4&&a.every(s=>/^(0|[1-9]\d{0,2})$/.test(s)&&Number(s)<256)&&!["127","0","224","239","240","255"].includes(a[0]);};
const norm=(v:unknown)=>String(v??"").trim();
const normalizeHeader=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const ipCandidates=["ip","ipprincipal","direccionip","direccionipv4","ipv4"];
function readIP(row:Entity,data:Dataset): string {
 const fields=data.modules.find(m=>m.id===row.module)?.fields||[];
 const candidate=fields.filter(f=>ipCandidates.includes(normalizeHeader(f.id))||ipCandidates.includes(normalizeHeader(f.label))||f.type==="IP");
 for(const f of candidate){const value=norm(row.values[f.id]);if(ipValid(value))return value;}
 for(const [key,v] of Object.entries(row.values)){if(ipCandidates.includes(normalizeHeader(key)) && ipValid(norm(v)))return norm(v);}
 return "";
}
function readDetail(row:Entity,data:Dataset):Target|null{
 const ip=readIP(row,data);
 if(!ip)return null;
 const values=row.values;
 const first=(keys:string[])=>{
  for(const key of keys){
   const f=data.modules.find(m=>m.id===row.module)?.fields.find(f=>normalizeHeader(f.id)===key||normalizeHeader(f.label)===key);
   const found=norm(values[f?.id||key]);
   if(found)return found;
  }
  return "";
 };
 return {ip,device:first(["dispositivo","equipo","nombre","modelo","impresora","descripcion","serie"])||ip,
  center:first(["centro","ubicacion","sede","localizacion"])||row.module,
  ports:row.module==="Inventario"?[80,443,9100]:[80,443,9100]};
}
function displayDate(v?:string|null){return v?new Date(v).toLocaleString("es-ES"):"—";}
async function api<T>(action:string,payload?:unknown):Promise<T>{
 const res=await fetch("/api/monitor/"+action,{method:payload===undefined?"GET":"POST",
  headers:payload===undefined?{}:{"Content-Type":"application/json"},
  body:payload===undefined?undefined:JSON.stringify(payload),cache:"no-store"});
 const json=await res.json().catch(()=>({error:"La respuesta no es JSON"}));
 if(!res.ok)throw Error(String(json.error||"Error de monitorización"));
 return json as T;
}
const statusLabel:Record<Host["status"],string>={pending:"Pendiente",online:"ONLINE",tcp:"PING bloqueado / TCP accesible",alert:"SIN RESPUESTA",suspect:"Fallo transitorio",error:"Error"};
const statusColor:Record<Host["status"],string>={pending:"#7b8492",online:"#159967",tcp:"#bb8500",alert:"#c83f42",suspect:"#d48b1f",error:"#c83f42"};
export function NetworkMonitor({data}:{data:Dataset}) {
 const candidates=useMemo(()=>{
  const found=new Map<string,Target>();
  for(const row of data.records){
   if(row.archived)continue;
   const target=readDetail(row,data);
   if(target&&!found.has(target.ip))found.set(target.ip,target);
  }
  return [...found.values()];
 },[data]);
 const [status,setStatus]=useState<Status|null>(null);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const [interval,setIntervalSeconds]=useState(120);
 const [failures,setFailures]=useState(3);
 const [selection,setSelection]=useState<string[]>([]);
 const [filter,setFilter]=useState("");
 const [showAll,setShowAll]=useState(false);
 const [ready,setReady]=useState(false);
 const refresh=async()=>{
  const result=await api<Status>("status");
  setStatus(result);
  if(!ready){setIntervalSeconds(result.intervalSeconds);setFailures(result.failureThreshold);setSelection(result.hosts.map(h=>h.ip));setReady(true);}
 };
 useEffect(()=>{
  if(!isWindowsPython)return;
  let live=true;
  const poll=async()=>{try{const next=await api<Status>("status");if(live)setStatus(next);}catch(e){if(live)setError(String(e));}};
  void poll();
  const id=window.setInterval(()=>void poll(),10000);
  return()=>{live=false;clearInterval(id);};
 },[]);
 useEffect(()=>{
  if(status&&!ready){setIntervalSeconds(status.intervalSeconds);setFailures(status.failureThreshold);setSelection(status.hosts.map(h=>h.ip));setReady(true);}
 },[status,ready]);
 const act=async(action:"configure"|"start"|"stop"|"run")=>{
  if(busy)return;
  setBusy(true);setError("");
  try{
   if(action==="configure"){
    const existing=new Map(status?.hosts.map(h=>[h.ip,h])||[]);
    const available=new Map(candidates.map(h=>[h.ip,h]));
    const targets=selection.map(ip=>available.get(ip)||existing.get(ip)).filter((x):x is Target=>!!x);
    const updated=await api<Status>("configure",{targets,intervalSeconds:interval,failureThreshold:failures});
    setStatus(updated);
   }else setStatus(await api<Status>(action,{}));
  }catch(e){setError(String(e));}
  finally{setBusy(false);}
 };
 const rows=(status?.hosts||[]).filter(h=>showAll||h.status==="alert"||h.status==="suspect");
 const filtered=rows.filter(h=>[h.ip,h.device,h.center].some(v=>v.toLocaleLowerCase().includes(filter.toLocaleLowerCase())));
 const count=(s:Host["status"])=>status?.hosts.filter(h=>h.status===s).length||0;
 const [notify,setNotify]=useState(false);
 useEffect(()=>{
  if(!notify||!status||!("Notification" in window)||Notification.permission!=="granted")return;
  // Notificaciones solo para eventos recientes, nunca repetir histórico al abrir.
  const recent=status.events.filter(e=>Date.now()-Date.parse(e.at)<15000 && e.kind==="caida");
  for(const e of recent){
   const key="it-monitor-notification-"+e.ip+"-"+e.at;
   if(sessionStorage.getItem(key))continue;
   sessionStorage.setItem(key,"1");
   try{new Notification("IT Control Pro · Equipo sin respuesta",{body:e.ip,tag:key});}catch{}
  }
 },[status,notify]);
 const report=()=>[
  "IT Control Pro - Monitorizacion",new Date().toISOString(),
  ...(status?.hosts||[]).map(h=>[h.ip,h.device,h.center,statusLabel[h.status],h.at||""].join(";")),
  "EVENTOS",...(status?.events||[]).map(e=>[e.at,e.ip,e.kind,e.from,e.to].join(";"))
 ].join("\n");
 return <section className="networkMonitor" aria-label="Centro de monitorización">
  <div className="inline"><Activity size={20}/><h2>Centro de monitorización</h2></div>
  {!isWindowsPython? <p role="status">La monitorización real necesita el servidor Python local en http://127.0.0.1:8788/. La web estática y Android pueden consultar datos de inventario, pero no ejecutar ping ICMP en el navegador.</p>:<>
   <p>Se vigilan únicamente las IP que selecciones y guardes. El servicio hace ping y, si falla, comprueba puertos TCP autorizados. Los sondeos continúan aunque cierres la pestaña, mientras permanezca abierto el servidor Python.</p>
   <div className="networkMonitorStats">
    {([["Equipos",status?.hosts.length||0],["ONLINE",count("online")],["TCP accesible",count("tcp")],["SIN RESPUESTA",count("alert")],["Pendientes",count("pending")+count("suspect")]] as const).map(([label,value])=><div key={label}><small>{label}</small><strong>{value}</strong></div>)}
   </div>
   <div className="inline">
    <strong>Servicio: {status?.running?"Activo":"Detenido"}</strong>
    <button type="button" disabled={busy} onClick={()=>void act("start")}>Iniciar</button>
    <button type="button" disabled={busy||!status?.running} onClick={()=>void act("stop")}>Detener</button>
    <button type="button" disabled={busy} onClick={()=>void act("run")}><RefreshCw size={15}/> Comprobar ahora</button>
   </div>
   <small>Última ronda: {displayDate(status?.lastCycle)} · Próxima: {displayDate(status?.nextCycle)}</small>
   <details className="networkMonitorConfig">
    <summary>Seleccionar equipos e intervalo de monitorización ({candidates.length} IP detectadas)</summary>
    <p>Detectadas automáticamente en los campos IP de Redes, Inventario y otros módulos, incluso si proceden de importaciones CSV/Calc. Evita activar dispositivos no autorizados.</p>
    <div className="inline">
      <label>Intervalo
       <select value={interval} onChange={e=>setIntervalSeconds(Number(e.target.value))}>
        {[30,60,120,300,600].map(v=><option key={v} value={v}>{v<60?v+" segundos":v/60+" minutos"}</option>)}
       </select>
      </label>
      <label>Avisar tras fallos
       <select value={failures} onChange={e=>setFailures(Number(e.target.value))}>
        {[1,2,3,5].map(v=><option key={v} value={v}>{v}</option>)}
       </select>
      </label>
    </div>
    <div className="inline">
     <button type="button" onClick={()=>setSelection(candidates.slice(0,250).map(x=>x.ip))}>Seleccionar IP disponibles</button>
     <button type="button" onClick={()=>setSelection([])}>Quitar selección</button>
    </div>
    <div className="networkMonitorSelect">
     {candidates.slice(0,250).map(t=><label key={t.ip}>
       <input type="checkbox" checked={selection.includes(t.ip)} onChange={e=>setSelection(before=>e.target.checked?[...before,t.ip]:before.filter(x=>x!==t.ip))}/>
       <span>{t.device} · {t.ip} · {t.center}</span>
     </label>)}
     {!candidates.length&&<p>No se han encontrado campos de IP válidos en los registros de la aplicación.</p>}
     {candidates.length>250&&<small>Se muestran las primeras 250 IP. Ampliaremos el motor por lotes cuando sea necesario.</small>}
    </div>
    <button type="button" className="primary" disabled={busy} onClick={()=>void act("configure")}>Guardar equipos seleccionados y ajustes</button>
   </details>
   <div className="inline">
    <label><input type="checkbox" checked={showAll} onChange={e=>setShowAll(e.target.checked)}/> Ver también equipos disponibles</label>
    <input aria-label="Filtrar equipos monitorizados" placeholder="Buscar IP, nombre o centro" value={filter} onChange={e=>setFilter(e.target.value)}/>
    <button type="button" onClick={()=>downloadBlob(new Blob([report()],{type:"text/plain;charset=utf-8"}),"monitor-it-control-pro.txt")}><Download size={15}/> Exportar</button>
    <button type="button" onClick={async()=>{if(!("Notification" in window))return;const allowed=await Notification.requestPermission();setNotify(allowed==="granted");}}>Avisos de Windows</button>
   </div>
   <div className="tableScroll"><table><thead><tr><th>IP</th><th>Equipo / centro</th><th>Estado</th><th>Última prueba</th><th>Detalle</th></tr></thead><tbody>
    {filtered.map(h=><tr key={h.ip}>
     <td>{h.ip}</td><td>{h.device}<br/><small>{h.center}</small></td>
     <td><strong style={{color:statusColor[h.status]}}>{statusLabel[h.status]}</strong></td>
     <td>{displayDate(h.at)}</td><td>{h.detail||"Sin comprobación"}</td>
    </tr>)}
   </tbody></table>{!filtered.length&&<p>No hay equipos que coincidan con este filtro.</p>}</div>
   <details><summary>Historial de cambios ({status?.events.length||0})</summary>
    <div className="tableScroll"><table><thead><tr><th>Fecha</th><th>IP</th><th>Evento</th></tr></thead><tbody>
     {(status?.events||[]).map((e,i)=><tr key={e.at+e.ip+i}><td>{displayDate(e.at)}</td><td>{e.ip}</td><td>{e.kind}</td></tr>)}
    </tbody></table></div>
   </details>
   {error&&<p role="alert">{error}</p>}
   <small>Una IP sin respuesta ICMP y TCP no demuestra que esté apagada: puede haber filtros de red. Monitor local experimental, no sustituye Zabbix ni un servicio corporativo aprobado.</small>
  </>}
 </section>;
}
