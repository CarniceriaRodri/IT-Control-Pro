import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import monitor_python

class GroupMonitorTests(unittest.TestCase):
    def test_large_list_and_location_policy_persist(self):
        with tempfile.TemporaryDirectory() as temp, patch.object(monitor_python,"DATA",Path(temp)),patch.object(monitor_python,"FILE",Path(temp)/"monitor.json"):
            worker=monitor_python.Monitor()
            targets=[{"ip":f"10.1.{i//254}.{i%254+1}","device":f"K{i}","center":"Jerez","location":"H3D · planta 2","groups":["Quioscos","Auxilia"],"ports":[443],"intervalSeconds":60,"failureThreshold":5,"schedule":{"start":7,"end":21}} for i in range(664)]
            state=worker.configure({"targets":targets})
            self.assertEqual(len(state["hosts"]),664)
            self.assertEqual(state["hosts"][0]["location"],"H3D · planta 2")
            restored=monitor_python.Monitor()
            self.assertEqual(restored.snapshot()["hosts"][0]["groups"],["Quioscos","Auxilia"])
            for _ in range(4):worker._record(targets[0]["ip"],{"status":"unreachable"})
            self.assertEqual(worker.states[targets[0]["ip"]]["status"],"suspect")
            worker._record(targets[0]["ip"],{"status":"unreachable"})
            self.assertEqual(worker.states[targets[0]["ip"]]["status"],"alert")
            worker.command("stop")

    def test_invalid_group_policy_rejected(self):
        worker=monitor_python.Monitor()
        with self.assertRaises(ValueError):worker.configure({"targets":[{"ip":"10.1.1.1","schedule":{"start":-1,"end":25}}]})

    def test_explicit_run_bypasses_interval_and_schedule(self):
        with tempfile.TemporaryDirectory() as temp, patch.object(monitor_python,"DATA",Path(temp)),patch.object(monitor_python,"FILE",Path(temp)/"monitor.json"):
            worker=monitor_python.Monitor()
            host={"ip":"10.2.3.4","ports":[443],"intervalSeconds":600,"schedule":{"start":23,"end":24}}
            worker.configure({"targets":[host]})
            worker.last_probe[host["ip"]]=monitor_python.time.monotonic()
            targets=list(worker.targets.values())
            self.assertEqual(worker._eligible_targets(targets),[])
            self.assertEqual(worker._eligible_targets(targets,force=True),targets)
