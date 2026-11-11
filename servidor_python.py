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

    def do_GET(self):
        if not self._allowed_host():
            self.send_error(400, "Host no permitido")
            return
        return super().do_GET()

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
