import unittest
from unittest.mock import patch
from monitor_python import permitted, MONITOR

class MonitoringTests(unittest.TestCase):
    def test_ip_policy(self):
        for ip in ("10.41.55.213", "192.168.1.15", "172.16.1.10"):
            self.assertTrue(permitted(ip), ip)
        for ip in ("8.8.8.8", "127.0.0.1", "224.0.0.1", "not-ip", "999.1.1.1"):
            self.assertFalse(permitted(ip), ip)

    def test_config_limit_and_validation(self):
        with self.assertRaises(ValueError):
            MONITOR.configure({"targets": [{"ip": "8.8.8.8"}]})
        with self.assertRaises(ValueError):
            MONITOR.configure({"targets": [{"ip": "10.1.1.1", "ports": [12345]}]})
        with self.assertRaises(ValueError):
            MONITOR.configure({"targets": [], "intervalSeconds": 1})
        with self.assertRaises(ValueError):
            MONITOR.configure({"targets": [], "failureThreshold": 0})

if __name__ == "__main__":
    unittest.main()
