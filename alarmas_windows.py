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
import uuid
from urllib.parse import urlencode
from servicios_windows import SERVICES

MAX_ALARMS = 5000
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


def show_windows_alarm(label: str, module: str, sound: str, url: str, on_action=None) -> None:
    """Ventana grande, visible y con acciones explícitas. Sin dependencias externas."""
    if os.name != "nt":
        print(f"[IT Control Pro] Alarma: {module} - {label}", flush=True)
        if on_action:
            on_action("snooze", 5)
        return
    sound_windows(sound)
    try:
        import tkinter as tk
        from tkinter import ttk
        root = tk.Tk()
        root.title("IT Control Pro · Recordatorio pendiente")
        root.geometry("660x340")
        root.minsize(550, 290)
        root.configure(bg="#f5f7fb")
        root.attributes("-topmost", True)
        root.lift()
        root.focus_force()
        result = {"done": False}
        def complete(action, minutes=0):
            if result["done"]:
                return
            result["done"] = True
            try:
                if on_action:
                    on_action(action, minutes)
                if action == "open":
                    webbrowser.open(url)
            finally:
                root.destroy()
        root.protocol("WM_DELETE_WINDOW", lambda: complete("snooze", 5))
        tk.Label(root, text="🔔  IT CONTROL PRO · RECORDATORIO", font=("Segoe UI", 16, "bold"),
                 fg="#12345d", bg="#f5f7fb").pack(pady=(25, 12))
        tk.Label(root, text=label, font=("Segoe UI", 15), wraplength=580,
                 justify="center", bg="#f5f7fb", fg="#202d41").pack(padx=30, pady=8)
        tk.Label(root, text=f"Módulo: {module}  |  Pendiente de confirmación",
                 font=("Segoe UI", 11), bg="#f5f7fb", fg="#526477").pack(pady=10)
        buttons = tk.Frame(root, bg="#f5f7fb")
        buttons.pack(pady=20)
        ttk.Button(buttons, text="Atendida", command=lambda: complete("ack")).grid(row=0, column=0, padx=6, pady=5)
        ttk.Button(buttons, text="Abrir aplicación", command=lambda: complete("open")).grid(row=0, column=1, padx=6, pady=5)
        for i, minutes in enumerate((5, 10, 15, 30)):
            ttk.Button(buttons, text=f"Posponer {minutes} min",
                       command=lambda m=minutes: complete("snooze", m)).grid(
                           row=1, column=i % 4, padx=6, pady=9)
        def repeat_sound():
            if not result["done"]:
                threading.Thread(target=sound_windows, args=(sound,), daemon=True).start()
                root.after(30000, repeat_sound)
        root.after(30000, repeat_sound)
        root.after(150, root.lift)
        root.mainloop()
    except Exception as error:
        print(f"No se pudo mostrar la ventana grande: {error}", flush=True)
        # Alternativa nativa cuando Tk no está disponible en la distribución Python.
        stopped = threading.Event()
        def repeat_fallback():
            while not stopped.wait(30): sound_windows(sound)
        threading.Thread(target=repeat_fallback, daemon=True).start()
        try:
            result = ctypes.windll.user32.MessageBoxW(None, label + "\n\nAceptar: atendida. Cancelar: posponer cinco minutos.", "IT Control Pro · " + module, 0x00000001 | 0x00000030 | 0x00040000 | 0x00010000)
            if on_action: on_action("ack" if result == 1 else "snooze", 0 if result == 1 else 5)
        finally:
            stopped.set()


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
        self.snoozed: dict[str, int] = {}
        self.inflight: set[str] = set()
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
            self.snoozed = {k: v for k, v in data.get("snoozed", {}).items()
                            if isinstance(k, str) and type(v) is int}
        except (OSError, ValueError, TypeError, AttributeError):
            pass

    def _save(self):
        self.store.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "enabled": self.enabled,
            "sound": self.sound,
            "items": self.items,
            "fired": sorted(self.fired),
            "snoozed": self.snoozed,
        }
        temp = self.store.with_suffix(".tmp")
        temp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        temp.replace(self.store)

    def _validate_items(self, values, strict=True) -> list[dict]:
        if not isinstance(values, list) or len(values) > MAX_ALARMS:
            raise ValueError("Máximo 5000 alarmas programadas")
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
                    or at < now - MAX_FUTURE_MS or at > now + MAX_FUTURE_MS):
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
            self.snoozed = {key: value for key, value in self.snoozed.items() if key in active}
            self._save()
            return self.snapshot()

    def snapshot(self) -> dict:
        with self.lock:
            now = self.clock()
            pending = [i for i in self.items if i["key"] not in self.fired]
            return {
                "enabled": self.enabled,
                "sound": self.sound,
                "scheduled": len(pending),
                "next": min((max(i["at"], self.snoozed.get(i["key"], 0)) for i in pending), default=None),
                "items": [{**i, "confirmed": i["key"] in self.fired, "snoozedUntil": self.snoozed.get(i["key"], 0)} for i in self.items],
                "heartbeat": now,
                "workerAlive": bool(self.thread and self.thread.is_alive()),
                "supported": os.name == "nt",
            }

    def tick(self) -> list[dict]:
        now = self.clock()
        with self.lock:
            if not self.enabled:
                return []
            if self.inflight:
                return []
            # Nunca descartamos una cita por llegar tarde después de suspensión/reinicio.
            ready = [i for i in self.items if i["key"] not in self.fired
                     and i["key"] not in self.inflight
                     and max(i["at"], self.snoozed.get(i["key"], 0)) <= now][:1]
            for item in ready:
                self.inflight.add(item["key"])
            return ready

    def action(self, key: str, kind: str, minutes: int = 0) -> None:
        with self.lock:
            if kind == "ack":
                self.fired.add(key)
                self.snoozed.pop(key, None)
            elif kind in ("snooze", "open") and (kind == "open" or minutes in (5, 10, 15, 30)):
                minutes = minutes if kind == "snooze" else 5
                self.snoozed[key] = self.clock() + minutes * 60_000
            else:
                # Si falla la ventana, reintentar dentro de un minuto.
                self.snoozed[key] = self.clock() + 60_000
            self.inflight.discard(key)
            self._save()

    def _deliver(self, item: dict, sound: str) -> None:
        with self.popup_lock:
            try:
                def on_action(kind, minutes=0):
                    self.action(item["key"], kind, minutes)
                if not item.get("extraDelivered"):
                    item["extraDelivered"] = True
                    threading.Thread(target=SERVICES.deliver, args=(item["label"], item["module"]), daemon=True).start()
                query={"modulo":item["module"]}
                try:
                    record_id=item["key"].split(":",1)[0]
                    uuid.UUID(record_id)
                    query["registro"]=record_id
                except (ValueError,KeyError):pass
                self.deliver(item["label"], item["module"], sound, self.url + "#" + urlencode(query), on_action)
            except TypeError:
                # Compatibilidad con inyecciones de prueba antiguas de 4 argumentos.
                self.deliver(item["label"], item["module"], sound, self.url)
                self.action(item["key"], "retry")
            except Exception as error:
                print(f"Error al mostrar alarma: {error}", flush=True)
                self.action(item["key"], "retry")
            finally:
                with self.lock:
                    if item["key"] in self.inflight:
                        self.action(item["key"], "retry")

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

    def test_scheduled(self, sound: str) -> dict:
        key = "scheduled-test-" + str(self.clock())
        with self.lock:
            if len(self.items) >= MAX_ALARMS:raise ValueError("Se ha alcanzado el máximo de alarmas")
            self.items.append({"key": key, "label": "Prueba completa de programación", "module": "Agenda", "at": self.clock() + 60_000})
            self.enabled = True
            self.sound = sound if sound in VALID_SOUNDS else "alarma"
            self._save()
        return self.snapshot()

    def test(self, sound: str) -> dict:
        if sound not in VALID_SOUNDS:
            raise ValueError("Sonido no permitido")
        if os.name != "nt":
            raise ValueError("Las alarmas nativas solo están disponibles en Windows")
        threading.Thread(
            target=self._deliver,
            args=({"key": "test-" + str(self.clock()), "label": "Prueba de alarma: el sistema de avisos funciona.", "module": "Agenda"}, sound),
            daemon=True,
        ).start()
        return {"ok": True, "message": "Aviso solicitado a Windows"}


DESKTOP_ALARMS = DesktopAlarms()

