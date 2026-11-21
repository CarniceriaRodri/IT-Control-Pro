import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";

type DefenderState = {supported:boolean;available:boolean;active:boolean;mode:string|null;startedAt:string|null;finishedAt:string|null;exitCode:number|null;message:string;output:string;detections:{eventId:number;time:string;name:string;path:string;severity:string;action:string;status:string}[]};
type Vuln = { id:string; date:string; desc:string; score:number|null; severity:string; source:string; tech:string };
const KEY = "itcp-vulnerability-feed-v1";
const TECHS = [
  {name:"PHP", query:"PHP"},
  {name:"Java / OpenJDK", query:"OpenJDK"},
  {name:"Nginx", query:"nginx"},
] as const;
const SEV = (s:string) => s==="CRITICAL" ? "Crítica" : s==="HIGH" ? "Alta" : s==="MEDIUM" ? "Media" : s==="LOW" ? "Baja" : "Sin puntuar";
const severityClass = (s:string) => s==="CRITICAL" ? "critical" : s==="HIGH" ? "high" : s==="MEDIUM" ? "medium" : "low";
function readCache():{items:Vuln[]; checked:string} {
  try { const v=JSON.parse(localStorage.getItem(KEY)||"{}"); return {items:Array.isArray(v.items)?v.items:[],checked:typeof v.checked==="string"?v.checked:""}; } catch { return {items:[],checked:""}; }
}
export function Vulnerabilities() {
  const [items,setItems]=useState<Vuln[]>(()=>readCache().items);
  const [checked,setChecked]=useState(()=>readCache().checked);
  const [tech,setTech]=useState("Todas");
  const [severity,setSeverity]=useState("Todas");
  const [query,setQuery]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [defender,setDefender]=useState<DefenderState|null>(null);
  const [defenderBusy,setDefenderBusy]=useState(false);
  const [defenderError,setDefenderError]=useState("");
  const [scanMode,setScanMode]=useState("quick");
  const [scanPath,setScanPath]=useState("");
  const loadDefender=useCallback(async()=>{
    try {
      const response=await fetch("/api/antivirus/status",{cache:"no-store"});
      if(!response.ok)throw new Error("Servidor local no disponible");
      setDefender(await response.json());
    } catch {
      setDefender({supported:false,available:false,active:false,mode:null,startedAt:null,finishedAt:null,exitCode:null,message:"El análisis real requiere IT Control Pro ejecutándose en Windows con INICIAR-PYTHON.bat. Desde Android o una web alojada no se puede inspeccionar el dispositivo.",output:"",detections:[]});
    }
  },[]);
  useEffect(()=>{void loadDefender();},[loadDefender]);
  useEffect(()=>{
    if(!defender?.active)return;
    const timer=window.setInterval(()=>void loadDefender(),4000);
    return()=>window.clearInterval(timer);
  },[defender?.active,loadDefender]);
  const startDefenderScan=async()=>{
    setDefenderBusy(true);setDefenderError("");
    try {
      const response=await fetch("/api/antivirus/scan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode:scanMode,path:scanMode==="custom"?scanPath:undefined})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"No se pudo iniciar el análisis.");
      setDefender(data);window.setTimeout(()=>void loadDefender(),1200);
    } catch(e) {setDefenderError(String(e));}
    finally {setDefenderBusy(false);}
  };

  const refresh=useCallback(async()=>{
    if(busy)return;
    setBusy(true);setError("");
    const end=new Date(), start=new Date(end.getTime()-60*24*60*60*1000);
    const found:Vuln[]=[];
    try {
      for(const t of TECHS) {
        const url=new URL("https://services.nvd.nist.gov/rest/json/cves/2.0");
        url.searchParams.set("keywordSearch",t.query);
        url.searchParams.set("pubStartDate",start.toISOString());
        url.searchParams.set("pubEndDate",end.toISOString());
        url.searchParams.set("resultsPerPage","30");
        url.searchParams.set("sortBy","published");
        url.searchParams.set("sortOrder","DESC");
        const response=await fetch(url.toString(),{headers:{Accept:"application/json"}});
        if(!response.ok)throw new Error("NVD respondió HTTP "+response.status);
        const data=await response.json();
        for(const item of data.vulnerabilities||[]) {
          const c=item.cve||{}, id=String(c.id||"");
          const desc=(c.descriptions||[]).find((d:{lang:string})=>d.lang==="en")?.value||(c.descriptions||[])[0]?.value||"Descripción no disponible.";
          const metrics=c.metrics||{}, metric=metrics.cvssMetricV40?.[0]||metrics.cvssMetricV31?.[0]||metrics.cvssMetricV30?.[0]||metrics.cvssMetricV2?.[0];
          const cvss=metric?.cvssData;
          found.push({id,date:c.published||"",desc,score:typeof cvss?.baseScore==="number"?cvss.baseScore:null,severity:String(cvss?.baseSeverity||metric?.baseSeverity||"").toUpperCase(),source:"NVD · NIST",tech:t.name});
        }
      }
      const merged=new Map<string,Vuln>();
      [...readCache().items,...found].forEach(v=>{const prior=merged.get(v.id);merged.set(v.id,prior?{...prior,tech:[...new Set((prior.tech+" / "+v.tech).split(" / "))].join(" / ")}:v);});
      const next=[...merged.values()].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,500);
      const stamp=new Date().toISOString(); localStorage.setItem(KEY,JSON.stringify({items:next,checked:stamp}));
      setItems(next);setChecked(stamp);
    } catch(e) { setError("No se pudieron actualizar los datos. Comprueba la conexión y vuelve a intentarlo. "+String(e)); }
    finally { setBusy(false); }
  },[busy]);
  useEffect(()=>{ if(!checked || Date.now()-Date.parse(checked)>24*60*60*1000) void refresh(); },[]);
  const filtered=useMemo(()=>items.filter(v=>(tech==="Todas"||v.tech.toLowerCase().includes(tech.toLowerCase()))&&(severity==="Todas"||SEV(v.severity)===severity)&&(!query||(`${v.id} ${v.desc} ${v.tech}`).toLowerCase().includes(query.toLowerCase()))),[items,tech,severity,query]);
  const sourceLinks=[
    ["PHP · avisos de seguridad","https://www.php.net/releases/"],
    ["Java / OpenJDK · avisos","https://openjdk.org/groups/vulnerability/advisories/"],
    ["Nginx · avisos de seguridad","https://nginx.org/en/security_advisories.html"],
    ["CISA · vulnerabilidades explotadas (KEV)","https://www.cisa.gov/known-exploited-vulnerabilities-catalog"],
  ];
  return <section aria-label="Centro de vulnerabilidades" className="vulnPanel">
    <div className="vulnHead"><div><h2><ShieldAlert size={22}/> Seguimiento de vulnerabilidades</h2><p>Alertas recientes para PHP, Java / OpenJDK y Nginx, con consulta al NVD y enlaces a los avisos originales.</p></div>
      <button className="primary" onClick={()=>void refresh()} disabled={busy}><RefreshCw size={16} className={busy?"spin":""}/>{busy?"Actualizando…":"Actualizar ahora"}</button></div>
    <div className="vulnNotice"><ShieldCheck size={18}/><span><strong>Monitor informativo, no antivirus.</strong> Recopila avisos; no analiza ni limpia este dispositivo. Confirma siempre la versión afectada y la corrección en el fabricante.</span></div>
    <section className="defenderCard" aria-label="Análisis local de Microsoft Defender">
      <div className="defenderTitle"><div><h3><ShieldCheck size={19}/> Antivirus local de Windows</h3><p>Ejecuta Microsoft Defender en este equipo. Defender aplica la respuesta configurada en Windows; IT Control Pro no borra archivos directamente.</p></div>
        <span className={defender?.active?"defenderState running":defender?.available?"defenderState ready":"defenderState unavailable"}>{defender?.active?"Analizando":defender?.available?"Defender disponible":"Solo Windows local"}</span></div>
      <div className="defenderControls">
        <label>Tipo de análisis<select value={scanMode} onChange={e=>setScanMode(e.target.value)} disabled={defender?.active}>
          <option value="quick">Rápido</option><option value="full">Completo</option><option value="custom">Archivo o carpeta</option>
        </select></label>
        {scanMode==="custom"&&<label className="defenderPath">Ruta local de Windows<input value={scanPath} onChange={e=>setScanPath(e.target.value)} placeholder="C:\Users\tu_usuario\Downloads" disabled={defender?.active}/></label>}
        <button className="primary" onClick={()=>void startDefenderScan()} disabled={!defender?.available||defender.active||defenderBusy||(scanMode==="custom"&&!scanPath.trim())}>{defenderBusy?"Iniciando…":defender?.active?"Análisis en curso…":"Iniciar análisis"}</button>
      </div>
      {defender?.message&&<p className="defenderMessage" role="status">{defender.message}</p>}
      {defenderError&&<p className="vulnError" role="alert">{defenderError}</p>}
      {!!defender?.detections?.length&&<div className="defenderDetections"><strong>Detecciones registradas por Defender</strong>{defender.detections.map((d,i)=><div className="defenderDetection" key={d.eventId+"-"+d.time+"-"+i}><b>{d.name}</b><span>{d.severity||"Gravedad no indicada"} · Evento {d.eventId===1116?"detección":"acción"} · {new Date(d.time).toLocaleString("es-ES")}</span>{d.path&&<code>{d.path}</code>}{d.action&&<span>Acción de Defender: {d.action}</span>}{d.status&&<span>{d.status}</span>}</div>)}</div>}
      {defender?.finishedAt&&<details className="defenderLog"><summary>Ver salida técnica de Defender</summary><pre>{defender.output||"Defender no devolvió texto adicional."}</pre></details>}
      <small>Si aparece una detección o acción pendiente, revisa en Windows: Seguridad de Windows → Protección contra virus y amenazas → Historial de protección.</small>
    </section>
    <div className="vulnSources">{sourceLinks.map(([label,href])=><a key={href} href={href} target="_blank" rel="noopener noreferrer">{label}<ExternalLink size={14}/></a>)}</div>
    <div className="vulnFilters">
      <label>Tecnología<select value={tech} onChange={e=>setTech(e.target.value)}><option>Todas</option>{TECHS.map(t=><option key={t.name}>{t.name}</option>)}</select></label>
      <label>Gravedad<select value={severity} onChange={e=>setSeverity(e.target.value)}>{["Todas","Crítica","Alta","Media","Baja","Sin puntuar"].map(x=><option key={x}>{x}</option>)}</select></label>
      <label className="vulnSearch">Buscar<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="CVE, producto o texto"/></label>
    </div>
    <p className="vulnMeta">{checked?"Última consulta correcta: "+new Date(checked).toLocaleString("es-ES"):"Aún no hay datos guardados"} · {filtered.length} avisos mostrados · historial acumulado en este dispositivo</p>
    {error&&<p role="alert" className="vulnError">{error}</p>}
    {!filtered.length&&!busy&&<div className="vulnEmpty"><ShieldAlert/><strong>{items.length?"No hay coincidencias con esos filtros":"Pulsa «Actualizar ahora» para cargar los avisos recientes."}</strong></div>}
    <div className="vulnList">{filtered.slice(0,100).map(v=><article className="vulnCard" key={v.id}><div className="vulnCardTop"><a href={`https://nvd.nist.gov/vuln/detail/${encodeURIComponent(v.id)}`} target="_blank" rel="noopener noreferrer">{v.id}<ExternalLink size={13}/></a><span className={"severity "+severityClass(v.severity)}>{SEV(v.severity)}{v.score!==null?" · "+v.score:""}</span></div><p>{v.desc}</p><small>{v.tech} · {v.date?new Date(v.date).toLocaleDateString("es-ES"):"Fecha pendiente"} · {v.source}</small></article>)}</div>
    <p className="vulnFooter">Fuente de datos: <a href="https://nvd.nist.gov/developers/vulnerabilities" target="_blank" rel="noopener noreferrer">NVD API 2.0 (NIST)</a>. Se consultan los últimos 60 días al actualizar; los resultados se conservan localmente hasta un máximo de 500.</p>
  </section>;
}
