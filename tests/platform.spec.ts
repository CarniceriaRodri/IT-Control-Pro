import { test, expect } from "@playwright/test";
import { initialModules, field, validate, legacy } from "../src/domain/model";
import { parseBackup, fromLegacy } from "../src/data/backup";
test("rechaza copias incompletas, relaciones falsas y opciones no válidas", () => {
  expect(() =>
    parseBackup('{"app":"IT Control Pro","version":1,"data":{}}'),
  ).toThrow();
  expect(() => fromLegacy({ Centros: {} }, true)).toThrow();
  const mod = initialModules()[0];
  mod.fields = [
    { ...field("centro", "Centro", "relación"), target: "Centros" },
  ];
  expect(() => validate(mod, { centro: "desconocido" }, [], "1")).toThrow();
});
test("migra una sola vez, conserva claves extra y permite CRUD sin conexión", async ({
  page,
  context,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "it-control-pro-demo-v01",
      JSON.stringify({
        Inventario: [
          {
            equipo: "Impresora de prueba",
            serie: "ABC",
            anterior: "conservar",
          },
        ],
      }),
    ),
  );
  await page.goto("./");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Inventario", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "Impresora de prueba" }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Serie", { exact: true }).fill("ABC-2");
  await page.getByText("Guardar registro", { exact: true }).click();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise((r) =>
        navigator.serviceWorker.addEventListener("controllerchange", r, {
          once: true,
        }),
      );
  });
  const manifest = await page
    .locator("link[rel=manifest]")
    .getAttribute("href");
  const manifestUrl = new URL(manifest!, page.url());
  const json = await (await page.request.get(manifestUrl.href)).json();
  for (const i of json.icons)
    expect(
      (await page.request.get(new URL(i.src, manifestUrl).href)).status(),
    ).toBe(200);
  await context.setOffline(true);
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Inventario", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "ABC-2", exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Administración" })
    .click();
  const download = page.waitForEvent("download");
  await page.getByText("Exportar JSON").click();
  const file = await (await download).path();
  const { readFileSync } = await import("node:fs");
  const saved = JSON.parse(readFileSync(file!, "utf8"));
  const inventory=saved.data.records.find((r:{module:string})=>r.module==="Inventario");
  expect(inventory.values.anterior).toBe("conservar");
  expect(inventory.rev).toBe(2);
  expect(saved.data.history).toHaveLength(1);
});
test("crea módulos y campos desde Android, oculta sin perder datos", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./");
  await page.getByRole("button", { name: "Ajustes", exact: true }).click();
  await page
    .getByLabel("Nombre del módulo nuevo")
    .fill("Teléfonos corporativos");
  await page.getByText("Crear módulo", { exact: true }).click();
  await page.getByText("Añadir campo", { exact: true }).click();
  await page.getByLabel("Nombre del campo").fill("Extensión");
  await page.getByText("Guardar campo").click();
  await page.getByRole("button", { name: "Módulos", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByText("Teléfonos corporativos")
    .click();
  await page.getByText("Nuevo registro", { exact: true }).click();
  await page.getByLabel("Nombre *", { exact: true }).fill("Teléfono de prueba");
  await page.getByRole("dialog").getByLabel("Extensión",{exact:true}).fill("1234");
  await page.getByText("Guardar registro").click();
  await expect(page.getByRole("cell", { name: "1234" })).toBeVisible();
  await page.getByRole("button", { name: "Ajustes", exact: true }).click();
  await page
    .getByLabel("Módulo que quieres configurar")
    .selectOption({ label: "Teléfonos corporativos" });
  await page
    .locator(".fieldRow")
    .filter({ hasText: "Extensión" })
    .getByText("Editar")
    .click();
  await page.getByLabel("Visible", { exact: true }).uncheck();
  await page.getByText("Guardar campo").click();
  await expect(
    page.locator(".fieldRow").filter({ hasText: "Extensión" }),
  ).toContainText("Oculto");
});

test("restaura la copia v1 con vista previa y recupera la base anterior", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Administración" })
    .click();
  const originalCount=await page.evaluate(()=>new Promise<number>((resolve,reject)=>{const request=indexedDB.open("it-control-pro-platform",2);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result;const count=db.transaction("records").objectStore("records").count();count.onsuccess=()=>{resolve(count.result);db.close();};};}));
  const d = Object.fromEntries(
    Object.keys(legacy).map(id=>[id,id === "Centros" ? [{ nombre: "Centro ficticio" }] : []]),
  );
  await page.getByLabel("Importar JSON").setInputFiles({
    name: "copia.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ app: "IT Control Pro", version: 1, data: d }),
    ),
  });
  await expect(page.getByRole("dialog")).toContainText("1 registros");
  await page.getByText("Confirmar restauración").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByText("Recuperar copia anterior").click();
  await expect(page.getByRole("dialog")).toContainText(originalCount+" registros");
  await page.getByText("Confirmar restauración").click();
  await page.getByRole("navigation").getByText("Centros").click();
  await expect(page.getByRole("cell",{name:"Centro ficticio",exact:true})).toHaveCount(0);
  await expect(page.locator(".adjustableTable")).toContainText(originalCount+" registros");
});
test("rechaza una edición obsoleta entre pestañas", async ({
  page,
  context,
}) => {
  await page.goto("./");
  const b = await context.newPage();
  await b.goto(page.url());
  for (const p of [page, b]) {
    await p.getByRole("navigation").getByText("Centros").click();
    await p.getByText("Nuevo registro", { exact: true }).click();
    await p.getByLabel("Nombre *").fill("Centro de prueba");
  }
  await page.getByText("Guardar registro").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await b.getByText("Guardar registro").click();
  await expect(b.getByRole("alert")).toContainText("Otra pestaña");
});
