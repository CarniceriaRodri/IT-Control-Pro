import { test, expect } from "@playwright/test";
import { zipSync, strToU8 } from "fflate";
import { readFileSync } from "node:fs";
import { buckets } from "../src/data/periods";
const office = "urn:oasis:names:tc:opendocument:xmlns:office:1.0";
const xml =
  '<office:document-content xmlns:office="' +
  office +
  '" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"><office:body><office:spreadsheet><table:table table:name="Activos">' +
  ["Número de serie", "CAN001", "CAN001"]
    .map(
      (v) =>
        "<table:table-row><table:table-cell><text:p>" +
        v +
        "</text:p></table:table-cell></table:table-row>",
    )
    .join("") +
  "</table:table></office:spreadsheet></office:body></office:document-content>";
const navigate = async (p: import("@playwright/test").Page, name: string) =>
  p.getByRole("navigation").getByRole("button", { name, exact: true }).click();
test("ODS, adjuntos de módulo, foto de registro, copia periódica y restauración en otro dispositivo", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.goto("./");
  await navigate(page, "Administración");
  await page.getByText("Crear módulo desde una tabla").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nombre del módulo").fill("Parque móvil");
  await dialog.getByLabel("Tabla de LibreOffice").setInputFiles({
    name: "inventario.ods",
    mimeType: "application/vnd.oasis.opendocument.spreadsheet",
    buffer: Buffer.from(zipSync({ "content.xml": strToU8(xml) })),
  });
  await expect(dialog).toContainText("1 altas · 1 duplicadas omitidas");
  await dialog.getByLabel("Adjuntar archivo").setInputFiles({
    name: "guía.odt",
    mimeType: "application/vnd.oasis.opendocument.text",
    buffer: Buffer.from("documento de prueba"),
  });
  await expect(dialog).toContainText("guía.odt");
  await dialog.getByText("Confirmar importación").click();
  await navigate(page, "Parque móvil");
  await expect(page.getByRole("cell", { name: "CAN001" })).toBeVisible();
  await page.getByText("Editar", { exact: true }).click();
  const photo = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jE8sAAAAASUVORK5CYII=",
    "base64",
  );
  await dialog.getByLabel("Tomar foto").setInputFiles({
    name: "equipo.png",
    mimeType: "image/png",
    buffer: photo,
  });
  await expect(dialog).toContainText("equipo.png");
  await dialog.getByText("Guardar registro").click();
  await navigate(page, "Administración");
  await page.getByText(/^Diarias \(/).click();
  const download = page.waitForEvent("download");
  await page
    .locator("details[open]")
    .getByRole("button", { name: "Descargar", exact: true })
    .click();
  const file = await (await download).path();
  const backup = JSON.parse(readFileSync(file!, "utf8"));
  expect(Object.keys(backup.attachments)).toHaveLength(2);
  const ctx = await browser.newContext();
  const other = await ctx.newPage();
  await other.goto(baseURL!);
  await navigate(other, "Administración");
  const corrupted = structuredClone(backup);
  delete corrupted.attachments[Object.keys(corrupted.attachments)[0]];
  await other.getByLabel("Importar JSON").setInputFiles({
    name: "mal.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(corrupted)),
  });
  await expect(other.getByRole("status")).toContainText("Archivo ausente");
  await other.getByLabel("Importar JSON").setInputFiles(file!);
  await other.getByText("Confirmar restauración").click();
  await navigate(other, "Parque móvil");
  await other.getByText("Archivos y fotos (1)").click();
  await expect(other.getByRole("dialog")).toContainText("guía.odt");
  await other.getByLabel("Cerrar", { exact: true }).click();
  await other.getByText("Editar", { exact: true }).click();
  const downloaded = other.waitForEvent("download");
  await other
    .getByRole("dialog")
    .getByText("Descargar", { exact: true })
    .click();
  expect(readFileSync((await (await downloaded).path())!)).toEqual(photo);
  await ctx.close();
});
test("CSV mapeado con vista previa y exportación para Calc", async ({
  page,
}) => {
  await page.goto("./");
  await navigate(page, "Centros");
  await page.getByText("Importar tabla", { exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Tabla de LibreOffice").setInputFiles({
    name: "datos.csv",
    mimeType: "text/csv",
    buffer: Buffer.from('Sede;Zona\n"Centro; uno";Norte\n"Centro; uno";Norte'),
  });
  await dialog.getByLabel("Sede", { exact: true }).selectOption("nombre");
  await expect(dialog).toContainText("1 altas · 1 duplicadas omitidas");
  await dialog.getByText("Confirmar importación").click();
  const result = page.waitForEvent("download");
  await page.getByText("Exportar CSV").click();
  expect(readFileSync((await (await result).path())!, "utf8")).toContain(
    '"Centro; uno";Norte',
  );
});
test("periodos semanales comienzan en lunes incluso entre años", () => {
  expect(buckets(new Date(2027, 0, 1, 12))).toEqual({
    day: "2027-01-01",
    week: "2026-12-28",
    month: "2027-01",
  });
});

test("retención configurable al pasar de un domingo a un lunes y de un mes a otro", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date(2027, 0, 31, 12));
  await page.goto("./");
  await navigate(page, "Administración");
  await expect(page.getByText("Diarias (1)", { exact: true })).toBeVisible();
  await page.clock.setFixedTime(new Date(2027, 1, 1, 12));
  await page.reload();
  await navigate(page, "Administración");
  for (const name of ["Diarias", "Semanales", "Mensuales"])
    await expect(page.getByText(name + " (2)", { exact: true })).toBeVisible();
  await page.getByLabel("Diarias", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Aplicar conservación" }).click();
  await expect(page.getByText("Diarias (1)", { exact: true })).toBeVisible();
  await expect(page.getByText("Semanales (2)", { exact: true })).toBeVisible();
});
