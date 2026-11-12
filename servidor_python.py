"""IT Control Pro: interfaz estática y monitor local ICMP/TCP.

Solo loopback: no ofrece autenticación corporativa, datos compartidos ni acceso LAN.
El monitor tiene una API local separada de los datos del inventario.
Arrancar mediante INICIAR-PYTHON.bat (Python 3, sin dependencias externas).
"""
from __future__ import annotations

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os
import threading
import webbrowser
import json
import socket
import subprocess
import re
import time
from monitor_python import MONITOR, MAX_REQUEST_BYTES, permitted, ALLOWED_PORTS
from alarmas_windows import DESKTOP_ALARMS
from servicios_windows import SERVICES
from datos_compartidos import SHARED
from http.cookies import SimpleCookie
import ssl

ROOT = Path(__file__).resolve().parent
PORT = int(os.environ.get("IT_CONTROL_PORT", "8788"))
HOST = os.environ.get("IT_CONTROL_HOST", "127.0.0.1")
TLS_CERT = os.environ.get("IT_CONTROL_TLS_CERT")
TLS_KEY = os.environ.get("IT_CONTROL_TLS_KEY")


class LocalHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def _token(self):
        cookie = SimpleCookie()
        try: cookie.load(self.headers.get("Cookie", ""))
        except Exception: return ""
        return cookie["it_session"].value if "it_session" in cookie else ""

    def _is_local(self):
        return self.client_address[0] in ("127.0.0.1", "::1")

    def _allowed_host(self):
        authority = self.headers.get("Host", "")
        return authority in (
            f"127.0.0.1:{PORT}", f"localhost:{PORT}", f"{HOST}:{PORT}",
            "127.0.0.1", "localhost",
        )

    def _api_headers(self, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def _json(self, status, data):
        self._api_headers(status)
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

    def do_GET(self):
        if not self._allowed_host():
            self.send_error(400, "Host no permitido")
            return
        if self.path == "/api/access/status":
            return self._json(200, SHARED.status(self._token()))
        if self.path == "/api/health":
            return self._json(200, {"mode":"windows-server", "shared":SHARED.config["shared"]})
        if self.path in ("/api/state", "/api/retention", "/api/points", "/api/recovery") or self.path.startswith("/api/file/"):
            try:
                SHARED.authorize(self._token())
                if not SHARED.config["shared"]:raise ValueError("Repositorio compartido desactivado")
                if self.path == "/api/state":return self._json(200,{"version":SHARED.state["version"],"data":SHARED.state["data"]})
                if self.path == "/api/retention":return self._json(200,SHARED.state["retention"])
                if self.path == "/api/points":return self._json(200,[])
                if self.path == "/api/recovery":return self._json(200,SHARED.state["recovery"])
                key=self.path.rsplit("/",1)[-1]
                if not re.fullmatch(r"[a-f0-9]{64}",key):raise ValueError("Archivo incorrecto")
                file=SHARED.home/"archivos"/key
                if not file.is_file():return self._json(404,{"error":"Archivo no encontrado"})
                self.send_response(200);self.send_header("Content-Type","application/octet-stream");self.end_headers();self.wfile.write(file.read_bytes());return
            except PermissionError as error:return self._json(401,{"error":str(error)})
            except ValueError as error:return self._json(400,{"error":str(error)})
        if self.path.startswith(("/api/monitor/", "/api/alarms/", "/api/services/")) and not self._is_local():
            return self._json(403, {"error":"Servicio disponible solo desde el propio Windows"})
        if self.path == "/api/services/status":
            return self._json(200, SERVICES.status())
        if self.path == "/api/monitor/status":
            return self._json(200, MONITOR.snapshot())
        if self.path == "/api/alarms/status":
            return self._json(200, DESKTOP_ALARMS.snapshot())
        return super().do_GET()


    def _diagnose(self, payload):
        if not isinstance(payload, dict):
            raise ValueError("Parámetros incorrectos")
        kind = payload.get("kind")
        host = str(payload.get("host") or "").strip()
        if kind == "interfaces":
            names = set()
            for entry in socket.getaddrinfo(socket.gethostname(), None, family=socket.AF_INET):
                names.add(entry[4][0])
            return {"kind": kind, "ok": True, "detail": "Direcciones IPv4 detectadas por el sistema",
                    "interfaces": [{"adapter": "Equipo local", "ip": ip,
                                    "mask": "No disponible", "mac": "No disponible"}
                                   for ip in sorted(names)]}
        if kind == "dns":
            if len(host) > 253 or not re.fullmatch(
                r"[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?", host
            ):
                raise ValueError("Introduce un nombre DNS válido")
            try:
                addresses = sorted({item[4][0] for item in socket.getaddrinfo(
                    host, None, family=socket.AF_INET)})
                return {"kind": kind, "ok": bool(addresses),
                        "detail": "DNS resuelto" if addresses else "Sin resultado DNS",
                        "addresses": addresses}
            except socket.gaierror as error:
                return {"kind": kind, "ok": False, "detail": str(error)}
        if not permitted(host):
            raise ValueError("Introduce una IPv4 privada autorizada")
        start = time.monotonic()
        if kind == "ping":
            cmd = ["ping.exe", "-n", "2", "-w", "1200", host] if os.name == "nt" else (
                ["ping", "-c", "2", "-W", "2", host])
            try:
                done = subprocess.run(cmd, shell=False, capture_output=True, text=True,
                                      errors="replace", timeout=6)
                return {"kind": kind, "host": host, "ok": done.returncode == 0,
                        "detail": (done.stdout or done.stderr or "Sin respuesta")[:2500],
                        "ms": round((time.monotonic() - start) * 1000)}
            except (OSError, subprocess.TimeoutExpired) as error:
                return {"kind": kind, "host": host, "ok": False, "detail": str(error)}
        if kind == "tcp":
            port = payload.get("port")
            if type(port) is not int or port not in ALLOWED_PORTS:
                raise ValueError("Puerto TCP no permitido")
            try:
                with socket.create_connection((host, port), timeout=2.5):
                    return {"kind": kind, "host": host, "port": port, "ok": True,
                            "detail": "Conexión TCP establecida",
                            "ms": round((time.monotonic() - start) * 1000)}
            except OSError as error:
                return {"kind": kind, "host": host, "port": port, "ok": False,
                        "detail": str(error)}
        raise ValueError("Diagnóstico no reconocido")

    def do_POST(self):
        if not self._allowed_host():
            return self._json(403, {"error": "Acceso solo desde el propio equipo"})
        origin = self.headers.get("Origin")
        if origin and origin not in (f"http://127.0.0.1:{PORT}", f"http://localhost:{PORT}", f"https://{HOST}:{PORT}"):
            return self._json(403, {"error": "Origen no autorizado"})
        if self.headers.get("Sec-Fetch-Site") == "cross-site":
            return self._json(403, {"error": "Operación entre sitios denegada"})
        if self.path not in ("/api/monitor/configure", "/api/monitor/start",
                             "/api/monitor/stop", "/api/monitor/run", "/api/diagnostics",
                             "/api/alarms/configure", "/api/alarms/test", "/api/alarms/action", "/api/alarms/test-scheduled", "/api/services/configure", "/api/services/snapshot", "/api/services/backup", "/api/services/directory", "/api/access/login", "/api/access/logout", "/api/access/configure", "/api/access/migrate", "/api/commit", "/api/bootstrap", "/api/retention"):
            return self._json(404, {"error": "Ruta desconocida"})
        try:
            length = int(self.headers.get("Content-Length", "-1"))
            limit = 100 * 1024 * 1024 if self.path in ("/api/services/snapshot", "/api/access/migrate", "/api/commit") else MAX_REQUEST_BYTES
            if not 0 <= length <= limit:
                return self._json(413, {"error": "Solicitud demasiado grande"})
            data = json.loads(self.rfile.read(length)) if length else {}
            if not self._is_local() and self.path.startswith(("/api/services/", "/api/alarms/", "/api/monitor/")):
                return self._json(403,{"error":"Acción disponible solo desde el propio Windows"})
            if self.path in ("/api/services/configure", "/api/services/directory") and SHARED.config["users"]:
                SHARED.authorize(self._token(),admin=True)
            if self.path == "/api/access/login":
                token=SHARED.login(data.get("name"),data.get("password"),self.client_address[0])
                self.send_response(200)
                self.send_header("Set-Cookie", "it_session="+token+"; HttpOnly; SameSite=Strict; Path=/"+("; Secure" if TLS_CERT else ""))
                self.send_header("Content-Type","application/json")
                self.end_headers();self.wfile.write(json.dumps(SHARED.status(token)).encode());return
            elif self.path == "/api/access/logout":
                SHARED.sessions.pop(self._token(),None)
                result=SHARED.status()
            elif self.path == "/api/access/configure":
                if data.get("authentication") is False and HOST not in ("127.0.0.1", "localhost", "::1"):
                    raise ValueError("Mantén la autenticación activada mientras exista acceso por red")
                result=SHARED.configure(data,self._token(),self._is_local())
            elif self.path == "/api/access/migrate":
                result=SHARED.migrate(data,self._token())
            elif self.path == "/api/commit":
                result=SHARED.commit(data,self._token())
            elif self.path == "/api/bootstrap":
                SHARED.authorize(self._token(),admin=True)
                if SHARED.state["data"]["modules"]:raise ValueError("Ya hay datos")
                result={"ok":True}
            elif self.path == "/api/retention":
                SHARED.authorize(self._token(),admin=True)
                if any(type(data.get(k)) is not int or not 0<=data[k]<=90 for k in ("day","week","month")):raise ValueError("Conservación incorrecta")
                SHARED.state["retention"]=data;SHARED._save("datos.json",SHARED.state);result=data
            elif self.path == "/api/services/configure":
                result = SERVICES.configure(data)
            elif self.path == "/api/services/snapshot":
                if SHARED.config["shared"]:
                    SHARED.backup_snapshot()
                    result = SERVICES.status()
                else:
                    result = SERVICES.snapshot(data)
            elif self.path == "/api/services/backup":
                SERVICES.backup(force=True)
                result = SERVICES.status()
            elif self.path == "/api/services/directory":
                result = SERVICES.choose_directory()
            elif self.path == "/api/diagnostics":
                result = self._diagnose(data)
            elif self.path == "/api/alarms/configure":
                result = DESKTOP_ALARMS.configure(data)
            elif self.path == "/api/alarms/action":
                key = data.get("key")
                if not any(i["key"] == key for i in DESKTOP_ALARMS.items):
                    raise ValueError("Alarma no encontrada")
                DESKTOP_ALARMS.action(key, data.get("kind"), data.get("minutes", 0))
                result = DESKTOP_ALARMS.snapshot()
            elif self.path == "/api/alarms/test-scheduled":
                result = DESKTOP_ALARMS.test_scheduled(data.get("sound", "alarma"))
            elif self.path == "/api/alarms/test":
                result = DESKTOP_ALARMS.test(data.get("sound", "alarma"))
            else:
                result = (MONITOR.configure(data) if self.path.endswith("/configure") else
                          MONITOR.command(self.path.rsplit("/", 1)[-1]))
            return self._json(200, result)
        except PermissionError as error:
            return self._json(403, {"error": str(error)})
        except (ValueError, TypeError, json.JSONDecodeError) as error:
            return self._json(400, {"error": str(error)})

    def do_HEAD(self):
        if not self._allowed_host():
            self.send_error(400, "Host no permitido")
            return
        return super().do_HEAD()

    def end_headers(self):
        # Los ficheros son locales: no almacenar HTML/JS/CSS antiguos entre ZIPs.
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        return super().end_headers()


def main():
    if not (ROOT / "index.html").is_file() or not (ROOT / "assets").is_dir():
        raise SystemExit(
            "Faltan index.html o assets/. Descarga el paquete completo compilado "
            "del repositorio; NO ejecutes app.html ni npm en este equipo."
        )
    if HOST not in ("127.0.0.1", "localhost", "::1") and not (TLS_CERT and TLS_KEY and SHARED.config["shared"] and SHARED.config["authentication"]):
        raise SystemExit("El acceso por red requiere datos compartidos, autenticación y certificado TLS configurados.")
    try:
        server = ThreadingHTTPServer((HOST, PORT), LocalHandler)
    except OSError as error:
        raise SystemExit(f"No se puede abrir {HOST}:{PORT}: {error}") from error

    if TLS_CERT:
        context=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(TLS_CERT,TLS_KEY)
        server.socket=context.wrap_socket(server.socket,server_side=True)
    url = f"{'https' if TLS_CERT else 'http'}://{HOST}:{PORT}/"
    DESKTOP_ALARMS.start(url)
    SERVICES.start()
    print(f"IT Control Pro abierto en {url}", flush=True)
    print("Alarmas nativas de Windows listas: configurar desde Agenda.", flush=True)
    print("Modo LOCAL: los datos de inventario permanecen en este navegador.", flush=True)
    print("Monitor Python disponible en Redes; selecciona IP autorizadas y pulsa Iniciar.", flush=True)
    print("No es un servidor multiusuario. Para finalizar, Ctrl+C.", flush=True)
    threading.Timer(0.7, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever(poll_interval=0.4)
    except KeyboardInterrupt:
        print("\nCerrando servidor...", flush=True)
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

