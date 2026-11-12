import { test,expect } from "@playwright/test";
import { zipSync,strToU8 } from "fflate";
const nav=async(page:import("@playwright/test").Page,name:string)=>page.getByRole("navigation").getByRole("button",{name,exact:true}).click();
async function importCsv(page:import("@playwright/test").Page,name:string,contents:string){
 await nav(page,"Administración");await page.getByText("Crear módulo desde una tabla",{exact:true}).click();
 const dialog=page.getByRole("dialog");await dialog.locator('input[type="file"][accept*="csv"]').setInputFiles({name,mimeType:"text/csv",buffer:Buffer.from(contents)});
 await dialog.getByRole("button",{name:"Importar y adaptar el módulo",exact:true}).click();
}
test("grupos de archivos conservan centro, ubicación y filtros; anchos persisten",async({page})=>{
 await page.goto("./");await importCsv(page,"Quioscos.csv","Nombre;IP;Centro;Ubicación fina;Planta\nK1;10.2.3.4;Hospital Jerez;Admisión;2\nK2;10.2.3.5;Hospital Jerez;Entrada;0");
 await nav(page,"Quioscos");const separator=page.getByRole("separator",{name:"Ancho de Nombre",exact:true});await separator.focus();await separator.press("ArrowRight");
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem("it-table-layout-"+location.hash.split("/")[1])||"{}"));
 await expect(page.getByRole("cell",{name:"Admisión",exact:true})).toBeVisible();await page.reload();
 await expect(page.getByRole("separator",{name:"Ancho de Nombre",exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Ampliar tabla",exact:true}).click();await expect(page.locator(".tableFullscreen")).toBeVisible();await page.keyboard.press("Escape");await expect(page.locator(".tableFullscreen")).toHaveCount(0);
 await nav(page,"Redes");await page.getByRole("button",{name:"Ver Quioscos",exact:true}).click();
 await expect(page.getByRole("cell",{name:"Admisión · 2",exact:true})).toBeVisible();await expect(page.getByRole("cell",{name:"Hospital Jerez",exact:true})).toHaveCount(2);
 await page.getByRole("combobox").filter({has:page.locator('option[value="excluded"]')}).selectOption("excluded");
 await page.getByLabel("Buscar equipos de red").fill("Admisión");await expect(page.getByRole("cell",{name:"10.2.3.4",exact:true})).toBeVisible();await expect(page.getByRole("cell",{name:"10.2.3.5",exact:true})).toHaveCount(0);
 await page.getByRole("button",{name:"Ver ficha",exact:true}).click();await expect(page.getByRole("dialog")).toContainText("Ubicación fina");
});
test("actualizar una importación muestra diferencias y permite deshacer sin perder originales",async({page})=>{
 await page.goto("./");await importCsv(page,"Impresoras.csv","Serie;IP;Centro;Ubicación\nS1;10.1.2.3;Jerez;Despacho A");await nav(page,"Impresoras");
 await page.getByRole("button",{name:"Importar tabla",exact:true}).click();let dialog=page.getByRole("dialog");await dialog.locator('input[type="file"][accept*="csv"]').setInputFiles({name:"Impresoras-actualizadas.csv",mimeType:"text/csv",buffer:Buffer.from("Serie;IP;Centro;Ubicación\nS1;10.1.2.3;Jerez;Despacho B")});
 await dialog.getByLabel("Columna para identificar registros existentes").selectOption("1");await dialog.getByLabel("Actualizar valores distintos",{exact:false}).check();await dialog.getByText("Revisar cambios en 1 registros existentes").click();await expect(dialog).toContainText("Despacho A → Despacho B");await dialog.getByRole("button",{name:"Importar y adaptar el módulo",exact:true}).click();await expect(page.getByRole("cell",{name:"Despacho B",exact:true})).toBeVisible();
 await page.getByText("Historial de importaciones (2)",{exact:true}).click();page.once("dialog",d=>d.accept());await page.getByRole("button",{name:"Deshacer importación",exact:true}).first().click();await expect(page.getByRole("cell",{name:"Despacho A",exact:true})).toBeVisible();await page.reload();await expect(page.getByText("Historial de importaciones (2)",{exact:true})).toBeVisible();
});
test("importa XLSX de varias hojas sin ejecutar fórmulas",async({page})=>{
 const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
 const buffer=zipSync({"xl/workbook.xml":strToU8(`<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Terminales" sheetId="1" r:id="rId1"/></sheets></workbook>`),"xl/_rels/workbook.xml.rels":strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'),"xl/worksheets/sheet1.xml":strToU8(`<worksheet xmlns="${ns}"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Equipo</t></is></c><c r="B1" t="inlineStr"><is><t>Ubicación</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Terminal 1</t></is></c><c r="B2" t="inlineStr"><is><t>Consulta 4</t></is></c></row></sheetData></worksheet>`)});
 await page.goto("./");await nav(page,"Administración");await page.getByText("Crear módulo desde una tabla",{exact:true}).click();const dialog=page.getByRole("dialog");await dialog.locator('input[type="file"][accept*="xlsx"]').setInputFiles({name:"Terminales.xlsx",mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",buffer:Buffer.from(buffer)});await dialog.getByRole("button",{name:"Importar y adaptar el módulo",exact:true}).click();await nav(page,"Terminales");await expect(page.getByRole("cell",{name:"Consulta 4",exact:true})).toBeVisible();
});
