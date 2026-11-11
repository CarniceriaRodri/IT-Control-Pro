# IT Control Pro · Windows y Android

Aplicación web local de gestión informática, en español. [Abrir la aplicación](https://carniceriarodri.github.io/IT-Control-Pro/).

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
