// Diagnósticos selectivos para el ordenador Windows que aloja IT Control Pro.
// SOLO accesibles desde loopback; nunca son una API de exploración de red.
import os from "node:os";
import net from "node:net";
import dns from "node:dns/promises";
import { spawn } from "node:child_process";

const isLocal = (address = "") =>
  address === "::1" || address === "127.0.0.1" || address === "::ffff:127.0.0.1";
const validIpv4 = (ip) => {
  const p = String(ip).split(".");
  return p.length === 4 && p.every(x => /^(0|[1-9]\d{0,2})$/.test(x) && Number(x) < 256)
    ? p.map(Number) : null;
};
export function permittedTarget(ip) {
  const p = validIpv4(ip);
  if (!p) return false;
  const [a,b] = p;
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 169 && b === 254);
}
const ports = new Set([22,53,80,139,443,445,3389,8080,8443,9100]);
const validName = (name) => typeof name === "string" && name.length <= 253 &&
  /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(name);
function runCommand(file, args) {
  return new Promise((resolve) => {
    const ps = spawn(file,args,{shell:false,windowsHide:true});
    let output = "", ended = false;
    const timeout = setTimeout(() => {
      ps.kill();
    }, 6500);
    ps.stdout.on("data", x => { output = (output + x.toString()).slice(0,4000); });
    ps.stderr.on("data", x => { output = (output + x.toString()).slice(0,4000); });
    ps.on("error", e => { if (!ended) {ended=true; clearTimeout(timeout); resolve({ok:false,detail:String(e)}); }});
    ps.on("close", (code) => { if (!ended) {ended=true;clearTimeout(timeout);resolve({ok:code===0,detail:output.trim()||"Sin respuesta"}); }});
  });
}
function tcp(ip,port) {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = net.connect({host:ip,port,family:4});
    let done=false;
    const finish=(status,detail) => {
      if(done)return;done=true;
      const ms=Date.now()-started;
      socket.destroy();
      resolve({ok:status,detail,ms});
    };
    socket.setTimeout(2500);
    socket.once("connect",()=>finish(true,"Conexión TCP establecida"));
    socket.once("timeout",()=>finish(false,"Tiempo de espera agotado"));
    socket.once("error",(e)=>finish(false,e.code || "Error de conexión"));
  });
}
export async function diagnostics(req,res,reply,payload) {
  if(!isLocal(req.socket.remoteAddress)) return reply(res,403,{error:"Diagnóstico disponible solo en el equipo local."});
  if (!payload || typeof payload !== "object") return reply(res,400,{error:"Parámetros inválidos"});
  const kind=payload.kind;
  if(kind==="interfaces") {
    const interfaces=Object.entries(os.networkInterfaces()).flatMap(([name,items])=>
      (items||[]).filter(x=>x.family==="IPv4" && !x.internal).map(x=>({
        adapter:name,ip:x.address,mask:x.netmask,mac:x.mac
      })));
    return reply(res,200,{kind,ok:true,detail:interfaces.length?"Interfaces IPv4 locales del PC Windows":"No se han encontrado interfaces IPv4 externas",interfaces});
  }
  if(kind==="dns") {
    const name=String(payload.host||"").trim();
    if (!validName(name)) return reply(res,400,{error:"Escribe un dominio DNS válido, sin protocolo ni ruta."});
    try {
      const addresses=await Promise.race([
        dns.resolve4(name),
        new Promise((_,reject)=>setTimeout(()=>reject(Error("Tiempo de espera DNS agotado")),3000))
      ]);
      return reply(res,200,{kind,ok:true,detail:"DNS resuelto",addresses});
    } catch(e) { return reply(res,200,{kind,ok:false,detail:String(e.message || e)}); }
  }
  const ip=String(payload.host||"").trim();
  if(!permittedTarget(ip)) return reply(res,400,{error:"Indica una única IPv4 privada o loopback autorizada. No se permiten barridos de red."});
  if(kind==="ping") {
    const result=await runCommand(process.platform==="win32"?"ping.exe":"ping",
      process.platform==="win32"?["-n","2","-w","1200",ip]:["-c","2","-W","2",ip]);
    return reply(res,200,{kind,host:ip,...result});
  }
  if(kind==="tcp"){
    const port=Number(payload.port);
    if(!ports.has(port)) return reply(res,400,{error:"Puerto no incluido entre los diagnósticos permitidos."});
    return reply(res,200,{kind,host:ip,port,...await tcp(ip,port)});
  }
  return reply(res,400,{error:"Prueba no reconocida."});
}
