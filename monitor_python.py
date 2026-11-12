"""Monitor local de direcciones IPv4 expresamente incorporadas desde IT Control Pro.
Solo loopback; sin barridos de subred ni exposición a LAN. Python 3 stdlib.
El proceso de sondeo permanece activo mientras se ejecuta servidor_python.py.
"""
from __future__ import annotations
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from ipaddress import ip_address
from pathlib import Path
from threading import RLock, Event, Thread
import json
import os
import socket
import subprocess
import time

DATA = Path.home() / ".it_control_pro" / "monitor"
FILE = DATA / "monitor.json"
MAX_HOSTS = 5000
MAX_WORKERS = 6
ALLOWED_INTERVALS = (30, 60, 120, 300, 600)
ALLOWED_PORTS = (22, 80, 443, 445, 515, 631, 8080, 8443, 9100)
MAX_EVENTS = 500
MAX_REQUEST_BYTES = 4_000_000


def permitted(ip):
    try:
        a = ip_address(ip)
        return a.version == 4 and (a.is_private or a.is_link_local) and not (
            a.is_loopback or a.is_multicast or a.is_unspecified or a.is_reserved
        )
    except ValueError:
        return False


def timestamp():
    return datetime.now(timezone.utc).isoformat()


def probe(ip, ports):
    start = time.monotonic()
    args = (["ping.exe", "-n", "1", "-w", "1200", ip] if os.name == "nt"
            else ["ping", "-c", "1", "-W", "2", ip])
    try:
        result = subprocess.run(args, capture_output=True, text=True, errors="replace",
                                timeout=4, check=False, shell=False)
        if result.returncode == 0:
            return {"status": "online", "detail": "Responde a ICMP",
                    "ms": round((time.monotonic() - start) * 1000)}
    except (OSError, subprocess.TimeoutExpired):
        pass
    for port in ports:
        try:
            with socket.create_connection((ip, port), timeout=0.6):
                return {"status": "tcp", "detail": f"Sin respuesta ICMP; TCP {port} accesible",
                        "ms": round((time.monotonic() - start) * 1000)}
        except OSError:
            continue
    return {"status": "unreachable", "detail": "Sin respuesta ICMP ni de los TCP configurados",
            "ms": None}


