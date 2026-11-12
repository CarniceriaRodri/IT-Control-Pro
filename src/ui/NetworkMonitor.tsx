import { useEffect, useMemo, useState } from "react";
import { uid, type Dataset, type Entity } from "../domain/model";
import { networkTargets, type Target } from "../data/network-targets";
import { DataTable } from "./DataTable";
import { Dialog } from "./Fields";
import type { Write } from "./Admin";
import { downloadBlob } from "../data/media";
import { writeCsv } from "../data/calc";
type Host=Target&{status:string;detail?:string;at?:string;ms?:number;failCount?:number};
type Event={ip:string;at:string;kind:string};
type Status={running:boolean;hosts:Host[];events:Event[];lastCycle:string;nextCycle:string;completed:number;total:number;intervalSeconds:number;failureThreshold:number};
type Policy={intervalSeconds:number;failureThreshold:number;ports:string;start:number;end:number};
const defaults:Policy={intervalSeconds:120,failureThreshold:3,ports:"80,443,9100",start:0,end:24};
const local=location.port==="8788"&&["localhost","127.0.0.1"].includes(location.hostname);
const labels:Record<string,string>={online:"Conectados",tcp:"TCP accesible",alert:"Sin respuesta",suspect:"Fallo transitorio",pending:"Pendientes",error:"Error",excluded:"Excluidos"};
async function api<T>(action:string,payload?:unknown):Promise<T>{const r=await fetch("/api/monitor/"+action,{method:payload===undefined?"GET":"POST",headers:payload===undefined?{}:{"Content-Type":"application/json"},body:payload===undefined?undefined:JSON.stringify(payload),cache:"no-store"});const d=await r.json();if(!r.ok)throw Error(d.error||"Error del monitor");return d;}
export function NetworkMonitor({data,write}:{data:Dataset;write:Write}){
 const candidates=useMemo(()=>networkTargets(data),[data]);
 const [status,setStatus]=useState<Status|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[group,setGroup]=useState("*"),[state,setState]=useState("all"),[filter,setFilter]=useState(""),[selection,select]=useState<string[]>([]),[initialized,init]=useState(false),[detail,show]=useState<Host|null>(null);
 const [policies,setPolicies]=useState<Record<string,Policy>>(()=>{try{return JSON.parse(localStorage.getItem("it-network-policies")||"{}");}catch{return {};}});
 const policy=policies[group]||defaults;
 const change=(value:Policy)=>{const next={...policies,[group]:value};setPolicies(next);localStorage.setItem("it-network-policies",JSON.stringify(next));};
 useEffect(()=>{if(!local)return;let live=true;const poll=async()=>{try{const value=await api<Status>("status");if(live){setStatus(value);setError("");}}catch(e){if(live)setError(String(e));}};void poll();const id=setInterval(()=>void poll(),3000);return()=>{live=false;clearInterval(id);};},[]);
 useEffect(()=>{if(status&&!initialized){select(status.hosts.map(h=>h.ip));init(true);}},[status,initialized]);
 const hosts:Host[]=candidates.map(t=>({...t,...status?.hosts.find(h=>h.ip===t.ip),groups:t.groups,recordIds:t.recordIds,location:t.location,center:t.center,status:status?.hosts.find(h=>h.ip===t.ip)?.status||"excluded"}));
 for(const h of status?.hosts||[])if(!hosts.some(x=>x.ip===h.ip))hosts.push({...h,groups:h.groups||["Sin grupo"],recordIds:h.recordIds||[]});
 const groups=[...new Set(hosts.flatMap(h=>h.groups))];
 const scoped=hosts.filter(h=>group==="*"||h.groups.includes(group));
 const filtered=scoped.filter(h=>(state==="all"||h.status===state)&&[h.ip,h.device,h.center,h.location].join(" ").toLowerCase().includes(filter.toLowerCase()));
 const name=(id:string)=>data.modules.find(m=>m.id===id)?.name||id;
 const action=async(kind:string)=>{setBusy(true);setError("");try{
  if(kind==="configure"){
   const targets=candidates.filter(t=>selection.includes(t.ip)).map(t=>{
    const activePolicy=policies[t.groups.find(g=>policies[g])||""]||policies["*"]||defaults;
    const ports=activePolicy.ports.split(",").filter(x=>x.trim()).map(Number);
    return {...t,ports,intervalSeconds:activePolicy.intervalSeconds,failureThreshold:activePolicy.failureThreshold,schedule:{start:activePolicy.start,end:activePolicy.end}};
   });setStatus(await api<Status>(kind,{targets,intervalSeconds:120,failureThreshold:3}));
  }else setStatus(await api<Status>(kind,{}));
 }catch(e){setError(String(e));}finally{setBusy(false);}};
 const openGroup=(id:string,s="all")=>{setGroup(id);setState(s);};
 const incident=async(h:Host)=>{try{const id=uid();await write("Incidencia desde monitor",id,d=>{d.records.push({id,module:"Incidencias",rev:1,archived:false,values:{"número":"RED-"+Date.now(),asunto:"Sin respuesta: "+h.device,centro:h.center,estado:"Pendiente",prioridad:"Media",descripcion:[h.ip,h.location,h.detail].filter(Boolean).join(" · ")}});});setError("Incidencia creada con la IP y ubicación.");}catch(e){setError(String(e));}};
 return <section aria-label="Centro de monitorización"><h2>Redes por grupos</h2>
 <div className="networkGroups">{["*",...groups].map(id=>{const list=id==="*"?hosts:hosts.filter(h=>h.groups.includes(id));const online=list.filter(h=>["online","tcp"].includes(h.status)).length;const alerts=list.filter(h=>h.status==="alert").length;const n=list.length||1;return <div className="networkGroup" key={id}><button className="networkRing" aria-label={"Ver "+(id==="*"?"todos":name(id))} style={{background:`conic-gradient(#159967 ${online/n*100}%,#c83f42 0 ${(online+alerts)/n*100}%,#a1aab8 0)`}} onClick={()=>openGroup(id)}><span>{list.length}</span></button><button onClick={()=>openGroup(id)}><strong>{id==="*"?"Todos los dispositivos":name(id)}</strong></button>{Object.entries(labels).map(([s,label])=><button key={s} onClick={()=>openGroup(id,s)}>{label}: {list.filter(h=>h.status===s).length}</button>)}</div>;})}</div>
 <div className="inline"><label>Grupo <select value={group} onChange={e=>openGroup(e.target.value)}><option value="*">Todos</option>{groups.map(g=><option key={g} value={g}>{name(g)}</option>)}</select></label><label>Estado <select value={state} onChange={e=>setState(e.target.value)}><option value="all">Todos</option>{Object.entries(labels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><input aria-label="Buscar equipos de red" placeholder="IP, equipo, centro o ubicación" value={filter} onChange={e=>setFilter(e.target.value)}/><button onClick={()=>downloadBlob(writeCsv(["IP","Dispositivo","Centro","Ubicación","Estado"],filtered.map(h=>[h.ip,h.device,h.center,h.location,labels[h.status]||h.status])),"redes.csv")}>Exportar vista</button></div>
 {!local?<p>Las comprobaciones reales requieren el servidor Python de Windows. Puedes consultar aquí todos los grupos y ubicaciones.</p>:<><div className="inline"><strong>Monitor {status?.running?"activo":"detenido"}</strong>{["start","stop","run"].map((a,i)=><button key={a} disabled={busy} onClick={()=>void action(a)}>{["Iniciar","Detener / Cancelar ronda","Comprobar ahora"][i]}</button>)}<span>Ronda: {status?.completed||0}/{status?.total||0}</span></div><p>Última ronda: {status?.lastCycle?new Date(status.lastCycle).toLocaleString("es-ES"):"Sin comprobar"}</p>
 <details><summary>Monitorización y selección del grupo ({scoped.length} dispositivos)</summary><p>Si una IP pertenece a varios grupos, se comprueba una sola vez; se aplica la primera política específica de sus grupos.</p><div className="inline"><label>Intervalo <select value={policy.intervalSeconds} onChange={e=>change({...policy,intervalSeconds:+e.target.value})}>{[30,60,120,300,600].map(n=><option key={n} value={n}>{n} segundos</option>)}</select></label><label>Fallos antes de avisar <select value={policy.failureThreshold} onChange={e=>change({...policy,failureThreshold:+e.target.value})}>{[1,2,3,5].map(n=><option key={n}>{n}</option>)}</select></label><label>Puertos TCP <input value={policy.ports} onChange={e=>change({...policy,ports:e.target.value})}/></label><label>Desde hora <input type="number" min="0" max="23" value={policy.start} onChange={e=>change({...policy,start:+e.target.value})}/></label><label>Hasta hora <input type="number" min="1" max="24" value={policy.end} onChange={e=>change({...policy,end:+e.target.value})}/></label></div><p>Puertos disponibles: 22, 80, 443, 445, 515, 631, 8080, 8443, 9100. Horario local del Windows.</p><button onClick={()=>select([...new Set([...selection,...scoped.map(h=>h.ip)])])}>Seleccionar grupo</button><button onClick={()=>select(selection.filter(ip=>!scoped.some(h=>h.ip===ip)))}>Excluir grupo</button><button disabled={busy} onClick={()=>void action("configure")}>Guardar selección y políticas</button></details></>}
 <DataTable id={"network-"+group} rows={filtered} rowKey={h=>h.ip} onOpen={show} columns={[
 {id:"selection",label:"Monitorizar",value:h=><input aria-label={"Monitorizar "+h.ip} type="checkbox" checked={selection.includes(h.ip)} onChange={e=>select(e.target.checked?[...selection,h.ip]:selection.filter(x=>x!==h.ip))}/>},
 {id:"ip",label:"IP",value:h=>h.ip},{id:"device",label:"Dispositivo",value:h=>h.device},{id:"center",label:"Centro",value:h=>h.center||"Sin especificar"},{id:"location",label:"Ubicación concreta",value:h=>h.location||"Sin especificar"},{id:"status",label:"Estado",value:h=>labels[h.status]||h.status},{id:"at",label:"Última prueba",value:h=>h.at?new Date(h.at).toLocaleString("es-ES"):"Sin comprobar"},{id:"actions",label:"Acciones",value:h=><><button onClick={()=>show(h)}>Ver ficha</button><button onClick={()=>void incident(h)}>Crear incidencia</button></>}]}/>
 {error&&<p role="status">{error}</p>}
 <details><summary>Historial de red</summary>{status?.events.map((e,i)=><p key={i}>{new Date(e.at).toLocaleString("es-ES")} · {e.ip} · {e.kind}</p>)}</details>
 {detail&&<Dialog name={detail.device+" · "+detail.ip} close={()=>show(null)}><p>{detail.center||"Centro sin especificar"} · {detail.location||"Ubicación sin especificar"}</p><p>{detail.detail}</p>{detail.recordIds.map(id=>{const row=data.records.find(r=>r.id===id);const mod=data.modules.find(m=>m.id===row?.module);return row&&mod?<div key={id}><h3>{mod.name}</h3>{row.source&&<p>Origen: {row.source.file} · {row.source.sheet} · {new Date(row.source.importedAt).toLocaleString("es-ES")}</p>}<dl className="deviceFacts">{mod.fields.map(f=><div key={f.id}><dt>{f.label}</dt><dd>{String(row.values[f.id]??"—")}</dd></div>)}</dl><p>Adjuntos: {row.files?.length||0}</p><h4>Registros relacionados</h4>{data.records.filter(r=>!r.archived&&r.id!==id&&Object.values(r.values).some(v=>v===id||(Array.isArray(v)&&v.includes(id)))).map(r=><p key={r.id}>{r.module}: {String(r.values.asunto||r.values.referencia||r.values.nombre||r.id)}</p>)}</div>:null;})}</Dialog>}
 </section>;
}
