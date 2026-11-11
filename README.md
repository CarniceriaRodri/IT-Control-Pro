# IT Control Pro · Windows y Android

## Monitorización de Redes desde Windows sin Node.js

La aplicación incorpora un **Centro de monitorización** en Redes para trabajar con
las IP válidas de registros de Inventario, Redes y otros módulos, incluidos los
importados de CSV y LibreOffice Calc. Cada IP se selecciona explícitamente antes
de comprobarla; no se exploran rangos ni se hace descubrimiento de subredes.

El motor se ejecuta en `monitor_python.py` como parte de `servidor_python.py`
cuando se inicia `INICIAR-PYTHON.bat` en Windows. No necesita Node.js,
PowerShell ni librerías Python de terceros. Reproduce el criterio del script
`verificar_ips.ps1` aportado por el usuario: ping ICMP y, si falla, comprobaciones
TCP para distinguir «sin ping / servicio accesible» de «sin respuesta». La ausencia
de respuesta no equivale necesariamente a equipo apagado.

Pasos: abre **Redes → Centro de monitorización → Seleccionar equipos e intervalo**,
revisa las IP encontradas y marca solo aquellas autorizadas; guarda y pulsa
**Iniciar**. Los estados disponibles son ONLINE, TCP accesible, pendiente,
fallo transitorio y SIN RESPUESTA, este último tras el número configurado de
fallos consecutivos. El panel se actualiza cada 10 segundos y ofrece historial
de transiciones y exportación TXT. Los diagnósticos individuales de Redes
también funcionan en el puerto Python 8788 con ping, DNS y TCP.

Límites de la versión local: hasta 250 IP privadas autorizadas por proceso,
6 pruebas concurrentes e intervalos de 30/60/120/300/600 segundos; parámetros
TCP controlados. No sustituye Zabbix, no consulta SNMP, no supervisa equipos
con el servidor detenido y no admite acceso remoto sin infraestructura
corporativa aprobada. Las selecciones e historial reciente se guardan
en `%USERPROFILE%\.it_control_pro\monitor\monitor.json` (fuera de la
carpeta web), pero **la vigilancia no se reinicia automáticamente** al volver a
abrir el servidor: pulsa Iniciar. Los resultados de ping se obtienen desde
la máquina Windows donde se ejecuta Python, no desde el móvil.

Las notificaciones del navegador son opcionales, dependen de permisos y de
que la aplicación esté abierta. Para vigilancia 24/7 y alertas Android con
la aplicación cerrada hará falta un servidor o servicio autorizado.

## Visualización de documentos y aplicaciones externas

En «Archivos y fotos» se incluye vista previa de PDF en el navegador y lectura de texto
para TXT, RTF, ODT, DOCX, archivos de texto y algunos formatos técnicos. El visor
RTF/ODT/DOCX extrae texto y **no conserva la maquetación**; no se ejecutan macros,
scripts ni contenido incrustado.

El botón **Descargar y abrir** guarda el archivo original en el equipo. Después puede
abrirse desde Descargas con la aplicación asociada de Windows, como LibreOffice,
Microsoft Word o un lector PDF, si está instalada y autorizada. Por seguridad el
navegador no puede iniciar arbitrariamente programas de Windows. La descarga puede
estar condicionada por las políticas de Edge/Chrome y la carpeta de descargas.

Los archivos existentes siguen almacenados como adjuntos; no se modifican
ni convierten para la visualización. Esta función necesita recompilar la aplicación
y utilizar un paquete actualizado, no basta con reiniciar Python.

## OCR en Windows sin conexión a Internet

El botón **OCR** de Documentos y fotografías utiliza Tesseract.js 5.1.1.
La distribución requiere `ocr/tesseract.min.js`, `ocr/worker.min.js`,
los archivos WebAssembly de `ocr/core/` y los idiomas `ocr/lang/spa.traineddata.gz`
y `ocr/lang/eng.traineddata.gz`. No basta con el ZIP del código fuente.

En GitHub, abre **Actions → Paquete portable Windows - IT Control Pro**.
Ejecuta **Run workflow** si está permitido, y descarga el artefacto
**IT-Control-Pro-Portable-Windows** de una ejecución completada correctamente.
Descomprime el ZIP completo, sin separar la carpeta `ocr` de `index.html`.
En Windows ejecuta `INICIAR-PYTHON.bat` y entra en `http://127.0.0.1:8788/`.
Selecciona una fotografía con letras claras y pulsa **OCR**.
El texto se muestra en un editor y puedes incorporarlo como archivo TXT al registro.