class Monitor:
    def __init__(self):
        self.lock = RLock()
        self.wake = Event()
        self.running = False
        self.interval = 120
        self.failures = 3
        self.targets = {}
        self.states = {}
        self.events = []
        self.completed = 0
        self.total = 0
        self.last_probe = {}
        self.last_cycle = None
        self.next_cycle = None
        self._restore()
        Thread(target=self._loop, name="it-control-monitor", daemon=True).start()

    def _metadata(self, entry):
        interval = entry.get("intervalSeconds", 120)
        threshold = entry.get("failureThreshold", 3)
        schedule = entry.get("schedule", {"start": 0, "end": 24})
        if interval not in ALLOWED_INTERVALS or threshold not in (1, 2, 3, 5):
            raise ValueError("Política de grupo incorrecta")
        if not isinstance(schedule, dict) or type(schedule.get("start")) is not int or type(schedule.get("end")) is not int or not 0 <= schedule["start"] <= 23 or not 1 <= schedule["end"] <= 24 or schedule["start"] == schedule["end"]:
            raise ValueError("Horario incorrecto")
        return {"location": str(entry.get("location") or "")[:500],
                "groups": [str(x)[:100] for x in entry.get("groups", []) if isinstance(x, str)][:50],
                "recordIds": [str(x)[:100] for x in entry.get("recordIds", []) if isinstance(x, str)][:50],
                "schedule": schedule, "intervalSeconds": interval, "failureThreshold": threshold}

    def _restore(self):
        try:
            saved = json.loads(FILE.read_text(encoding="utf-8"))
            self.interval = saved["interval"] if saved.get("interval") in ALLOWED_INTERVALS else 120
            self.failures = saved["failures"] if saved.get("failures") in (1, 2, 3, 5) else 3
            for entry in saved.get("targets", [])[:MAX_HOSTS]:
                if isinstance(entry, dict) and permitted(entry.get("ip")):
                    ip = entry["ip"]
                    self.targets[ip] = {
                        **self._metadata(entry),
                        "ip": ip,
                        "device": str(entry.get("device") or ip)[:100],
                        "center": str(entry.get("center") or "")[:100],
                        "ports": [int(p) for p in entry.get("ports", [80, 443, 9100])
                                  if type(p) is int and p in ALLOWED_PORTS][:5],
                    }
            # Estado antiguo no implica que el equipo siga disponible al reiniciar.
            self.events = saved.get("events", [])[-MAX_EVENTS:]
        except (OSError, ValueError, KeyError, TypeError):
            pass

    def _save(self):
        DATA.mkdir(parents=True, exist_ok=True)
        target = FILE.with_suffix(".tmp")
        body = {"interval": self.interval, "failures": self.failures,
                "targets": list(self.targets.values()), "events": self.events[-MAX_EVENTS:]}
        target.write_text(json.dumps(body, ensure_ascii=False), encoding="utf-8")
        target.replace(FILE)

    def snapshot(self):
        with self.lock:
            hosts = []
            for ip, target in self.targets.items():
                entry = self.states.get(ip, {})
                hosts.append({**target, **entry, "status": entry.get("status", "pending")})
            return {"running": self.running, "intervalSeconds": self.interval,
                    "failureThreshold": self.failures, "hosts": hosts,
                    "completed": self.completed, "total": self.total,
                    "events": list(reversed(self.events[-100:])),
                    "lastCycle": self.last_cycle, "nextCycle": self.next_cycle,
                    "message": "El sondeo se ejecuta solo en este Windows, con el servidor Python abierto."}

    def configure(self, payload):
        if not isinstance(payload, dict) or not isinstance(payload.get("targets"), list):
            raise ValueError("Lista de equipos incorrecta")
        entries = payload["targets"]
        if len(entries) > MAX_HOSTS:
            raise ValueError(f"Máximo {MAX_HOSTS} equipos autorizados")
        interval = payload.get("intervalSeconds", self.interval)
        failures = payload.get("failureThreshold", self.failures)
        if type(interval) is not int or interval not in ALLOWED_INTERVALS:
            raise ValueError("Intervalo no permitido")
        if type(failures) is not int or failures not in (1, 2, 3, 5):
            raise ValueError("Umbral de fallos no permitido")
        incoming = {}
        for entry in entries:
            if not isinstance(entry, dict):
                raise ValueError("Registro de equipo inválido")
            ip = entry.get("ip")
            if not isinstance(ip, str) or not permitted(ip):
                raise ValueError(f"IP no autorizada o inválida: {str(ip)[:50]}")
            if ip in incoming:
                continue
            ports = entry.get("ports", [80, 443, 9100])
            if not isinstance(ports, list) or len(ports) > 5 or any(
                type(port) is not int or port not in ALLOWED_PORTS for port in ports
            ):
                raise ValueError("Puerto no permitido")
            incoming[ip] = {
                **self._metadata(entry),
                "ip": ip,
                "device": str(entry.get("device") or ip)[:100],
                "center": str(entry.get("center") or "")[:100],
                "ports": ports,
            }
        with self.lock:
            self.interval = interval
            self.failures = failures
            self.targets = incoming
            self.last_probe = {}
            self.states = {ip: st for ip, st in self.states.items() if ip in incoming}
            self._save()
            self.wake.set()
        return self.snapshot()

    def command(self, name):
        with self.lock:
            if name == "start":
                if not self.targets:
                    raise ValueError("Primero incorpora equipos con IP válida")
                self.running = True
            elif name == "stop":
                self.running = False
                self.next_cycle = None
            elif name == "run":
                if not self.targets:
                    raise ValueError("No hay equipos para comprobar")
                self.running = True
            else:
                raise ValueError("Acción no reconocida")
            self.wake.set()
        return self.snapshot()

    def _loop(self):
        while True:
            self.wake.wait()
            self.wake.clear()
            while True:
                with self.lock:
                    if not self.running:
                        break
                    targets = list(self.targets.values())
                    interval = min((t.get("intervalSeconds", self.interval) for t in targets), default=self.interval)
                    hour = datetime.now().hour
                    targets = [t for t in targets if ((t["schedule"]["start"] <= hour < t["schedule"]["end"]) if t["schedule"]["start"] < t["schedule"]["end"] else (hour >= t["schedule"]["start"] or hour < t["schedule"]["end"])) and time.monotonic() - self.last_probe.get(t["ip"], -1e10) >= t.get("intervalSeconds", interval)]
                    self.completed = 0
                    self.total = len(targets)
                if targets:
                    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
                        futures = {executor.submit(probe, t["ip"], t["ports"]): t
                                   for t in targets}
                        for future in as_completed(futures):
                            if not self.running:
                                for pending in futures: pending.cancel()
                                break
                            target = futures[future]
                            try:
                                value = future.result()
                            except Exception as err:
                                value = {"status": "error", "detail": str(err)[:120], "ms": None}
                            self._record(target["ip"], value)
                            with self.lock:
                                self.completed += 1
                                self.last_probe[target["ip"]] = time.monotonic()
                with self.lock:
                    self.last_cycle = timestamp()
                    self.next_cycle = datetime.fromtimestamp(
                        time.time() + interval, timezone.utc).isoformat() if self.running else None
                    self._save()
                    still_running = self.running
                if not still_running:
                    break
                self.wake.wait(interval)
                self.wake.clear()

    def _record(self, ip, value):
        with self.lock:
            if ip not in self.targets:
                return
            old = self.states.get(ip, {})
            raw = value["status"]
            consecutive = old.get("failCount", 0) + 1 if raw in ("unreachable", "error") else 0
            # "unreachable" no es avería confirmada hasta N comprobaciones.
            status = ("alert" if consecutive >= self.targets[ip].get("failureThreshold", self.failures) else "suspect") if raw in (
                "unreachable", "error") else raw
            # Alertas cambian solo con transiciones significativas, no cada sondeo.
            previous = old.get("status", "pending")
            if previous != status and (status in ("alert", "online", "tcp") or previous == "alert"):
                self.events.append({"ip": ip, "at": timestamp(),
                                    "kind": "caida" if status == "alert" else "recuperacion"
                                    if previous == "alert" else "cambio",
                                    "from": previous, "to": status})
                self.events = self.events[-MAX_EVENTS:]
            self.states[ip] = {**value, "rawStatus": raw, "status": status,
                               "failCount": consecutive, "at": timestamp()}

MONITOR = Monitor()

