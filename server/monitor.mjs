// Monitor opt-in del servicio Windows local. Nunca escanea subredes.
import { spawn } from "node:child_process";
import { permittedTarget } from "./diagnostics.mjs";
const MAX_HOSTS=10, INTERVAL=120_000;
const monitored=new Map();
const events=[];
let timer=null;
let running=false;
let busy=false;
function local(req){
 const ip=req.socket.remoteAddress||"";
 return ["127.0.0.1","::1","::ffff:127.0.0.1"].includes(ip);
}
const timestamp=()=>new Date().toISOString();
async function check(ip) {
 return new Promise(resolve=>{
  const args=process.platform==="win32"?["-n","1","-w","1300",ip]:["-c","1","-W","2",ip];
  const ps=spawn(process.platform==="win32"?"ping.exe":"ping",args,{shell:false,windowsHide:true});
  let completed=false;
  const done=(ok,detail)=>{
   if(completed)return;
   completed=true;clearTimeout(timeout);
   try{ps.kill()}catch{}
   resolve({ok,detail,at:timestamp()});
  };
  const timeout=setTimeout(()=>done(false,"Tiempo agotado"),5000);
  ps.once("error",e=>done(false,e.code||String(e)));
  ps.once("close",code=>done(code===0,code===0?"Responde a ICMP":"Sin respuesta ICMP"));
 });
}
async function cycle(){
 if(busy||!running)return;
 busy=true;
 try {
  for(const [ip,previous] of monitored) {
   if(!running)break;
   const result=await check(ip);
   const next={...previous,...result};
   monitored.set(ip,next);
   if(previous.ok!==null && previous.ok!==result.ok) {
    events.unshift({ip,at:result.at,kind:result.ok?"Recuperado":"Sin respuesta"});
    if(events.length>30)events.pop();
   }
  }
 }finally{busy=false}
}
function ensureTimer(){
 if(timer)clearInterval(timer);
 timer=running?setInterval(()=>{void cycle()},INTERVAL):null;
}
export function monitorStatus(){
 return {running,intervalSeconds:INTERVAL/1000,hosts:[...monitored].map(([ip,r])=>({ip,...r})),events:[...events],
 message:"Sondeo voluntario desde el servidor Windows local. No hay notificaciones automáticas del sistema."};
}
export async function monitorApi(req,res,reply,kind,input){
 if(!local(req))return reply(res,403,{error:"Monitor solo disponible desde localhost."});
 if(kind==="status")return reply(res,200,monitorStatus());
 if(kind==="stop"){
  running=false;ensureTimer();return reply(res,200,monitorStatus());
 }
 if(kind==="remove"){
  if(typeof input?.ip!=="string")return reply(res,400,{error:"IP inválida"});
  monitored.delete(input.ip);return reply(res,200,monitorStatus());
 }
 if(kind==="add"){
  const ip=String(input?.ip||"").trim();
  if(!permittedTarget(ip) || ip==="127.0.0.1")
   return reply(res,400,{error:"Utiliza una IPv4 privada autorizada distinta de loopback."});
  if(!monitored.has(ip)&&monitored.size>=MAX_HOSTS)return reply(res,400,{error:"Máximo diez direcciones."});
  if(!monitored.has(ip))monitored.set(ip,{ok:null,detail:"Pendiente del primer sondeo",at:null});
  return reply(res,200,monitorStatus());
 }
 if(kind==="start"){
  if(!monitored.size)return reply(res,400,{error:"Añade una IP antes de iniciar."});
  running=true;ensureTimer();void cycle();return reply(res,200,monitorStatus());
 }
 return reply(res,400,{error:"Operación de monitor desconocida"});
}
