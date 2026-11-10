# IT Control Pro · Plataforma multimodular

## Estado de la implementación

Este documento separa lo **implementado** de lo **pendiente**, para que la documentación no confunda prototipos con funciones reales.

### Funciones presentes en el código

- Módulos dinámicos: crearlos, activarlos, definir campos, tipos, orden, visibilidad y secciones.
- Campos condicionales, etiquetas, estados, listas, fechas y campos de relación 1:N y N:M mediante selección única o múltiple.
- Selector con búsqueda instantánea y alta relacionada encadenada dentro del flujo del registro principal.
- Las altas relacionadas se almacenan en el mismo commit que el registro principal; cancelar el principal descarta los borradores preparados.
- Gestión específica de relación: completa, seleccionar sin crear, solo consulta, desactivada. Desactivar no borra los identificadores vinculados.
- Clave de negocio principal (una por módulo) y claves alternativas configurables por campo, adicionales al UUID interno.
- Importación de .csv y .ods con campos nuevos automáticos, cabeceras y texto preservados, vista previa y opción de omitir columnas.
- Detección de coincidencia por clave principal al importar a módulos existentes. Puede completar **solo campos vacíos** si el usuario lo habilita; no reescribe los valores ya guardados. Los casos ambiguos dan error y requieren revisión.
- Opción de omitir duplicados exactos; por defecto se preservan filas iguales. La importación ofrece punto de recuperación.
- Ocultar campos con valores y quitar campos vacíos; los datos previos no se borran por accidente.
- Adjuntos y fotografías a través de la interfaz; algunas funciones OCR dependen del entorno disponible.
- Registros en IndexedDB del navegador en modo local; alternativa mediante el servicio Node/Windows experimental cuando se ejecuta en el puerto configurado.
- Copias locales rotativas y exportación/importación JSON; Agenda, Tareas, Contactos, Inventario, Incidencias, Centros y otros módulos.
- Sección Ayuda con glosario, guía, búsqueda y ejemplos, accesible desde el menú.
- Módulo **Movimientos**: entradas, salidas, préstamos, devoluciones y traslados con relaciones a Inventario, Centros, Contactos e Incidencias, referencia, cantidad, fecha prevista y estado. Por ahora es registro de movimientos: no concilia automáticamente existencias.
- **Vencimientos visibles**: el Panel muestra tareas y préstamos pendientes por fecha. No genera recordatorios del sistema operativo.
- **Monitor Windows opt-in**: desde el servicio local, hasta diez IP privadas autorizadas con ping periódico cada 120 segundos y registro de cambios de estado en memoria. Se inicia/detiene desde Redes y no hace barridos.

### Pendiente de desarrollar y probar antes de uso corporativo

1. **Repositorio multiusuario seguro**: autenticación, autorización, TLS, concurrencia controlada, auditoría no editable, migraciones y copia en servidor autorizados. GitHub Pages no es un backend.
2. **Monitorización avanzada**: el ping periódico local está implementado para pruebas; quedan TCP/DNS/HTTP periódicos, SNMP autorizado, planificación horaria, persistencia, mantenimiento, umbrales consecutivos, ventanas de gracia, flapping y alertas.
3. **Notificaciones**: alarmas nativas Windows, alertas Android, suscripción por usuario y control de permisos.
4. **Importadores más extensos**: .xlsx y documentos, detección avanzada de columnas, claves compuestas, consulta y unión de datos entre orígenes, extracción y unión sin pérdida de procedencia, y tratamientos de conflicto editables.
5. **Datos maestros y módulo de relaciones universal**: gestionar en cualquier dirección vínculos entre módulos, permisos por relación, relaciones temporales e historial de cambios.
6. **Movimientos y préstamos avanzados**: el módulo y seguimiento de devolución ya existen; faltan conciliación automática de stock, reglas de existencias, informes y flujos de autorización.
7. **Almacenamiento externo modular**: políticas por módulo, servicio de archivos LAN/NAS con permisos, sincronización y coherencia; backups cifrados fuera del equipo y restauración verificada.
8. **OCR ampliado**: selección de imágenes o documentos, extracción de campos, revisión manual y guardado relacionado.
9. **Pruebas funcionales** completas de Windows, Android y migración con datos ficticios, antes de importar datos reales.

## Principios

- Una **identidad interna estable** por registro; los identificadores de negocio (hostname, serie, etiqueta) sirven para correspondencias.
- La IP no se considera identidad permanente.
- Ningún borrado de campo o desvinculación debe eliminar silenciosamente datos de origen.
- Un campo de relación desactivado deja de aparecer, pero la información enlazada se conserva.
- Toda importación muestra una vista previa, un plan de correspondencias y una forma de recuperar la situación anterior.
- Cualquier acción que afecte a un origen y un destino requiere consistencia transaccional; las operaciones entre servidores necesitarán una solución específica.
- El código público de GitHub nunca debe contener IPs internas, datos personales, credenciales, fotografías corporativas ni ficheros de trabajo sensibles.
- No existe un módulo Fabricantes obligatorio. **Marca** puede permanecer como campo simple.
