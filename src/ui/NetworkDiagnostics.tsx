import { useState } from "react";
import { LocalMonitor } from "./LocalMonitor";
import { Activity, Wifi, Download, Network } from "lucide-react";
import { analyzeIPv4, ipv4Number, type IPv4Analysis } from "../data/ip-tools";
import { downloadBlob } from "../data/media";

type Result = {kind:string;ok:boolean;detail:string;host?:string;port?:number;ms?:number;interfaces?:Array<{adapter:string;ip:string;mask:string;mac:string}>;addresses?:string[]};
const windows = ["8787","8788"].includes(location.port) && ["localhost","127.0.0.1"].includes(location.hostname);
const ports=[22,80,443,445,515,631,8080,8443,9100];
function reportItem(r:Result) {
  const extra=r.interfaces?.map(x=>x.adapter+": "+x.ip+" / "+x.mask+" ("+x.mac+")").join("\n") || r.addresses?.join(", ") || "";
  return r.kind.toUpperCase()+" "+(r.host||"")+(r.port?":"+r.port:"")+
    "\n"+(r.ok?"Resultado correcto":"No confirmado")+"\n"+r.detail+
    (extra?"\n"+extra:"")+(r.ms===undefined?"":"\n"+r.ms+" ms");
}
export function NetworkDiagnostics({saved = []}:{saved?:Array<{ip:string;device:string}>}) {
  const [ip,setIp]=useState("192.168.1.10");
  const [mask,setMask]=useState("24");
  const [gateway,setGateway]=useState("");
  const [analysis,setAnalysis]=useState<IPv4Analysis|null>(null);
  const [dns,setDns]=useState("");
  const [port,setPort]=useState(443);
  const [results,setResults]=useState<Result[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [online,setOnline]=useState(navigator.onLine);
  const fullReport=()=>[
    "IT Control Pro · Diagnóstico de redes",new Date().toLocaleString("es-ES"),
    windows?"Prueba ejecutada desde servicio Windows localhost":"Prueba ejecutada en navegador",
    analysis?JSON.stringify(analysis,null,2):"",
    ...results.map(reportItem)
  ].filter(Boolean).join("\n\n");
  function calculate() {
    try {setAnalysis(analyzeIPv4(ip,mask,gateway));setError("");}
    catch(e){setAnalysis(null);setError(String(e));}
  }
  async function run(kind:string){
    if(busy)return;
    setBusy(true);setError("");
    try{
      let result:Result;
      if(kind==="web"){
        const controller=new AbortController();
        const timer=setTimeout(()=>controller.abort(),4000);
        const start=performance.now();
        try{
          const response=await fetch(new URL("./manifest.webmanifest",document.baseURI),{cache:"no-store",signal:controller.signal});
          result={kind:"Origen web de la aplicación",ok:response.ok,detail:response.ok
            ?"Acceso al origen de IT Control Pro. No demuestra conectividad con otras IP o la red corporativa."
            :"Respuesta HTTP "+response.status,ms:Math.round(performance.now()-start)};
        }catch(e){result={kind:"Origen web de la aplicación",ok:false,detail:String(e)};}
        finally{clearTimeout(timer);}
      }else{
        const host=(kind==="dns"?dns:ip).trim();
        if(!host)throw Error("Introduce el destino de la comprobación.");
        if(kind!=="dns" && kind!=="interfaces" && ipv4Number(host)===undefined)throw Error("Introduce una IPv4 válida.");
        const response=await fetch("/api/diagnostics",{
          method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",
          body:JSON.stringify({kind,host,port:kind==="tcp"?port:undefined})
        });
        const data=await response.json();
        if(!response.ok)throw Error(String(data.error||"Error de diagnóstico"));
        result=data as Result;
      }
      setResults(before=>[result,...before].slice(0,20));
    }catch(e){setError(String(e));}
    finally{setBusy(false);}
  }
  return <section className="networkDiagnostics" aria-label="Batería de pruebas IP">
    <div className="inline"><Activity size={20}/><h2>Comprobaciones de red e IP</h2></div>
    <p>Diagnóstico puntual de equipos autorizados. No hay exploración ni barridos automáticos de red.</p>
    <div className="networkDiagnosticGrid">
      <label>Dirección IPv4
        <input list="it-network-saved-ips" aria-label="Dirección IP a comprobar" value={ip} onChange={e=>setIp(e.target.value)} placeholder="192.168.1.10" inputMode="decimal"/>
        <datalist id="it-network-saved-ips">{saved.filter(x=>ipv4Number(x.ip)!==undefined).slice(0,150).map((x,i)=><option key={i} value={x.ip} label={x.device}/>)}</datalist>
      </label>
      <label>Máscara o prefijo
        <input aria-label="Máscara de subred" value={mask} onChange={e=>setMask(e.target.value)} placeholder="24 o 255.255.255.0"/>
      </label>
      <label>Puerta de enlace (opcional)
        <input aria-label="Puerta de enlace" value={gateway} onChange={e=>setGateway(e.target.value)} placeholder="192.168.1.1"/>
      </label>
    </div>
    <button type="button" className="primary" onClick={calculate}><Network size={16}/> Calcular subred</button>
    {analysis && <div className="networkAnalysis" role="region" aria-label="Resultado de cálculo IPv4">
      {([
        ["IP",analysis.ip],["Máscara",analysis.mask],["Prefijo","/"+analysis.prefix],
        ["Red",analysis.network],["Broadcast",analysis.broadcast],
        ["Primer host",analysis.first],["Último host",analysis.last],
        ["Direcciones utilizables",String(analysis.usable)],["Tipo",analysis.type],
        ...(analysis.gatewayStatus?[["Puerta de enlace",analysis.gatewayStatus]]:[])
      ] as string[][]).map(([name,value])=><div key={name}><span>{name}</span><strong>{value}</strong></div>)}
    </div>}
    <div className="networkCapabilities">
      <div className="inline"><Wifi size={18}/><strong>Estado del navegador</strong>
        <span>{online?"El navegador informa conexión":"El navegador informa desconexión"}</span>
        <button type="button" onClick={()=>setOnline(navigator.onLine)}>Actualizar</button>
      </div>
      <button type="button" disabled={busy} onClick={()=>void run("web")}>Probar acceso web a la aplicación</button>
      <small>El indicador de conexión no garantiza Internet. La prueba web solo consulta el origen de la aplicación.</small>
    </div>
    {windows ? <div className="networkCapabilities">
      <h3>Pruebas del ordenador Windows</h3>
      <p>Desde el servicio local de Windows: una IP privada o loopback por prueba y puertos predeterminados. Utiliza únicamente destinos autorizados.</p>
      <div className="inline">
        <button type="button" disabled={busy} onClick={()=>void run("interfaces")}>Interfaces IPv4</button>
        <button type="button" disabled={busy} onClick={()=>void run("ping")}>Ping (2 paquetes)</button>
      </div>
      <div className="networkDiagnosticGrid">
        <label>Dominio DNS
          <input aria-label="Dominio DNS" placeholder="ejemplo.test" value={dns} onChange={e=>setDns(e.target.value)}/>
        </label>
        <label>Puerto TCP
          <select aria-label="Puerto TCP" value={port} onChange={e=>setPort(Number(e.target.value))}>
            {ports.map(n=><option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <div className="inline">
        <button type="button" disabled={busy} onClick={()=>void run("dns")}>Resolver DNS</button>
        <button type="button" disabled={busy} onClick={()=>void run("tcp")}>Probar TCP</button>
      </div>
    </div> : <p>En Android, el navegador no permite ping ICMP, consulta de interfaces de red ni conexiones TCP arbitrarias. Estas pruebas requieren un programa nativo autorizado; no se simulan resultados.</p>}
    {windows && location.port==="8787" && <LocalMonitor defaultIp={ip} />}
    {busy && <p role="status">Ejecutando comprobación…</p>}
    {error && <p role="alert">{error}</p>}
    {!!results.length && <div className="networkResults">
      <div className="inline"><h3>Resultados</h3>
        <button type="button" onClick={()=>void navigator.clipboard.writeText(fullReport()).catch(()=>setError("No se pudo copiar."))}>Copiar</button>
        <button type="button" onClick={()=>downloadBlob(new Blob([fullReport()],{type:"text/plain;charset=utf-8"}),"IT-Control-Pro-Pruebas-IP.txt")}><Download size={15}/> TXT</button>
        <button type="button" onClick={()=>setResults([])}>Limpiar</button>
      </div>
      {results.map((r,i)=><pre className="networkResult" key={i}>{reportItem(r)}</pre>)}
    </div>}
  </section>;
}
