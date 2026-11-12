"""Repositorio compartido opcional con control de versiones y sesiones.
No expone la red por defecto. El modo local conserva IndexedDB hasta migrar explícitamente.
"""
from __future__ import annotations
import base64
import hashlib
import hmac
import json
from pathlib import Path
import secrets
import threading
import time
import uuid
from servicios_windows import HOME

class SharedData:
    def __init__(self, home=HOME):
        self.home=Path(home)
        self.lock=threading.RLock()
        self.config={"shared":False,"authentication":False,"users":{}}
        self.state={"version":1,"data":{"modules":[],"records":[],"history":[]},"retention":{"day":7,"week":4,"month":3},"recovery":None}
        self.sessions={}
        try:self.config=json.loads((self.home/"acceso.json").read_text(encoding="utf-8"))
        except (OSError,ValueError):pass
        try:self.state=json.loads((self.home/"datos.json").read_text(encoding="utf-8"))
        except (OSError,ValueError):pass
        self.attempts={}

    def _save(self, name, value):
        self.home.mkdir(parents=True,exist_ok=True)
        temp=self.home/(name+".tmp")
        temp.write_text(json.dumps(value,ensure_ascii=False),encoding="utf-8")
        temp.replace(self.home/name)

    def password(self, value, salt=None):
        if not isinstance(value,str) or not 10<=len(value)<=256:raise ValueError("La contraseña debe tener entre 10 y 256 caracteres")
        salt=salt or secrets.token_hex(16)
        digest=hashlib.scrypt(value.encode(),salt=bytes.fromhex(salt),n=16384,r=8,p=1).hex()
        return {"salt":salt,"digest":digest}

    def verify(self, user, value):
        try:return hmac.compare_digest(user["password"]["digest"],self.password(value,user["password"]["salt"])["digest"])
        except (ValueError,TypeError,KeyError):return False

    def actor(self, token):
        session=self.sessions.get(token)
        if session and session["expires"]>time.time():
            user=self.config["users"].get(session["user"])
            if user and user.get("active"):return session["user"],user["role"]
        return None

    def login(self, name, password, address="local"):
        name=str(name).strip().lower()
        with self.lock:
            now=time.time()
            failures=[t for t in self.attempts.get(address,[]) if now-t<300]
            if len(failures)>=10:raise ValueError("Demasiados intentos. Espera cinco minutos.")
            user=self.config["users"].get(name)
            if not user or not user.get("active") or not self.verify(user,password):
                self.attempts[address]=[*failures,now]
                raise ValueError("Usuario o contraseña incorrectos")
            token=secrets.token_urlsafe(32)
            self.sessions={k:v for k,v in self.sessions.items() if v["expires"]>now}
            self.sessions[token]={"user":name,"expires":now+8*3600}
            self.attempts.pop(address,None)
            return token

    def status(self, token=""):
        actor=self.actor(token)
        return {"shared":self.config["shared"],"authentication":self.config["authentication"],
                "configured":bool(self.config["users"]),"user":actor[0] if actor else None,
                "admin":bool(actor and actor[1]=="admin"),
                "users":[{"name":name,"role":u["role"],"active":u["active"]} for name,u in self.config["users"].items()] if actor and actor[1]=="admin" else []}

    def authorize(self, token, admin=False):
        actor=self.actor(token)
        if admin and (not actor or actor[1]!="admin"):raise PermissionError("Verifica la contraseña del superusuario para esta acción")
        if self.config["authentication"] and not actor:raise PermissionError("Inicia sesión para continuar")
        return actor

    def configure(self, payload, token="", local=True):
        with self.lock:
            if not self.config["users"]:
                if not local:raise PermissionError("El primer superusuario debe configurarse desde el propio Windows")
                name=str(payload.get("name","")).strip().lower()
                if not name or len(name)>64:raise ValueError("Usuario incorrecto")
                self.config["users"][name]={"role":"admin","active":True,"password":self.password(payload.get("password"))}
            else:
                self.authorize(token,admin=True)
                if "authentication" in payload:
                    if type(payload["authentication"]) is not bool:raise ValueError("Configuración incorrecta")
                    self.config["authentication"]=payload["authentication"]
                if "name" in payload:
                    name=str(payload["name"]).strip().lower()
                    if not name or len(name)>64:raise ValueError("Usuario incorrecto")
                    old=self.config["users"].get(name)
                    role=old["role"] if old else "basic"
                    active=payload.get("active",True)
                    if type(active) is not bool:raise ValueError("Estado incorrecto")
                    if role=="admin" and not active:raise ValueError("El superusuario debe permanecer activo")
                    password=self.password(payload["password"]) if payload.get("password") else old["password"] if old else None
                    if not password:raise ValueError("Indica una contraseña para el nuevo usuario")
                    self.config["users"][name]={"role":role,"active":active,"password":password}
                    self.sessions={k:v for k,v in self.sessions.items() if v["user"]!=name}
            self._save("acceso.json",self.config)
        return self.status(token)

    def migrate(self, payload, token):
        self.authorize(token,admin=True)
        with self.lock:
            if self.config["shared"]:raise ValueError("El repositorio compartido ya está activo")
            data=payload.get("data")
            self.validate(data)
            self.files(payload.get("attachments",{}))
            self.state["data"]=data
            self.state["version"]+=1
            self._save("datos.json",self.state)
            self.config["shared"]=True
            self._save("acceso.json",self.config)
        try:self.backup_snapshot()
        except Exception as error:
            from servicios_windows import SERVICES
            SERVICES.last_error="Migración completada; copia externa pendiente: "+str(error)
        return self.status(token)

    def owners(self, data):
        owners=[*data["modules"],*data["records"]]
        for event in data.get("history",[]):owners.extend([event.get("before"),event.get("after")])
        for batch in data.get("imports",[]):
            for snapshot in [batch.get("before"),batch.get("after")]:
                if snapshot:owners.extend([snapshot.get("module"),*snapshot.get("records",[])])
        return [x for x in owners if x]

    def backup_snapshot(self):
        from servicios_windows import SERVICES
        attachments={}
        for record in self.owners(self.state["data"]):
            for ref in record.get("files",[]):
                content=(self.home/"archivos"/ref["hash"]).read_bytes()
                attachments[ref["hash"]]=base64.b64encode(content).decode()
        SERVICES.snapshot({"app":"IT Control Pro","version":3,"data":self.state["data"],"attachments":attachments})

    def validate(self, data):
        if not isinstance(data,dict) or not all(isinstance(data.get(k),list) for k in ("modules","records","history")):
            raise ValueError("Datos incompatibles")
        modules={m.get("id") for m in data["modules"] if isinstance(m,dict)}
        if len(modules)!=len(data["modules"]) or any(not isinstance(x,str) for x in modules):raise ValueError("Módulos incorrectos")
        ids=set()
        for r in data["records"]:
            if not isinstance(r,dict) or r.get("module") not in modules or not isinstance(r.get("values"),dict) or not isinstance(r.get("id"),str) or r["id"] in ids:raise ValueError("Registro incorrecto")
            try:uuid.UUID(r["id"])
            except ValueError:raise ValueError("Identificador de registro incorrecto")
            if type(r.get("rev")) is not int or r["rev"]<1 or type(r.get("archived")) is not bool:raise ValueError("Versión o estado de registro incorrectos")
            ids.add(r["id"])

    def files(self, values):
        if not isinstance(values,dict):raise ValueError("Adjuntos incorrectos")
        directory=self.home/"archivos";directory.mkdir(parents=True,exist_ok=True)
        for key,encoded in values.items():
            content=base64.b64decode(encoded,validate=True)
            if hashlib.sha256(content).hexdigest()!=key:raise ValueError("Adjunto dañado")
            file=directory/key
            if not file.exists():file.write_bytes(content)

    def commit(self, payload, token):
        actor=self.authorize(token)
        with self.lock:
            if payload.get("version")!=self.state["version"]:raise ValueError("Otro usuario ha guardado cambios. Actualiza antes de continuar.")
            draft=payload.get("data");self.validate(draft)
            # El acceso abierto conserva privilegios básicos. Cambiar estructura,
            # borrar registros o restaurar conjuntos completos requiere superusuario.
            old=self.state["data"]
            privileged=draft["modules"]!=old["modules"] or not {r["id"] for r in old["records"]}.issubset({r["id"] for r in draft["records"]}) or draft.get("imports",[])!=old.get("imports",[])
            if privileged:self.authorize(token,admin=True)
            self.files(payload.get("files",{}))
            if payload.get("checkpoint"):self.state["recovery"]=old
            draft["history"]=list(old["history"])
            draft["history"].append({"id":str(uuid.uuid4()),"at":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"action":str(payload.get("action", "Guardar"))[:200],"target":str(payload.get("target",""))[:100],"operator":actor[0] if actor else "acceso local"})
            new={**self.state,"data":draft,"version":self.state["version"]+1}
            self._save("datos.json",new);self.state=new
            try:self.backup_snapshot()
            except Exception as error:
                from servicios_windows import SERVICES
                SERVICES.last_error="Datos guardados; copia externa pendiente: "+str(error)
            return {"version":new["version"]}

SHARED=SharedData()
