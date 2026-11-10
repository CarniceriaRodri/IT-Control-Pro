// Servidor de pruebas para Windows. Requiere Node.js 22+.
// No proporciona autenticación corporativa: no publicar ni usar datos sensibles.
import http from "node:http";
import { readFile, writeFile, rename, mkdir, stat, copyFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID, createHash } from "node:crypto";
import { diagnostics } from "./diagnostics.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const storage = path.resolve(process.env.IT_DATA_DIR || path.join(root, "datos"));
const backupDir = path.resolve(process.env.IT_BACKUP_DIR || path.join(storage, "copias"));
const host = process.env.IT_HOST || "127.0.0.1";
const port = Number(process.env.IT_PORT || 8787);
const sourceFile = path.join(storage, "sistema.json");
const mime = {".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".svg":"image/svg+xml",".png":"image/png",".webmanifest":"application/manifest+json",".json":"application/json",".wasm":"application/wasm",".gz":"application/gzip"};
const maxBody = 35 * 1024 * 1024;
const blank = () => ({ version:1, data:{modules:[],records:[],history:[]}, retention:{day:7,week:4,month:3}, points:[], recovery:null });
let state;
let busy = Promise.resolve();
const serial = (work) => { const next=busy.then(work);busy=next.catch(()=>{});return next; };
async function persist() {
  const temp=sourceFile+"."+process.pid+".tmp";
  await writeFile(temp, JSON.stringify(state));
  await rename(temp,sourceFile);
}
async function initialize() {
  await mkdir(storage,{recursive:true});
  await mkdir(path.join(storage,"archivos"),{recursive:true});
  await mkdir(backupDir,{recursive:true});
  if(existsSync(sourceFile)) state=JSON.parse(await readFile(sourceFile,"utf8"));
  else { state=blank(); await persist(); }
  // Compatibilidad: ocultar la antigua tarea duplicada de Agenda sin borrar su contenido.
  const agenda = state.data?.modules?.find(m=>m.id==="Agenda");
  const oldTask = agenda?.fields?.find(f=>f.id==="tarea");
  if(oldTask?.visible){
    oldTask.visible=false;
    oldTask.required=false;
    state.version++;
    await persist();
  }
  // Altas de esquema opcionales: no se reemplazan módulos ni registros del usuario.
  if(state.data?.modules?.length && !state.data.modules.some(m=>m.id==="Movimientos")){
    const field=(id,label,type="texto",extra={})=>({
      id,label,type,required:false,visible:true,options:[],...extra
    });
    state.data.modules.push({
      id:"Movimientos",name:"Movimientos",active:true,fields:[
        field("referencia","Referencia de movimiento","texto",{required:true,unique:true}),
        field("fecha","Fecha","fecha",{required:true}),
        field("tipo","Operación","lista",{required:true,options:["Entrada","Salida","Préstamo","Devolución","Traslado"]}),
        field("equipoId","Equipo o material","relación",{target:"Inventario"}),
        field("centroOrigen","Centro de origen","relación",{target:"Centros"}),
        field("centroDestino","Centro de destino","relación",{target:"Centros"}),
        field("serie","Número de serie / referencia adicional"),
        field("cantidad","Cantidad","entero",{initial:"1"}),
        field("incidenciaId","Incidencia asociada","relación",{target:"Incidencias"}),
        field("responsableId","Contacto responsable","relación",{target:"Contactos"}),
        field("devolucionPrevista","Devolución prevista","fecha"),
        field("estado","Situación","estado",{options:["Pendiente","Entregado","Devuelto","Finalizado","Cancelado"],initial:"Pendiente"}),
        field("observaciones","Observaciones","texto largo")
      ]
    });
    state.version++;
    await persist();
  }
}
async function backup(force=false) {
  const day=new Date().toISOString().slice(0,10);
  const target=path.join(backupDir,"sistema-"+day+".json");
  if(force || !existsSync(target)) {
    await copyFile(sourceFile,target);
    const files=path.join(storage,"archivos");
    const dest=path.join(backupDir,"archivos");
    await mkdir(dest,{recursive:true});
    for(const name of await readdir(files)){
      if(/^[a-f0-9]{64}$/.test(name) && !existsSync(path.join(dest,name)))
        await copyFile(path.join(files,name),path.join(dest,name));
    }
  }
}
const reply=(res,code,body)=>{res.writeHead(code,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});res.end(JSON.stringify(body));};
async function body(req) {
  let size=0;const chunks=[];
  for await(const chunk of req){size+=chunk.length;if(size>maxBody)throw Error("Petición demasiado grande");chunks.push(chunk);}
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
function validData(d) {
 if(!d || !Array.isArray(d.modules)||!Array.isArray(d.records)||!Array.isArray(d.history))return false;
 if(d.modules.length>1000||d.records.length>100000||d.history.length>200000)return false;
 const ids=new Set();for(const m of d.modules){if(typeof m.id!=="string"||!Array.isArray(m.fields)||ids.has(m.id))return false;ids.add(m.id);}
 const records=new Set();for(const r of d.records){if(typeof r.id!=="string"||typeof r.module!=="string"||!ids.has(r.module)||records.has(r.id))return false;records.add(r.id);}
 return true;
}
const resolveSafe=(pathname)=>{
  let decoded=decodeURIComponent(pathname);
  if(decoded==="/") decoded="/index.html";
  const file=path.resolve(root,"."+decoded);
  if(file!==root&&!file.startsWith(root+path.sep))return null;
  return file;
};
async function handler(req,res){
 try {
  const url=new URL(req.url,"http://localhost");
  const u=url.pathname;
  if(u.startsWith("/api/")) {
    if(req.method==="POST"&&u==="/api/diagnostics") {
      const input=await body(req);
      return diagnostics(req,res,reply,input);
    }
    if(req.method==="GET"&&u==="/api/health")return reply(res,200,{app:"IT Control Pro",mode:"windows-server",version:1});
    if(req.method==="GET"&&u==="/api/state")return reply(res,200,{version:state.version,data:state.data});
    if(req.method==="GET"&&u==="/api/points")return reply(res,200,state.points);
    if(req.method==="GET"&&u==="/api/retention")return reply(res,200,state.retention);
    if(req.method==="GET"&&u==="/api/recovery")return reply(res,200,state.recovery);
    if(req.method==="GET"&&u.startsWith("/api/file/")){
      const hash=u.slice("/api/file/".length);
      if(!/^[a-f0-9]{64}$/.test(hash))return reply(res,400,{error:"Identificador inválido"});
      const p=path.join(storage,"archivos",hash);
      if(!existsSync(p))return reply(res,404,{error:"Archivo no encontrado"});
      res.writeHead(200,{"Content-Type":"application/octet-stream","X-Content-Type-Options":"nosniff","Cache-Control":"private, no-store"});res.end(await readFile(p));return;
    }
    if(req.method==="POST"&&u==="/api/bootstrap") {
      const input=await body(req);
      return await serial(async()=>{
        if(state.data.modules.length)return reply(res,200,{ok:true});
        if(!validData(input.data) || input.data.modules.length<1 || input.data.records.length>0 || input.data.history.length>0)
          return reply(res,400,{error:"Inicialización no válida"});
        state.data=input.data;
        state.version++;
        await persist();
        return reply(res,200,{ok:true});
      });
    }
    if(req.method==="POST"&&u==="/api/commit") {
      const input=await body(req);
      return await serial(async()=>{
        if(input.version!==state.version)return reply(res,409,{error:"Otro usuario ha guardado cambios. Actualiza la página antes de continuar."});
        if(!validData(input.data))return reply(res,400,{error:"Datos inválidos"});
        if(typeof input.action!=="string"||typeof input.target!=="string"||typeof input.files!=="object"||!input.files)return reply(res,400,{error:"Solicitud incompleta"});
        for(const [hash, encoded] of Object.entries(input.files)){
          if(!/^[a-f0-9]{64}$/.test(hash)||typeof encoded!=="string")return reply(res,400,{error:"Archivo inválido"});
          const buf=Buffer.from(encoded,"base64");
          if(buf.length>10*1024*1024 || createHash("sha256").update(buf).digest("hex")!==hash)return reply(res,400,{error:"Integridad de archivo incorrecta"});
        }
        if(input.checkpoint) state.recovery=structuredClone(state.data);
        for(const [hash,encoded] of Object.entries(input.files)) {
          const dest=path.join(storage,"archivos",hash);
          if(!existsSync(dest))await writeFile(dest,Buffer.from(encoded,"base64"),{flag:"wx"}).catch(e=>{if(e.code!=="EEXIST")throw e});
        }
        const before=state.data.records.find(x=>x.id===input.target);
        const after=input.data.records.find(x=>x.id===input.target);
        input.data.history.push({id:randomUUID(),at:new Date().toISOString(),action:input.action,target:input.target,before,after});
        state={...state,version:state.version+1,data:input.data};
        await persist();
        await backup();
        return reply(res,200,{version:state.version});
      });
    }
    if(req.method==="POST"&&u==="/api/retention"){
      const value=await body(req);
      if(!["day","week","month"].every(x=>Number.isInteger(value[x])&&value[x]>=0&&value[x]<=90))return reply(res,400,{error:"Conservación inválida"});
      return await serial(async()=>{state.retention=value;await persist();return reply(res,200,{ok:true})});
    }
    if(req.method==="POST"&&u==="/api/backup"){
      return await serial(async()=>{await persist();await backup(true);reply(res,200,{ok:true})});
    }
    return reply(res,404,{error:"Operación desconocida"});
  }
  if(req.method!=="GET"&&req.method!=="HEAD")return reply(res,405,{error:"Método no permitido"});
  const p=resolveSafe(u);if(!p)return reply(res,403,{error:"Acceso denegado"});
  const relative=path.relative(root,p).replaceAll("\\","/");
  const publicFiles=new Set(["index.html","app.html","sw.js","manifest.webmanifest","icon.svg","icon-192.png","icon-512.png"]);
  const webAsset = /^assets[/][a-zA-Z0-9._-]+$/.test(relative);
  const ocrAsset = /^(?:android[/])?ocr[/](?:[a-zA-Z0-9._-]+|(?:core|lang)[/][a-zA-Z0-9._-]+)$/.test(relative);
  const androidAsset = /^android[/](?:index[.]html|sw[.]js|manifest[.]webmanifest|assets[/][a-zA-Z0-9._-]+)$/.test(relative);
   if(!publicFiles.has(relative) && !webAsset && !ocrAsset && !androidAsset)
     return reply(res,403,{error:"Ruta restringida"});
  if(!existsSync(p)||!(await stat(p)).isFile())return reply(res,404,{error:"No encontrado"});
  const bytes=await readFile(p);
  res.writeHead(200,{"Content-Type":mime[path.extname(p)]||"application/octet-stream","X-Content-Type-Options":"nosniff","Cache-Control":"no-cache"});
  res.end(req.method==="HEAD"?undefined:bytes);
 } catch(e){reply(res,500,{error:e.message||String(e)})}
}
await initialize();
const server=http.createServer(handler);
server.listen(port,host,()=>console.log("IT Control Pro (pruebas): http://"+host+":"+port+"/ — datos: "+storage));