El workflow genera los recursos en GitHub (con Internet) antes de compilar y
verifica que están empaquetados. Si no consigue descargarlos, la construcción
falla en vez de producir una versión sin OCR. El navegador no necesita recurrir
a servicios externos en tiempo de reconocimiento.

Si el OCR indica que falta un recurso, comprueba la ruta de `ocr/` dentro
del paquete y que no estás ejecutando una versión anterior en caché.
El reconocimiento y el funcionamiento offline completo necesitan validarse en
el navegador Windows del entorno corporativo.

## Inicio con Python en Windows (sin npm)

Para ejecutar **la versión ya compilada** sin instalar Node.js ni descargar Vite,
abre `INICIAR-PYTHON.bat` en Windows (Python 3.14 funciona mediante `py`).
Se abrirá `http://127.0.0.1:8788/`. Mantén juntos `index.html`, `assets/`,
los iconos, el manifiesto y el servidor. Para detenerlo utiliza Ctrl+C.

**Este inicio es únicamente local.** Los registros siguen guardándose en el
navegador (IndexedDB); no permite trabajo simultáneo con datos compartidos.
Una versión multiusuario requiere implementar y autorizar un servicio central
autenticado. Consulta [instrucciones y limitaciones](docs/arranque-python-y-multiusuario.md).

