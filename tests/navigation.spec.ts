import { test, expect } from "@playwright/test";

test("Atrás y Adelante conservan navegación de módulos dentro de IT Control Pro", async ({ page }) => {
  await page.goto("./");
  const nav = page.getByRole("navigation");
  await nav.getByRole("button",{name:"Inventario",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Inventario",exact:true})).toBeVisible();
  expect(page.url()).toContain("modulo=Inventario");
  await nav.getByRole("button",{name:"Redes",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Redes",exact:true})).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading",{name:"Inventario",exact:true})).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("heading",{name:"Redes",exact:true})).toBeVisible();
  await page.goBack();
  await page.goBack();
  await expect(page.getByRole("heading",{name:"Panel principal"})).toBeVisible();
});

test("Atrás cierra edición y al llegar al inicio permanece en el Panel", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("navigation").getByRole("button",{name:"Inventario",exact:true}).click();
  await page.getByRole("button",{name:"Nuevo registro",exact:true}).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(page.url()).toContain("registro=new");
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading",{name:"Inventario",exact:true})).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading",{name:"Panel principal"})).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading",{name:"Panel principal"})).toBeVisible();
  expect(new URL(page.url()).pathname).toContain("/IT-Control-Pro/");
});

test("Abrir directamente Redes en la URL permite volver al Panel", async ({ page }) => {
  await page.goto("./#modulo=Redes");
  await expect(page.getByRole("heading",{name:"Redes",exact:true})).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading",{name:"Panel principal"})).toBeVisible();
});
