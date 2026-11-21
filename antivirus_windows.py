"""Análisis local mediante Microsoft Defender Antivirus en Windows.

No altera la configuración del antivirus ni borra archivos por su cuenta.
Defender aplica la respuesta configurada en Windows (bloqueo/cuarentena/limpieza).
"""
from __future__ import annotations

import os
from pathlib import Path
import re
import subprocess
import threading
from datetime import datetime, timezone
import xml.etree.ElementTree as ET


class DefenderScanner:
    def __init__(self):
        self._lock = threading.Lock()
        self._state = {
            "supported": os.name == "nt",
            "available": False,
            "active": False,
            "mode": None,
            "startedAt": None,
            "finishedAt": None,
            "exitCode": None,
            "message": "",
            "output": "",
            "detections": [],
        }

    def _binary(self):
        if os.name != "nt":
            return None
        program_data = Path(os.environ.get("ProgramData", r"C:\ProgramData"))
        platform = program_data / "Microsoft" / "Windows Defender" / "Platform"
        candidates = list(platform.glob("*/MpCmdRun.exe")) if platform.is_dir() else []
        def version(path):
            match = re.search(r"(\d+(?:\.\d+)+)", str(path.parent.name))
            return tuple(int(part) for part in match.group(1).split(".")) if match else ()
        if candidates:
            return str(max(candidates, key=version))
        program_files = Path(os.environ.get("ProgramFiles", r"C:\Program Files"))
        fallback = program_files / "Windows Defender" / "MpCmdRun.exe"
        return str(fallback) if fallback.is_file() else None

    def status(self):
        binary = self._binary()
        with self._lock:
            state = dict(self._state)
        state["supported"] = os.name == "nt"
        state["available"] = bool(binary)
        state["binary"] = binary
        if os.name != "nt":
            state["message"] = "El análisis local está disponible en Windows con Microsoft Defender."
        elif not binary:
            state["message"] = "No se encuentra Microsoft Defender Antivirus en este equipo."
        return state

    def start(self, payload):
        if os.name != "nt":
            raise ValueError("El análisis antivirus local solo está disponible en Windows.")
        binary = self._binary()
        if not binary:
            raise ValueError("No se encuentra MpCmdRun de Microsoft Defender Antivirus.")
        if not isinstance(payload, dict):
            raise ValueError("Parámetros incorrectos.")
        mode = payload.get("mode")
        args = [binary, "-Scan"]
        if mode == "quick":
            args += ["-ScanType", "1"]
            label = "Análisis rápido"
        elif mode == "full":
            args += ["-ScanType", "2"]
            label = "Análisis completo"
        elif mode == "custom":
            raw = payload.get("path")
            if not isinstance(raw, str) or not raw.strip() or len(raw) > 1024:
                raise ValueError("Escribe la ruta local de un archivo o carpeta.")
            raw = raw.strip().strip('"')
            if raw.startswith(("\\\\", "//")):
                raise ValueError("Por seguridad, el análisis personalizado solo acepta rutas locales, no rutas de red.")
            target = Path(raw)
            if not target.is_absolute() or not target.exists():
                raise ValueError("La ruta debe existir y ser absoluta, por ejemplo C:\\Users\\tu_usuario\\Downloads.")
            args += ["-ScanType", "3", "-File", str(target)]
            label = "Análisis personalizado"
        else:
            raise ValueError("Elige análisis rápido, completo o personalizado.")

        started = datetime.now(timezone.utc).isoformat()
        with self._lock:
            if self._state["active"]:
                raise ValueError("Ya hay un análisis en curso.")
            self._state = {
                "supported": True, "available": True, "active": True,
                "mode": label, "startedAt": started, "finishedAt": None,
                "exitCode": None, "message": "Microsoft Defender está analizando el equipo.",
                "output": "", "detections": [],
            }
        threading.Thread(target=self._run, args=(args, started), daemon=True).start()
        return self.status()

    def _recent_events(self, since):
        """Lee los eventos recientes 1116 (detección) y 1117 (acción de Defender)."""
        if os.name != "nt":
            return []
        try:
            done = subprocess.run(
                ["wevtutil.exe", "qe", "Microsoft-Windows-Windows Defender/Operational",
                 "/q:*[System[(EventID=1116 or EventID=1117)]]", "/rd:true", "/c:80", "/f:xml"],
                shell=False, capture_output=True, text=True, encoding="utf-8",
                errors="replace", timeout=12,
            )
            if done.returncode != 0:
                return []
            events = []
            for block in re.findall(r"<Event\b[\s\S]*?</Event>", done.stdout):
                try:
                    root = ET.fromstring(block)
                    eid = root.find(".//{*}EventID")
                    created = root.find(".//{*}TimeCreated")
                    when = created.get("SystemTime", "") if created is not None else ""
                    if not eid or int(eid.text or 0) not in (1116, 1117) or when < since:
                        continue
                    data = {}
                    for node in root.findall(".//{*}EventData/{*}Data"):
                        data[node.get("Name", "Dato")] = node.text or ""
                    events.append({
                        "eventId": int(eid.text or 0),
                        "time": when,
                        "name": data.get("Threat Name") or data.get("Nombre de amenaza") or "Amenaza detectada",
                        "path": data.get("Path") or data.get("Ruta") or "",
                        "severity": data.get("Severity") or data.get("Gravedad") or "",
                        "action": data.get("Action Name") or data.get("Nombre de acción") or "",
                        "status": data.get("Status Description") or data.get("Descripción del estado") or "",
                    })
                except (ET.ParseError, ValueError):
                    continue
            return events
        except (OSError, subprocess.TimeoutExpired):
            return []

    def _run(self, args, started):
        output = ""
        try:
            process = subprocess.Popen(
                args, shell=False, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, encoding="utf-8", errors="replace",
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
            if process.stdout:
                for line in process.stdout:
                    output = (output + line)[-12000:]
            code = process.wait()
            detections = self._recent_events(started)
            if detections:
                message = f"Defender registró {sum(1 for item in detections if item['eventId'] == 1116)} detección/es. Revisa la acción y Protección contra virus y amenazas."
            elif code == 0:
                message = "Defender terminó el análisis sin eventos de detección registrados. Esto no garantiza que el equipo esté libre de todo malware."
            elif code == 2:
                message = "Defender terminó con detección pendiente, acción requerida o error. Revisa Protección contra virus y amenazas."
            else:
                message = f"El análisis terminó con código {code}. Revisa Protección contra virus y amenazas."
            with self._lock:
                self._state.update({
                    "active": False, "finishedAt": datetime.now(timezone.utc).isoformat(),
                    "exitCode": code, "message": message, "output": output,
                    "detections": detections,
                })
        except (OSError, subprocess.SubprocessError) as error:
            with self._lock:
                self._state.update({
                    "active": False, "finishedAt": datetime.now(timezone.utc).isoformat(),
                    "message": "No se pudo ejecutar Microsoft Defender: " + str(error),
                    "output": output, "detections": [],
                })


ANTIVIRUS = DefenderScanner()