Aplicación web local de gestión informática, en español. [Abrir la aplicación](https://carniceriarodri.github.io/IT-Control-Pro/).

## Alarmas en Agenda y seguimiento de tareas

El centro de alarmas está disponible en todas las pantallas y comprueba los avisos
cada 15 segundos mientras la aplicación esté abierta. Se aplica a citas de Agenda
(con fecha y hora), Tareas (fecha prevista) y préstamos pendientes de Movimientos
(devolución prevista). Si una tarea o devolución no tiene hora utiliza las 09:00.
La antelación predeterminada es 15 minutos, configurable a 0, 5, 10, 15, 30 o 60;
también se puede personalizar para los próximos avisos, posponer 5/15 minutos,
descartar avisos individuales y activar opcionalmente una señal sonora.
Las notificaciones de Windows requieren un navegador compatible, contexto seguro
(localhost o HTTPS), permiso explícito e interacción del usuario en algunos casos.
La señal sonora también puede quedar bloqueada hasta que el usuario interactúe.

**Limitaciones:** no funciona con el navegador cerrado, el equipo suspendido o sin la
aplicación cargada. Los navegadores pueden ralentizar la comprobación en segundo
plano. Las preferencias y avisos descartados se guardan solo en el perfil local
del navegador; no constituyen alertas compartidas entre técnicos. Los avisos visuales
siguen disponibles cuando no se conceden notificaciones del sistema.

## Perfiles y personalización (11/11/2026)

En **Administración → Perfiles de trabajo** puedes crear hasta 20 perfiles locales
y cambiar de perfil desde el selector situado en la cabecera. Cada perfil puede
tener nombre, función, módulo de inicio, módulos favoritos, tema claro/oscuro/automático,
color de acento (verde, azul, violeta, ámbar), densidad y tamaño de texto.
Los favoritos aparecen primero en el menú y las tarjetas del Panel principal.

**Estos perfiles no son usuarios autenticados y NO establecen permisos de acceso**:
todos los operadores del mismo navegador comparten registros, archivos y funciones.
Las etiquetas con el nombre del operador en el historial son informativas y se
pueden falsificar. Las preferencias se guardan en el dispositivo, no se incluyen
en el backup de datos y no se sincronizan entre Android y Windows.

El servidor Windows de pruebas está restringido a loopback, valida Host y origen,
y deliberadamente no ofrece acceso compartido por LAN. Para una aplicación
corporativa multiusuario hay que incorporar primero un backend autenticado,
controles de permisos, TLS y auditoría de servidor.

[Informe de auditoría y mejoras propuestas](docs/auditoria-usuarios-diseno-2026-11-11.md).

## Uso

En Administración puedes crear un módulo, elegir sus campos y activar o desactivar su acceso. Incidencias incluye el campo «Equipo relacionado». Para añadir un campo exclusivo de impresoras, selecciona Inventario, añade el campo y elige «Mostrar según otro campo» → Tipo, con valor «Impresora». Puedes agrupar los campos en secciones. Los registros existentes conservan los campos ocultos. En cada tabla puedes buscar, ordenar, editar, archivar y reactivar.

| Módulo | Alcance de esta entrega |
|---|---|
| Panel | Contadores y accesos a módulos activos |
| Centros | Directorio configurable; admite relaciones añadidas por el usuario |
| Inventario | Equipos, serie, ubicación histórica, búsqueda y baja lógica |
| Almacén | Catálogo y cantidades de la versión anterior; conciliación por movimientos pendiente |
| Incidencias | Referencia oficial, asunto, centro, prioridad, estado y relaciones configurables |
| Redes | Registro manual de dispositivos y direcciones; sin exploración de red |
| Agenda | Registro de tareas, fechas y estado |
| Documentación | Referencias documentales |
| Informes | Totales por módulo activo |
| Administración | Módulos, campos, orden, relaciones, copias y auditoría |
| Entradas y salidas; préstamos y devoluciones | Fase posterior con reglas de existencias |

En modo web/PWA, la aplicación usa el almacenamiento del perfil de navegador; en modo de pruebas Windows también existe un servicio Node local sin autenticación. Exporta una copia JSON antes de cambiar de equipo, navegador, dominio o puerto. Importar muestra una vista previa y conserva un punto de recuperación. La auditoría local es editable por quien controle el dispositivo. La edición actual carga las colecciones en memoria. La paginación por índices y los permisos de servidor quedan para una fase posterior.

## Tablas, fotografías y copias

En Administración puedes crear un módulo a partir de una hoja ODS o un CSV UTF-8. Selecciona la hoja y las columnas que quieres convertir en campos de texto. En un módulo existente, «Importar tabla» permite asignar columnas a campos. La primera fila es el encabezado. Se muestran cinco filas de ejemplo, errores y duplicados antes de confirmar. Se añaden filas nuevas en una transacción y se omiten coincidencias en todas las columnas asignadas. Los campos de relación aceptan UUID. Los límites por importación son 10 MB, 10.000 registros por hoja y 128 columnas. «Exportar CSV» descarga los campos visibles de los registros activos para Calc.

Adjunta documentos o fotos durante la creación del módulo, después en «Archivos y fotos», o al editar un registro. «Tomar foto» solicita la cámara trasera en dispositivos compatibles. El límite individual es 10 MB. IndexedDB mantiene los archivos separados de los registros, con una sola copia por contenido idéntico.

En Administración, las copias automáticas conservan por defecto 7 periodos diarios, 4 semanales y 3 mensuales. La semana empieza en lunes. Cada cambio guardado actualiza el último estado de su periodo en la misma transacción. La aplicación revisa también el cambio de periodo al abrirse y mientras está visible. Los periodos comparten instantánea si corresponden al mismo estado y las fotografías no se duplican en cada copia. Puedes ajustar la conservación (0–90 por frecuencia), revisar una instantánea, descargarla o restaurarla con confirmación. Los puntos locales dependen del almacenamiento del navegador. Para disponer de una copia externa, descarga el JSON y guárdalo en la ubicación autorizada. Esta versión no escribe automáticamente en una carpeta de red.

Las copias JSON v3 incluyen definiciones, registros, historial y archivos con verificación SHA-256. Siguen admitiéndose las copias v1 y v2. Los documentos se conservan como adjuntos descargables y las tablas se importan como datos. Las preferencias de conservación corresponden a cada dispositivo.

## Desarrollo y alojamiento

Con Node 22.12+ y npm: `npm ci`, `npm run dev`. La página de desarrollo es /app.html. `npm run build` verifica TypeScript y actualiza index.html, assets/ y sw.js para el alojamiento estático. Sube index.html, assets/, manifest.webmanifest, icon.svg, icon-192.png, icon-512.png y sw.js juntos en la misma carpeta. Usa HTTPS o localhost. El servidor no almacena los registros.

Para uso local en Windows con Python instalado, ejecuta `py -m http.server 8080 --bind 127.0.0.1` en la carpeta y abre http://localhost:8080. La instalación se ofrece según el navegador. Instalar en varios dispositivos crea espacios de datos independientes. La caché offline se prepara tras la primera carga con conexión.

Pruebas de navegador con Python 3 y Chromium: `npx playwright install chromium` y `npm test`. Para usar un ejecutable ya instalado configura CHROMIUM_PATH. Compila antes de probar los cambios. Las pruebas usan datos ficticios y una subcarpeta.

[Auditoría y fases de migración](docs/arquitectura.md).
