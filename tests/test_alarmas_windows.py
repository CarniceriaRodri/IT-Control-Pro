"""Pruebas de alarmas reales, persistencia y confirmación de Windows."""
import tempfile
import unittest
from pathlib import Path
from alarmas_windows import DesktopAlarms


class AlarmTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.now = [1_800_000_000_000]
        self.delivered = []
        self.path = Path(self.temp.name) / "alarms.json"
        self.worker = DesktopAlarms(
            store=self.path,
            clock=lambda: self.now[0],
            deliver=lambda *args: self.delivered.append(args),
        )

    def payload(self, at, key="e1"):
        return {"enabled": True, "sound": "alarma", "items": [
            {"key": key, "label": "Revisar impresora", "module": "Agenda", "at": at}
        ]}

    def test_pending_until_ack_and_persist(self):
        at = self.now[0] + 10_000
        self.worker.configure(self.payload(at))
        self.assertEqual(self.worker.tick(), [])
        self.now[0] = at + 1000
        self.assertEqual(len(self.worker.tick()), 1)
        self.assertEqual(self.worker.tick(), [])  # En primer plano: sin duplicados.
        self.worker.action("e1", "ack")
        self.assertEqual(self.worker.tick(), [])
        restored = DesktopAlarms(store=self.path, clock=lambda: self.now[0])
        self.assertEqual(restored.tick(), [])

    def test_restart_retries_unconfirmed_alarm(self):
        at = self.now[0] + 5_000
        self.worker.configure(self.payload(at))
        self.now[0] = at + 15 * 60_000  # Equipo suspendido.
        self.assertEqual(len(self.worker.tick()), 1)
        restored = DesktopAlarms(store=self.path, clock=lambda: self.now[0])
        self.assertEqual(len(restored.tick()), 1)

    def test_snooze_reappears_and_survives_restart(self):
        at = self.now[0] + 5_000
        self.worker.configure(self.payload(at))
        self.now[0] = at
        self.assertEqual(len(self.worker.tick()), 1)
        self.worker.action("e1", "snooze", 10)
        self.assertEqual(self.worker.tick(), [])
        self.now[0] += 9 * 60_000
        restored = DesktopAlarms(store=self.path, clock=lambda: self.now[0])
        self.assertEqual(restored.tick(), [])
        self.now[0] += 61_000
        self.assertEqual(len(restored.tick()), 1)

    def test_failed_delivery_retries_in_one_minute(self):
        at = self.now[0] + 5_000
        self.worker.configure(self.payload(at))
        self.now[0] = at
        items = self.worker.tick()
        self.worker._deliver(items[0], "silencio")
        self.assertEqual(self.worker.tick(), [])
        self.now[0] += 61_000
        self.assertEqual(len(self.worker.tick()), 1)

    def test_disable_and_invalid_values(self):
        at = self.now[0] + 5_000
        self.worker.configure(self.payload(at))
        self.worker.configure({"enabled": False, "sound": "silencio", "items": []})
        self.now[0] += 10_000
        self.assertEqual(self.worker.tick(), [])
        with self.assertRaises(ValueError):
            self.worker.configure(self.payload(self.now[0] + 200 * 24 * 3600 * 1000))
        with self.assertRaises(ValueError):
            self.worker.configure({"enabled": True, "sound": "evil", "items": []})

    def test_dedup_and_keep_confirmed(self):
        at = self.now[0] + 3_000
        p = self.payload(at)
        p["items"].append(dict(p["items"][0]))
        self.worker.configure(p)
        self.assertEqual(len(self.worker.items), 1)
        self.now[0] = at
        self.assertEqual(len(self.worker.tick()), 1)
        self.worker.action("e1", "ack")
        self.worker.configure(p)
        self.assertEqual(self.worker.tick(), [])


if __name__ == "__main__":
    unittest.main()
