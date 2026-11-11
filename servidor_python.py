"""IT Control Pro: servidor estático LOCAL para la versión compilada.

No ofrece base de datos compartida, API, autenticación ni acceso LAN.
Arrancar mediante INICIAR-PYTHON.bat (Python 3, sin dependencias externas).
"""
from __future__ import annotations

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os
import threading
import webbrowser
import json
from monitor_python import MONITOR, MAX_REQUEST_BYTES

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

    def do_POST(self):
        if not self._allowed_host():
            return self._json(403, {"error": "Acceso solo desde el propio equipo"})
        origin = self.headers.get("Origin")
        if origin and origin not in (f"http://127.0.0.1:{PORT}", f"http://localhost:{PORT}"):
            return self._json(403, {"error": "Origen no autorizado"})
        if self.headers.get("Sec-Fetch-Site") == "cross-site":
            return self._json(403, {"error": "Operación entre sitios denegada"})
        if self.path not in ("/api/monitor/configure", "/api/monitor/start",
                             "/api/monitor/stop", "/api/monitor/run"):
            return self._json(404, {"error": "Ruta desconocida"})
        try:
            length = int(self.headers.get("Content-Length", "-1"))
            if not 0 <= length <= MAX_REQUEST_BYTES:
                return self._json(413, {"error": "Solicitud demasiado grande"})
            data = json.loads(self.rfile.read(length)) if length else {}
            result = MONITOR.configure(data) if self.path.endswith("/configure") else (
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
    print("Modo LOCAL: los datos permanecen en este navegador.", flush=True)
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
