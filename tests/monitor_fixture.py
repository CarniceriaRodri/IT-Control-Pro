"""Servidor de pruebas de la interfaz; los sondeos se sustituyen por respuestas controladas."""
from pathlib import Path
import os
import sys
import tempfile
from http.server import ThreadingHTTPServer
from collections import Counter
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
temp=tempfile.TemporaryDirectory()
os.environ["LOCALAPPDATA"]=temp.name
import monitor_python
monitor_python.DATA=Path(temp.name)/"monitor"
monitor_python.FILE=monitor_python.DATA/"monitor.json"
import servidor_python
calls=Counter()
def fake_probe(ip, ports):
    calls[ip]+=1
    return {"status":"tcp","detail":f"Sondeo de prueba {calls[ip]}: TCP accesible", "ms":2}
monitor_python.probe=fake_probe
servidor_python.probe=fake_probe
server=ThreadingHTTPServer(("127.0.0.1",8788),servidor_python.LocalHandler)
try:server.serve_forever()
finally:server.server_close();temp.cleanup()
