# Auditoría y plan de migración · 10 noviembre 2026

Base auditada: 00a78fc. Cinco archivos. Siete colecciones en it-control-pro-demo-v01, formularios fijos de texto, búsqueda, conteos, edición, borrado físico y copia JSON v1. Sin pruebas, UUID, relaciones ni revisión de escritura. El SW anterior toma el control inmediatamente y limpia cachés de todo el origen.

## Primera entrega
Interfaz React en src/ui, catálogo y contratos en src/domain, adaptador IndexedDB y conversión v1 en src/data. Vite compila recursos relativos para servirlos en la raíz o en una subcarpeta. El navegador trabaja con un repositorio local. Una API futura deberá implementar el contrato de lectura y cambios con control de revisión y autorización por recurso. Los archivos de distribución se sirven como contenido estático.

## Modelo
Definición de módulo con identificador estable, etiqueta, disponibilidad y campos ordenados. Cada campo define clave estable, tipo, etiqueta, opciones, obligatoriedad y visibilidad. Registro con UUID, módulo, valores por clave, revisión y marca de baja. Relaciones nuevas por UUID. Historial con fecha y revisiones. Control optimista y transacciones para que dos pestañas no sobrescriban silenciosamente los cambios. Ocultar un campo conserva los valores. Cambiar el tipo requiere una futura migración explícita. Ninguna edición directa del tipo en esta fase.

## Migración
Validar el contenedor anterior antes de escribir. Conservar textos incluso si no encajan en tipos más estrictos, así como claves adicionales de los registros. No inferir relaciones entre centros homónimos ni convertir cantidades antiguas en movimientos. Migrar y marcar la inicialización en la misma transacción. Conservar localStorage. Cambio de dominio, puerto o navegador: transferir mediante copia JSON. Antes de restaurar, validar y conservar una copia recuperable de la base actual.

## Secuencia y pruebas
1. Fundamentos: migración, configuración dinámica, CRUD, baja lógica, copias, historial, PWA y diseño adaptable. Verificar casos válidos e inválidos, concurrencia, persistencia, recarga offline y compatibilidad con rutas relativas.
2. Ubicaciones jerárquicas, plantillas por tipo de activo, condiciones, archivos y etiquetas QR. Incorporar CSV y Excel con mapeo y previsualización.
3. Movimientos inmutables con transacciones por almacén, préstamos, devoluciones y conciliación del saldo inicial. Agenda con calendario y recordatorios con consentimiento.
4. Backend autenticado, permisos por recurso, migraciones SQL, sincronización con cursores y resolución explícita de conflictos. Empaquetado Capacitor. Monitorización de red únicamente tras autorización.
