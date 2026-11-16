import {test,expect} from "@playwright/test";
const base="http://127.0.0.1:8788/";
test.beforeEach(async({request})=>{
 await request.post(base+"api/monitor/stop",{data:{}});
 await request.post(base+"api/monitor/configure",{data:{targets:[]}});
});
async function addIP(page:import("@playwright/test").Page,ip:string){
 await page.goto(base+"#modulo=Redes");
 await page.getByRole("button",{name:"Nuevo registro",exact:true}).click();
 const dialog=page.getByRole("dialog");
 await dialog.getByLabel("Dispositivo *",{exact:true}).fill("Impresora de pruebas");
 await dialog.getByLabel("Ip",{exact:true}).fill(ip);
 await dialog.getByLabel("Ubicación exacta",{exact:true}).fill("H3D · planta 2 · despacho 214");
 await dialog.getByRole("button",{name:"Guardar registro",exact:true}).click();
 await expect(dialog).toHaveCount(0);
}
test("una IP recién creada se comprueba sin configurar el monitor y puede repetirse",async({page})=>{
 await addIP(page,"10.2.4.11");
 const monitor=page.getByRole("region",{name:"Centro de monitorización",exact:true});
 await expect(monitor.getByLabel("Monitorizar 10.2.4.11",{exact:true})).not.toBeChecked();
 await monitor.getByRole("button",{name:"Comprobar IP",exact:true}).click();
 await expect(monitor.getByRole("cell",{name:"Sondeo de prueba 1: TCP accesible",exact:true})).toBeVisible();
 await monitor.getByRole("button",{name:"Comprobar IP",exact:true}).click();
 await expect(monitor.getByRole("cell",{name:"Sondeo de prueba 2: TCP accesible",exact:true})).toBeVisible();
 const status=await (await page.request.get(base+"api/monitor/status")).json();
 expect(status.hosts).toHaveLength(0);expect(status.running).toBe(false);
});
test("iniciar monitorización guarda las IP seleccionadas automáticamente",async({page})=>{
 await addIP(page,"10.2.4.12");
 const monitor=page.getByRole("region",{name:"Centro de monitorización",exact:true});
 await monitor.getByLabel("Monitorizar 10.2.4.12",{exact:true}).check();
 await monitor.getByRole("button",{name:"Iniciar monitorización",exact:true}).click();
 await expect.poll(async()=>{const result=await (await page.request.get(base+"api/monitor/status")).json();return result.hosts.find((h:{ip:string})=>h.ip==="10.2.4.12")?.status;}).toBe("tcp");
 await monitor.getByRole("button",{name:"Detener monitorización",exact:true}).click();
});
test("una IP no admitida muestra el error y no lo borra el refresco del monitor",async({page})=>{
 await addIP(page,"8.8.8.8");
 const monitor=page.getByRole("region",{name:"Centro de monitorización",exact:true});
 await monitor.getByRole("button",{name:"Comprobar IP",exact:true}).click();
 await expect(monitor.getByRole("cell",{name:/IP.*privada autorizada/})).toBeVisible();
 await page.waitForTimeout(3200); // Superar un refresco automático para comprobar la regresión.
 await expect(monitor.getByRole("cell",{name:/IP.*privada autorizada/})).toBeVisible();
});
test("un grupo importado se comprueba completo sin activar la vigilancia continua",async({page})=>{
 await page.goto(base);
 await page.getByRole("navigation").getByRole("button",{name:"Administración",exact:true}).click();
 await page.getByRole("button",{name:"Crear módulo desde una tabla",exact:true}).click();
 const dialog=page.getByRole("dialog");
 await dialog.locator('input[type="file"][accept*="csv"]').setInputFiles({name:"Terminales-IP.csv",mimeType:"text/csv",buffer:Buffer.from("Equipo;IP equipo;Centro;Ubicación\nT1;10.2.4.21;Jerez;Consulta 1\nT2;10.2.4.22;Jerez;Consulta 2")});
 await dialog.getByRole("button",{name:"Importar y adaptar el módulo",exact:true}).click();
 await page.getByRole("navigation").getByRole("button",{name:"Redes",exact:true}).click();
 const monitor=page.getByRole("region",{name:"Centro de monitorización",exact:true});
 await monitor.getByRole("button",{name:"Ver Terminales-IP",exact:true}).click();
 await monitor.getByRole("button",{name:"Comprobar grupo ahora",exact:true}).click();
 await expect(monitor.getByRole("cell",{name:"Sondeo de prueba 1: TCP accesible",exact:true})).toHaveCount(2);
 const result=await (await page.request.get(base+"api/monitor/status")).json();expect(result.hosts).toHaveLength(0);
});

test("guardar ubicación exacta desde la ficha de un módulo importado sin esa columna",async({page})=>{
 await page.goto(base);
 await page.getByRole("navigation").getByRole("button",{name:"Administración",exact:true}).click();
 await page.getByRole("button",{name:"Crear módulo desde una tabla",exact:true}).click();
 let dialog=page.getByRole("dialog");
 await dialog.locator('input[type="file"][accept*="csv"]').setInputFiles({name:"Impresoras-localizacion.csv",mimeType:"text/csv",buffer:Buffer.from("Equipo;IP;Centro\nLOC1;10.2.4.31;Hospital Jerez")});
 await dialog.getByRole("button",{name:"Importar y adaptar el módulo",exact:true}).click();
 await page.getByRole("navigation").getByRole("button",{name:"Redes",exact:true}).click();
 const monitor=page.getByRole("region",{name:"Centro de monitorización",exact:true});
 await monitor.getByRole("button",{name:"Ver ficha",exact:true}).click();
 dialog=page.getByRole("dialog");
 await expect(dialog.getByLabel("Ubicación exacta",{exact:true})).toHaveValue("");
 await dialog.getByLabel("Ubicación exacta",{exact:true}).fill("H3D · planta 2 · RR. HH. · despacho 214");
 await dialog.getByRole("button",{name:"Guardar ubicación exacta",exact:true}).click();
 await expect(dialog.getByRole("status")).toContainText("Ubicación exacta guardada");
 await dialog.getByRole("button",{name:"Cerrar",exact:true}).click();
 await expect(monitor.getByRole("cell",{name:"H3D · planta 2 · RR. HH. · despacho 214",exact:true})).toBeVisible();
 await expect(monitor.getByRole("cell",{name:"Hospital Jerez",exact:true})).toBeVisible();
 await page.reload();
 await expect(page.getByRole("region",{name:"Centro de monitorización",exact:true}).getByRole("cell",{name:"H3D · planta 2 · RR. HH. · despacho 214",exact:true})).toBeVisible();
});
