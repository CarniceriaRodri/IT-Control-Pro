import test from "node:test";
import assert from "node:assert/strict";
import { monitorApi } from "../server/monitor.mjs";

async function call(action, body, address="127.0.0.1"){
 let response;
 const req={socket:{remoteAddress:address}};
 await monitorApi(req,{},(_,status,payload)=>{response={status,payload}},action,body);
 return response;
}

test("el monitor no permite clientes que no sean localhost",async()=>{
 const r=await call("status",{},"192.168.1.20");
 assert.equal(r.status,403);
});

test("no se admiten IP públicas, loopback ni entradas arbitrarias",async()=>{
 for(const ip of ["8.8.8.8","127.0.0.1","not-an-ip","192.168.1.1;echo x"]){
  const r=await call("add",{ip});
  assert.equal(r.status,400,ip);
 }
});

test("solo se registran IP privadas permitidas y se pueden quitar",async()=>{
 const added=await call("add",{ip:"192.168.123.222"});
 assert.equal(added.status,200);
 assert(added.payload.hosts.some(x=>x.ip==="192.168.123.222"));
 const removed=await call("remove",{ip:"192.168.123.222"});
 assert.equal(removed.status,200);
 assert(!removed.payload.hosts.some(x=>x.ip==="192.168.123.222"));
});

test("iniciar sin objetivos debe fallar y detener no deja monitor activo",async()=>{
 const started=await call("start",{});
 assert.equal(started.status,400);
 const stopped=await call("stop",{});
 assert.equal(stopped.status,200);
 assert.equal(stopped.payload.running,false);
});
