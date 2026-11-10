# IT Control Pro · 0.3

Aplicación web local de gestión informática, en español. [Abrir la aplicación](https://carniceriarodri.github.io/IT-Control-Pro/).

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

La aplicación solo usa el almacenamiento del perfil de navegador. Exporta una copia JSON antes de cambiar de equipo, navegador, dominio o puerto. Importar muestra una vista previa y conserva un punto de recuperación. La auditoría local es editable por quien controle el dispositivo. La edición actual carga las colecciones en memoria. La paginación por índices y los permisos de servidor quedan para una fase posterior.

## Desarrollo y alojamiento

Con Node 22.12+ y npm: `npm ci`, `npm run dev`. La página de desarrollo es /app.html. `npm run build` verifica TypeScript y actualiza index.html, assets/ y sw.js para el alojamiento estático. Sube index.html, assets/, manifest.webmanifest, icon.svg, icon-192.png, icon-512.png y sw.js juntos en la misma carpeta. Usa HTTPS o localhost. El servidor no almacena los registros.

Para uso local en Windows con Python instalado, ejecuta `py -m http.server 8080 --bind 127.0.0.1` en la carpeta y abre http://localhost:8080. La instalación se ofrece según el navegador. Instalar en varios dispositivos crea espacios de datos independientes. La caché offline se prepara tras la primera carga con conexión.

Pruebas de navegador con Python 3 y Chromium: `npx playwright install chromium` y `npm test`. Para usar un ejecutable ya instalado configura CHROMIUM_PATH. Compila antes de probar los cambios. Las pruebas usan datos ficticios y una subcarpeta.

[Auditoría y fases de migración](docs/arquitectura.md).
