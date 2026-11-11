import { expect, test } from "@playwright/test";

test("crear perfiles locales y personalizar diseño sin alterar datos de los módulos", async ({page}) => {
  await page.goto("./");
  await page.getByRole("navigation").getByRole("button",{name:"Administración"}).click();
  await expect(page.getByRole("heading",{name:"Perfiles de trabajo"})).toBeVisible();
  await page.getByLabel("Nuevo perfil").fill("Técnico de pruebas");
  await page.getByRole("button",{name:"Crear perfil"}).click();
  await expect(page.getByLabel("Perfil activo")).toHaveValue(/.+/);
  await expect(page.getByLabel("Cambiar perfil de trabajo")).toHaveValue(/.+/);
  await page.getByLabel("Color de acento").selectOption("blue");
  await page.getByLabel("Tema visual").selectOption("dark");
  await page.getByLabel("Densidad de interfaz").selectOption("compact");
  await expect(page.locator("html")).toHaveAttribute("data-accent","blue");
  await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
  await page.reload();
  await page.getByRole("navigation").getByRole("button",{name:"Administración"}).click();
  await expect(page.getByLabel("Perfil activo")).toHaveValue(/.+/);
  await expect(page.getByLabel("Color de acento")).toHaveValue("blue");
  await expect(page.getByLabel("Tema visual")).toHaveValue("dark");
  await page.getByLabel("Perfil activo").selectOption("local-default");
  await expect(page.locator("html")).toHaveAttribute("data-accent","green");
  await page.getByLabel("Perfil activo").selectOption({label:"Técnico de pruebas"});
  await expect(page.locator("html")).toHaveAttribute("data-accent","blue");
});

test("perfiles tienen indicación explícita de no ser cuentas autenticadas",async({page})=>{
  await page.goto("./");
  await page.getByRole("navigation").getByRole("button",{name:"Administración"}).click();
  await expect(page.getByText(/no cuentas seguras/i)).toBeVisible();
});

test("el cambio de operador no elimina los módulos ni inventarios",async({page})=>{
  await page.goto("./");
  await page.getByRole("navigation").getByRole("button",{name:"Administración"}).click();
  await page.getByLabel("Nuevo perfil").fill("Turno mañana");
  await page.getByRole("button",{name:"Crear perfil"}).click();
  await page.getByRole("navigation").getByRole("button",{name:"Inventario",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Inventario",exact:true})).toBeVisible();
  await page.getByLabel("Cambiar perfil de trabajo").selectOption("local-default");
  await expect(page.getByRole("heading",{name:"Inventario",exact:true})).toBeVisible();
});

test("los favoritos del perfil se destacan primero en el panel y se guardan",async({page})=>{
  await page.goto("./");
  await page.getByRole("navigation").getByRole("button",{name:"Administración"}).click();
  await page.getByLabel("Favorito Redes").check();
  await page.getByRole("navigation").getByRole("button",{name:"Panel principal"}).click();
  await expect(page.locator(".cards button").first()).toContainText("Redes");
  await page.reload();
  await expect(page.locator(".cards button").first()).toContainText("Redes");
  await page.getByRole("navigation").getByRole("button",{name:"Administración"}).click();
  await expect(page.getByLabel("Favorito Redes")).toBeChecked();
});
