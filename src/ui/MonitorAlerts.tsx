import { useEffect, useState } from "react";
import { AlertTriangle, Activity } from "lucide-react";

type Host={ip:string;device:string;center:string;status:string;at?:string};
type Reply={running:boolean;hosts:Host[]};
const python=location.port==="8788"&&["localhost","127.0.0.1"].includes(location.hostname);
export function MonitorAlerts({open}:{open:()=>void}){
 const [data,setData]=useState<Reply|null>(null);
 useEffect(()=>{
  if(!python)return;
  let alive=true;
  const check=async()=>{
   try{const response=await fetch("/api/monitor/status",{cache:"no-store"});
    if(!response.ok)return;
    const next:Reply=await response.json();
    if(alive)setData(next);
   }catch{/* Estado del servidor temporalmente no disponible. */}
  };
  void check();
  const timer=setInterval(()=>void check(),15000);
  return()=>{alive=false;clearInterval(timer)};
 },[]);
 if(!python||!data)return null;
 const down=data.hosts.filter(h=>h.status==="alert");
 const warnings=data.hosts.filter(h=>h.status==="suspect");
 return <section className="monitorAlerts" aria-label="Avisos de conectividad">
  <div className="inline"><Activity size={18}/><h2>Estado de redes</h2></div>
  <p>{data.running?"Monitor Python activo":"Monitor detenido"} · {data.hosts.length} dispositivos configurados · {down.length} sin respuesta · {warnings.length} en comprobación.</p>
  {down.length>0&&<div className="networkMonitorAlertsList">
   {down.slice(0,8).map(h=><div key={h.ip}><AlertTriangle size={18}/><span><strong>{h.device||h.ip}</strong> · {h.ip} · {h.center}</span></div>)}
   {down.length>8&&<small>Hay {down.length-8} avisos más.</small>}
  </div>}
  <button type="button" onClick={open}>Abrir centro de monitorización</button>
 </section>;
}