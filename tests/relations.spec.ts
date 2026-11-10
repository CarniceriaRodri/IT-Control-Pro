import { test, expect } from "@playwright/test";
import { field, initialModules, validate, uid } from "../src/domain/model";

test("relaciones individuales, múltiples y libres con referencias existentes", () => {
  const modules = initialModules();
  const a = { id: uid(), module: "Inventario", values: { equipo: "CAN2014E" }, rev: 1, archived: false };
  const b = { id: uid(), module: "Incidencias", values: { número: "INC123" }, rev: 1, archived: false };
  const m = modules.find((x) => x.id === "Tareas")!;
  m.fields = [
    { ...field("destino", "Destino", "relación"), target: "*" },
    { ...field("vinculos", "Vínculos", "relación múltiple"), target: "*" },
  ];
  expect(() => validate(m, { destino: a.id, vinculos: [a.id, b.id] }, [a, b], "nueva")).not.toThrow();
  expect(() => validate(m, { destino: a.id, vinculos: ["inexistente"] }, [a, b], "nueva")).toThrow("Referencia desconocida");
  expect(() => validate(m, { destino: "", vinculos: [a.id] }, [a, { ...b, archived: true }], "nueva")).not.toThrow();
  expect(() => validate(m, { destino: b.id, vinculos: [] }, [a, { ...b, archived: true }], "nueva")).toThrow("archivada");
});

test("crear relación configurada con buscador y nuevo registro relacionado", async ({page}) => {
  await page.goto("./");
  await page.getByRole("navigation").getByRole("button", {name: "Inventario", exact: true}).click();
  await page.getByText("Nuevo registro", {exact: true}).click();
  await page.getByLabel("Equipo", {exact: false}).fill("Impresora CAN2014E");
  await page.getByText("Guardar registro", {exact: true}).click();
  await page.getByRole("navigation").getByRole("button", {name: "Incidencias", exact: true}).click();
  await page.getByText("Nuevo registro", {exact: true}).click();
  await page.getByLabel("Número", {exact: true}).fill("INC-123");
  await page.getByLabel("Buscar Equipo relacionado").fill("CAN2014E");
  await expect(page.getByRole("option", {name: /CAN2014E/})).toBeVisible();
  await page.getByRole("option", {name: /CAN2014E/}).click();
  await page.getByText("Guardar registro", {exact: true}).click();
  await expect(page.getByRole("cell", {name: "Impresora CAN2014E"})).toBeVisible();
});
