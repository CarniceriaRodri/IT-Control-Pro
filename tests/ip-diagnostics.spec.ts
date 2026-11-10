import { test, expect } from "@playwright/test";
import { analyzeIPv4, ipv4Number, prefixNumber } from "../src/data/ip-tools";

test("IPv4, CIDR y máscara contigua", () => {
  expect(ipv4Number("192.168.1.10")).toBe(3232235786);
  expect(ipv4Number("999.1.1.1")).toBeUndefined();
  expect(ipv4Number("192.168.001.10")).toBeUndefined();
  expect(prefixNumber("255.255.255.0")).toBe(24);
  expect(prefixNumber("/31")).toBe(31);
  expect(prefixNumber("255.0.255.0")).toBeUndefined();
  const result = analyzeIPv4("192.168.1.10", "255.255.255.0", "192.168.1.1");
  expect(result.network).toBe("192.168.1.0");
  expect(result.broadcast).toBe("192.168.1.255");
  expect(result.first).toBe("192.168.1.1");
  expect(result.last).toBe("192.168.1.254");
  expect(result.usable).toBe(254);
  expect(result.gatewayStatus).toContain("misma subred");
  expect(analyzeIPv4("10.0.0.1", "32").usable).toBe(1);
  expect(analyzeIPv4("10.0.0.1", "31").usable).toBe(2);
  expect(analyzeIPv4("169.254.3.4", "16").type).toContain("APIPA");
  expect(analyzeIPv4("127.0.0.1", "8").type).toContain("Loopback");
  expect(()=>analyzeIPv4("256.1.2.3","24")).toThrow();
  expect(()=>analyzeIPv4("10.1.2.3","255.255.0.255")).toThrow();
});

test("el apartado Redes tiene diagnóstico IP y Agenda ya no exige tarea duplicada", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("navigation").getByRole("button",{name:"Redes",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Comprobaciones de red e IP"})).toBeVisible();
  await page.getByLabel("Dirección IP a comprobar").fill("10.10.20.13");
  await page.getByLabel("Máscara de subred").fill("24");
  await page.getByRole("button",{name:"Calcular subred"}).click();
  await expect(page.getByRole("region",{name:"Resultado de cálculo IPv4"})).toContainText("10.10.20.0");
  await expect(page.getByText("Ping (2 paquetes)")).toHaveCount(0);
  await page.getByRole("navigation").getByRole("button",{name:"Agenda",exact:true}).click();
  await page.getByRole("button",{name:"Nuevo registro",exact:true}).click();
  await expect(page.getByRole("dialog").getByLabel("Tarea")).toHaveCount(0);
});
