import json
import tempfile
import threading
import unittest
import urllib.request
import urllib.error
from pathlib import Path
from http.server import ThreadingHTTPServer
from unittest.mock import patch
import servidor_python
from datos_compartidos import SharedData
from servicios_windows import WindowsServices
from alarmas_windows import DesktopAlarms

class ApiTests(unittest.TestCase):
    def test_local_api_origin_sessions_and_migration(self):
        with tempfile.TemporaryDirectory() as temp:
            shared=SharedData(Path(temp)/"data");services=WindowsServices(Path(temp)/"service")
            alarms=DesktopAlarms(Path(temp)/"alarms.json")
            server=ThreadingHTTPServer(("127.0.0.1",0),servidor_python.LocalHandler)
            self.addCleanup(server.server_close)
            with patch.object(servidor_python,"PORT",server.server_port),patch.object(servidor_python,"SHARED",shared),patch.object(servidor_python,"SERVICES",services),patch.object(servidor_python,"DESKTOP_ALARMS",alarms),patch.object(shared,"backup_snapshot"):
                thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
                self.addCleanup(server.shutdown)
                base=f"http://127.0.0.1:{server.server_port}"
                def request(path,body=None,cookie=None,origin=None):
                    headers={"Content-Type":"application/json"}
                    if cookie:headers["Cookie"]=cookie
                    if origin:headers["Origin"]=origin
                    r=urllib.request.urlopen(urllib.request.Request(base+path,data=json.dumps(body).encode() if body is not None else None,headers=headers),timeout=5)
                    return json.loads(r.read()),r.headers
                with self.assertRaises(urllib.error.HTTPError) as err:request("/api/alarms/test-scheduled",{"sound":"silencio"},origin="https://externo.example")
                self.assertEqual(err.exception.code,403)
                result,_=request("/api/alarms/test-scheduled",{"sound":"silencio"})
                self.assertEqual(result["scheduled"],1)
                request("/api/access/configure",{"name":"manuel","password":"password-pruebas-123"})
                result,headers=request("/api/access/login",{"name":"manuel","password":"password-pruebas-123"})
                self.assertTrue(result["admin"]);cookie=headers["Set-Cookie"].split(";")[0]
                request("/api/access/migrate",{"data":{"modules":[{"id":"Equipos","fields":[]}],"records":[],"history":[]},"attachments":{}},cookie)
                request("/api/access/configure",{"authentication":True},cookie)
                with self.assertRaises(urllib.error.HTTPError) as err:request("/api/state")
                self.assertEqual(err.exception.code,401)
                result,_=request("/api/state",cookie=cookie)
                self.assertEqual(result["data"]["modules"][0]["id"],"Equipos")
                request("/api/access/logout",{},cookie)
                with self.assertRaises(urllib.error.HTTPError):request("/api/state",cookie=cookie)
