import test from "node:test";
import assert from "node:assert/strict";
import { permittedTarget } from "../server/diagnostics.mjs";

test("solo IPv4 privada/loopback está permitida en diagnóstico Windows", () => {
  for (const ip of ["127.0.0.1","10.0.0.1","172.16.4.2","172.31.255.254","192.168.0.10","169.254.1.2"])
    assert.equal(permittedTarget(ip),true,ip);
  for (const ip of ["8.8.8.8","1.1.1.1","172.32.0.1","192.169.1.1","256.1.1.1","127.0.0.1 & whoami","::1"])
    assert.equal(permittedTarget(ip),false,ip);
});
