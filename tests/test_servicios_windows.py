import base64
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from servicios_windows import WindowsServices
from datos_compartidos import SharedData

class ServicesTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.services=WindowsServices(Path(self.tmp.name)/"service")

    def test_complete_backup_verified_retained_and_restored(self):
        raw=b"documento interno";key=hashlib.sha256(raw).hexdigest()
        backup={"app":"IT Control Pro","version":3,"data":{"modules":[],"records":[{"files":[{"hash":key,"size":len(raw)}]}],"history":[]},"attachments":{key:base64.b64encode(raw).decode()}}
        self.services.snapshot(backup)
        files=list(Path(self.services.settings["backupDir"]).glob("*.json"))
        self.assertEqual(json.loads(files[0].read_text()),backup)
        restored=WindowsServices(self.services.home)
        self.assertTrue(restored.status()["hasSnapshot"])
        self.assertIsNotNone(restored.last_backup)
        backup["attachments"][key]=base64.b64encode(b"corrupto").decode()
        with self.assertRaises(ValueError):self.services.snapshot(backup)

    def test_channel_validation_and_no_implicit_email(self):
        self.assertEqual(self.services.settings["channel"],"none")
        with self.assertRaises(ValueError):self.services.configure({"channel":"smtp","recipient":"a@b\r\nBcc:x@y"})
        self.services.configure({"channel":"thunderbird","recipient":"yo@example.org","intervalHours":168,"retention":4})
        self.assertEqual(self.services.settings["intervalHours"],168)

class SharedTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.shared=SharedData(self.tmp.name)
        self.shared.configure({"name":"manuel","password":"password-pruebas-123"})
        self.admin=self.shared.login("manuel","password-pruebas-123")
        self.shared.configure({"name":"tecnico","password":"password-pruebas-456"},self.admin)
        self.basic=self.shared.login("tecnico","password-pruebas-456")
        self.shared.state["data"]={"modules":[{"id":"Equipos","fields":[]}],"records":[],"history":[]}
        self.shared.config["shared"]=True

    def test_open_access_does_not_grant_administration(self):
        with self.assertRaises(PermissionError):self.shared.configure({"authentication":False},"")
        with self.assertRaises(PermissionError):self.shared.configure({"authentication":True},self.basic)
        self.shared.configure({"authentication":True},self.admin)
        with self.assertRaises(PermissionError):self.shared.authorize("")
        self.shared.authorize(self.basic)

    def test_commit_permissions_conflicts_and_author(self):
        draft=json.loads(json.dumps(self.shared.state["data"]))
        draft["records"].append({"id":"r1","module":"Equipos","values":{"ip":"10.1.1.1"}})
        with patch.object(self.shared,"backup_snapshot"):
            self.shared.commit({"version":1,"data":draft,"action":"Alta"},self.basic)
        self.assertEqual(self.shared.state["data"]["history"][-1]["operator"],"tecnico")
        with self.assertRaises(ValueError):self.shared.commit({"version":1,"data":draft},self.basic)
        draft=json.loads(json.dumps(self.shared.state["data"]))
        draft["modules"][0]["name"]="Cambio de esquema"
        with self.assertRaises(PermissionError):self.shared.commit({"version":2,"data":draft},self.basic)
        with patch.object(self.shared,"backup_snapshot"):
            self.shared.commit({"version":2,"data":draft},self.admin)
        self.assertEqual(self.shared.state["version"],3)

    def test_disabled_user_and_password_hash(self):
        self.assertNotIn("password-pruebas",json.dumps(self.shared.config))
        self.shared.configure({"name":"tecnico","active":False},self.admin)
        self.assertIsNone(self.shared.actor(self.basic))
        with self.assertRaises(ValueError):self.shared.login("tecnico","password-pruebas-456")
        restored=SharedData(self.tmp.name)
        self.assertTrue(restored.verify(restored.config["users"]["manuel"],"password-pruebas-123"))
