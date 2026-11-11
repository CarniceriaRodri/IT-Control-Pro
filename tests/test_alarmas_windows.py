"""Pruebas de programación y deduplicación del monitor de alarmas Windows."""
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

    def test_due_once_and_persist(self):
        at = self.now[0] + 10_000
        self.worker.configure(self.payload(at))
        self.assertEqual(self.worker.tick(), [])
        self.now[0] = at + 1000
        self.assertEqual(len(self.worker.tick()), 1)
        self.assertEqual(self.worker.tick(), [])
        restored = DesktopAlarms(store=self.path, clock=lambda: self.now[0])
        self.assertEqual(restored.tick(), [])

    def test_disable_and_expired(self):
        at = self.now[0] + 5_000
        self.worker.configure(self.payload(at))
        self.worker.configure({"enabled": False, "sound": "silencio", "items": []})
        self.now[0] += 10_000
        self.assertEqual(self.worker.tick(), [])
        self.worker.configure(self.payload(self.now[0] - 180_000))
        self.assertEqual(self.worker.tick(), [])

    def test_validate(self):
        with self.assertRaises(ValueError):
            self.worker.configure(self.payload(self.now[0] + 200 * 24 * 3600 * 1000))
        with self.assertRaises(ValueError):
            self.worker.configure({"enabled": True, "sound": "evil", "items": []})
        with self.assertRaises(ValueError):
            self.worker.configure({"enabled": True, "sound": "alarma", "items": [
                {"key": "x", "label": "L", "module": "Agenda", "at": "later"}
            ]})

    def test_dedup_and_keep_fired(self):
        at = self.now[0] + 3_000
        p = self.payload(at)
        p["items"].append(dict(p["items"][0]))
        self.worker.configure(p)
        self.assertEqual(len(self.worker.items), 1)
        self.now[0] = at
        self.assertEqual(len(self.worker.tick()), 1)
        self.worker.configure(p)
        self.assertEqual(self.worker.tick(), [])

if __name__ == "__main__":
    unittest.main()
