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

ROOT = Path(__file__).resolve().parent
PORT = int(os.environ.get("IT_CONTROL_PORT", "8788"))
HOST = "127.0.0.1"


class LocalHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def _allowed_host(self):
        authority = self.headers.get("Host", "")
        return authority in (
            f"127.0.0.1:{PORT}", f"localhost:{PORT}",
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
        if self.path == "/api/monitor/status":
            return self._json(200, MONITOR.snapshot())
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
        if origin and origin not in (f"http://127.0.0.1:{PORT}", f"http://localhost:{PORT}"):
            return self._json(403, {"error": "Origen no autorizado"})
        if self.headers.get("Sec-Fetch-Site") == "cross-site":
            return self._json(403, {"error": "Operación entre sitios denegada"})
        if self.path not in ("/api/monitor/configure", "/api/monitor/start",
                             "/api/monitor/stop", "/api/monitor/run", "/api/diagnostics"):
            return self._json(404, {"error": "Ruta desconocida"})
        try:
            length = int(self.headers.get("Content-Length", "-1"))
            if not 0 <= length <= MAX_REQUEST_BYTES:
                return self._json(413, {"error": "Solicitud demasiado grande"})
            data = json.loads(self.rfile.read(length)) if length else {}
            result = self._diagnose(data) if self.path == "/api/diagnostics" else (
                MONITOR.configure(data) if self.path.endswith("/configure") else
                MONITOR.command(self.path.rsplit("/", 1)[-1]))
            return self._json(200, result)
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
    try:
        server = ThreadingHTTPServer((HOST, PORT), LocalHandler)
    except OSError as error:
        raise SystemExit(f"No se puede abrir {HOST}:{PORT}: {error}") from error

    url = f"http://{HOST}:{PORT}/"
    print(f"IT Control Pro abierto en {url}", flush=True)
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
