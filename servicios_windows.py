"""Copias externas y canales adicionales. Estado fuera del repositorio público."""
from __future__ import annotations
import json
import os
from pathlib import Path
import threading
import time
import hashlib
import smtplib
import ssl
import subprocess
import shutil
from email.message import EmailMessage

HOME = Path(os.environ.get("LOCALAPPDATA") or Path.home() / ".it_control_pro") / "IT-Control-Pro"

class WindowsServices:
    def __init__(self, home=HOME):
        self.home = Path(home)
        self.lock = threading.RLock()
        self.settings = {"backupDir": str(self.home / "copias"), "retention": 30,
                         "intervalHours": 24, "recipient": "", "channel": "none"}
        self.last_backup = None
        self.last_error = ""
        self.last_delivery = ""
        self.latest = None
        self.last_digest = ""
        self.thread = None
        try:
            saved=json.loads((self.home / "servicios.json").read_text(encoding="utf-8"))
            self.settings.update(saved.get("settings", {}))
            self.last_backup=saved.get("lastBackup")
            self.last_digest=saved.get("lastDigest", "")
            self.latest=(self.home / "ultima-copia.json").read_text(encoding="utf-8")
        except (OSError, ValueError, TypeError):
            pass

    def _atomic(self, file, text):
        file.parent.mkdir(parents=True, exist_ok=True)
        temp=file.with_suffix(".tmp")
        temp.write_text(text, encoding="utf-8")
        temp.replace(file)

    def save(self):
        self._atomic(self.home / "servicios.json", json.dumps({"settings":self.settings,
            "lastBackup":self.last_backup, "lastDigest":self.last_digest},ensure_ascii=False))

    def status(self):
        with self.lock:
            return {**self.settings,"lastBackup":self.last_backup,"error":self.last_error,
                    "lastDelivery":self.last_delivery,"hasSnapshot":bool(self.latest),
                    "smtpConfigured":bool(os.environ.get("IT_SMTP_HOST") and os.environ.get("IT_SMTP_FROM")),
                    "snapshotAt":self.snapshot_at()}

    def snapshot_at(self):
        try:return (self.home / "ultima-copia.json").stat().st_mtime * 1000
        except OSError:return None

    def configure(self, data):
        if not isinstance(data,dict):raise ValueError("Configuración incorrecta")
        hours=data.get("intervalHours",24)
        retention=data.get("retention",30)
        channel=data.get("channel","none")
        recipient=str(data.get("recipient","")).strip()
        if hours not in (1,6,12,24,168) or type(retention) is not int or not 1<=retention<=90:
            raise ValueError("Intervalo o conservación incorrectos")
        if channel not in ("none","thunderbird","smtp"):raise ValueError("Canal incorrecto")
        if recipient and (recipient.count("@")!=1 or any(c in recipient for c in "\r\n,'\" <>")):
            raise ValueError("Correo incorrecto")
        if channel!="none" and not recipient:raise ValueError("Indica tu correo para recibir avisos")
        with self.lock:
            self.settings.update(intervalHours=hours,retention=retention,channel=channel,recipient=recipient)
            self.save()
        return self.status()

    def choose_directory(self):
        if os.name!="nt":raise ValueError("El selector requiere Windows")
        import tkinter as tk
        from tkinter import filedialog
        root=tk.Tk();root.withdraw();root.attributes("-topmost",True)
        try:directory=filedialog.askdirectory(title="Carpeta para las copias de IT Control Pro",parent=root)
        finally:root.destroy()
        if directory:
            with self.lock:self.settings["backupDir"]=directory;self.save()
        return self.status()

    def snapshot(self, payload):
        if not isinstance(payload,dict) or payload.get("app")!="IT Control Pro" or payload.get("version")!=3:
            raise ValueError("Copia completa incompatible")
        if not isinstance(payload.get("data"),dict) or not isinstance(payload.get("attachments"),dict):
            raise ValueError("Copia incompleta")
        import base64
        attachments=payload["attachments"]
        owners=[*payload["data"].get("modules",[]),*payload["data"].get("records",[])]
        for event in payload["data"].get("history",[]):owners.extend([event.get("before"),event.get("after")])
        for batch in payload["data"].get("imports",[]):
            for snapshot in [batch.get("before"),batch.get("after")]:
                if snapshot:owners.extend([snapshot.get("module"),*snapshot.get("records",[])])
        for record in [x for x in owners if x]:
            for ref in record.get("files",[]):
                value=attachments.get(ref["hash"])
                if not isinstance(value,str):raise ValueError("Adjunto ausente")
                content=base64.b64decode(value,validate=True)
                if len(content)!=ref["size"] or hashlib.sha256(content).hexdigest()!=ref["hash"]:
                    raise ValueError("Adjunto dañado")
        with self.lock:
            self.latest=json.dumps(payload,ensure_ascii=False)
            self._atomic(self.home / "ultima-copia.json",self.latest)
            self.backup()
        return self.status()

    def backup(self, force=False):
        with self.lock:
            if not self.latest:raise ValueError("Abre la aplicación para enviar el primer estado completo")
            now=time.time()
            if not force and self.last_backup and now-self.last_backup/1000<self.settings["intervalHours"]*3600:return
            directory=Path(self.settings["backupDir"]);directory.mkdir(parents=True,exist_ok=True)
            digest=hashlib.sha256(self.latest.encode()).hexdigest()
            name="IT-Control-Pro-"+time.strftime("%Y%m%d-%H%M%S")+".json"
            self._atomic(directory / name,self.latest)
            verified=(directory / name).read_text(encoding="utf-8")
            if hashlib.sha256(verified.encode()).hexdigest()!=digest:raise ValueError("No se pudo verificar la copia")
            self.last_backup=int(now*1000);self.last_digest=digest;self.last_error="";self.save()
            for old in sorted(directory.glob("IT-Control-Pro-*.json"),reverse=True)[self.settings["retention"]:]:old.unlink()

    def deliver(self, label, module):
        channel=self.settings["channel"];recipient=self.settings["recipient"]
        if channel=="none" or not recipient:return
        try:
            subject="IT Control Pro · Recordatorio · "+module
            body=label+"\n\nAbre IT Control Pro para consultar y confirmar el recordatorio."
            if channel=="thunderbird":
                exe=shutil.which("thunderbird") or next((str(p) for p in [Path(os.environ.get("ProgramFiles","C:/Program Files"))/"Mozilla Thunderbird/thunderbird.exe",Path(os.environ.get("ProgramFiles(x86)","C:/Program Files (x86)"))/"Mozilla Thunderbird/thunderbird.exe"] if p.is_file()),None)
                if not exe:raise ValueError("No se encuentra Thunderbird")
                clean=lambda s:s.replace("'","’").replace('"','“').replace("\r","").replace("\n"," ")
                subprocess.Popen([exe,"-compose",f"to='{recipient}',subject='{clean(subject)}',body='{clean(body)}'"],shell=False)
                self.last_delivery="Correo preparado en Thunderbird; pendiente de pulsar Enviar"
            else:
                host=os.environ.get("IT_SMTP_HOST");sender=os.environ.get("IT_SMTP_FROM")
                if not host or not sender:raise ValueError("Falta configurar SMTP en el entorno de Windows")
                message=EmailMessage();message["From"]=sender;message["To"]=recipient;message["Subject"]=subject;message.set_content(body)
                with smtplib.SMTP(host,int(os.environ.get("IT_SMTP_PORT","587")),timeout=15) as smtp:
                    smtp.starttls(context=ssl.create_default_context())
                    if os.environ.get("IT_SMTP_USER"):smtp.login(os.environ["IT_SMTP_USER"],os.environ.get("IT_SMTP_PASSWORD",""))
                    smtp.send_message(message)
                self.last_delivery="Correo entregado al servidor SMTP"
        except Exception as e:
            self.last_error="Aviso adicional: "+str(e)

    def start(self):
        def loop():
            while True:
                try:
                    if self.latest:self.backup()
                except Exception as e:self.last_error="Copia externa: "+str(e)
                time.sleep(30)
        if not self.thread or not self.thread.is_alive():
            self.thread=threading.Thread(target=loop,daemon=True,name="ITControlCopias");self.thread.start()

SERVICES=WindowsServices()
