"""Alarmas de escritorio para IT Control Pro, sin librerías ni permisos de Chrome.

Solo recibe citas explícitamente habilitadas desde el navegador local.
El servidor Python debe permanecer abierto para programar los avisos.
"""
from __future__ import annotations

import ctypes
import json
import os
from pathlib import Path
import threading
import time
import webbrowser

MAX_ALARMS = 250
MAX_FUTURE_MS = 180 * 24 * 3600 * 1000
VALID_SOUNDS = {"aviso", "alarma", "campana", "silencio"}
STORE = Path(os.environ.get("LOCALAPPDATA") or Path.home() / ".it_control_pro") / "IT-Control-Pro" / "alarmas_windows.json"


def sound_windows(name: str) -> None:
    if os.name != "nt" or name == "silencio":
        return
    try:
        import winsound
        alias = {
            "aviso": "SystemAsterisk",
            "alarma": "SystemExclamation",
            "campana": "SystemQuestion",
        }.get(name, "SystemExclamation")
        winsound.PlaySound(alias, winsound.SND_ALIAS | winsound.SND_SYNC)
    except Exception:
        try:
            import winsound
            winsound.MessageBeep()
        except Exception:
            pass


def show_windows_alarm(label: str, module: str, sound: str, url: str) -> None:
    """Diálogo del propio Windows; no necesita Chrome ni notificaciones web."""
    if os.name != "nt":
        print(f"[IT Control Pro] Alarma: {module} - {label}", flush=True)
        return
    sound_windows(sound)
    title = "IT Control Pro - Recordatorio"
    body = f"{label}\n\nOrigen: {module}\n\n¿Abrir IT Control Pro?"
    try:
        # Sí = abrir; No = cerrar. Diálogo topmost, sin modalidad del sistema.
        answer = ctypes.windll.user32.MessageBoxW(
            None, body, title, 0x00000004 | 0x00040000 | 0x00010000
        )
        if answer == 6:
            webbrowser.open(url)
    except Exception as error:
        print(f"No se pudo mostrar el aviso de Windows: {error}", flush=True)


class DesktopAlarms:
    def __init__(self, store: Path = STORE, deliver=show_windows_alarm, clock=None):
        self.store = store
        self.deliver = deliver
        self.clock = clock or (lambda: int(time.time() * 1000))
        self.lock = threading.RLock()
        self.popup_lock = threading.Lock()
        self.enabled = False
        self.sound = "alarma"
        self.items: list[dict] = []
        self.fired: set[str] = set()
        self.url = "http://127.0.0.1:8788/"
        self.thread: threading.Thread | None = None
        self._read()

    def _read(self):
        try:
            data = json.loads(self.store.read_text(encoding="utf-8"))
            self.enabled = data.get("enabled") is True
            self.sound = data.get("sound") if data.get("sound") in VALID_SOUNDS else "alarma"
            self.items = self._validate_items(data.get("items", []), strict=False)
            self.fired = {v for v in data.get("fired", []) if isinstance(v, str)}
        except (OSError, ValueError, TypeError, AttributeError):
            pass

    def _save(self):
        self.store.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "enabled": self.enabled,
            "sound": self.sound,
            "items": self.items,
            "fired": sorted(self.fired),
        }
        temp = self.store.with_suffix(".tmp")
        temp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        temp.replace(self.store)

    def _validate_items(self, values, strict=True) -> list[dict]:
        if not isinstance(values, list) or len(values) > MAX_ALARMS:
            raise ValueError("Máximo 250 alarmas programadas")
        result = []
        keys = set()
        now = self.clock()
        for item in values:
            if not isinstance(item, dict):
                raise ValueError("Alarma incorrecta")
            key, label, module, at = item.get("key"), item.get("label"), item.get("module"), item.get("at")
            if (not isinstance(key, str) or not 1 <= len(key) <= 160
                    or not isinstance(label, str) or not 1 <= len(label) <= 200
                    or not isinstance(module, str) or module not in ("Agenda", "Tareas", "Movimientos")
                    or type(at) is not int
                    or at < now - 24 * 3600 * 1000 or at > now + MAX_FUTURE_MS):
                if strict:
                    raise ValueError("Fecha, identificador o texto de alarma incorrectos")
                continue
            if key in keys:
                continue
            keys.add(key)
            result.append({"key": key, "label": label.strip(), "module": module, "at": at})
        return result

    def configure(self, payload: dict) -> dict:
        if not isinstance(payload, dict):
            raise ValueError("Configuración incorrecta")
        if type(payload.get("enabled")) is not bool:
            raise ValueError("Indica enabled: true o false")
        sound = payload.get("sound", "alarma")
        if sound not in VALID_SOUNDS:
            raise ValueError("Sonido no permitido")
        new_items = self._validate_items(payload.get("items", []))
        with self.lock:
            self.enabled = payload["enabled"]
            self.sound = sound
            self.items = new_items if self.enabled else []
            active = {i["key"] for i in self.items}
            self.fired.intersection_update(active)
            self._save()
            return self.snapshot()

    def snapshot(self) -> dict:
        with self.lock:
            now = self.clock()
            pending = [i for i in self.items if i["key"] not in self.fired and i["at"] >= now]
            return {
                "enabled": self.enabled,
                "sound": self.sound,
                "scheduled": len(pending),
                "next": min((i["at"] for i in pending), default=None),
                "supported": os.name == "nt",
            }

    def tick(self) -> list[dict]:
        now = self.clock()
        with self.lock:
            if not self.enabled:
                return []
            # No inundar el escritorio con alarmas muy antiguas si Windows despierta.
            ready = [i for i in self.items if i["key"] not in self.fired and i["at"] <= now]
            for item in ready:
                self.fired.add(item["key"])
            if ready:
                self._save()
            return [i for i in ready if now - i["at"] <= 2 * 60 * 1000]

    def _deliver(self, item: dict, sound: str) -> None:
        with self.popup_lock:
            self.deliver(item["label"], item["module"], sound, self.url)

    def run(self):
        while True:
            try:
                for item in self.tick():
                    threading.Thread(target=self._deliver, args=(item, self.sound), daemon=True).start()
            except Exception as error:
                print(f"Error de alarmas Windows: {error}", flush=True)
            time.sleep(1)

    def start(self, url: str):
        with self.lock:
            self.url = url
            if not self.thread or not self.thread.is_alive():
                self.thread = threading.Thread(target=self.run, name="ITControlAlarmasWindows", daemon=True)
                self.thread.start()

    def test(self, sound: str) -> dict:
        if sound not in VALID_SOUNDS:
            raise ValueError("Sonido no permitido")
        if os.name != "nt":
            raise ValueError("Las alarmas nativas solo están disponibles en Windows")
        threading.Thread(
            target=self._deliver,
            args=({"label": "Prueba de alarma: el sistema de avisos funciona.", "module": "Agenda"}, sound),
            daemon=True,
        ).start()
        return {"ok": True, "message": "Aviso solicitado a Windows"}


DESKTOP_ALARMS = DesktopAlarms()
