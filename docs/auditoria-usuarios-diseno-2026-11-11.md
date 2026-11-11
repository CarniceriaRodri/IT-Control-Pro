# IT Control Pro · Auditoría integral y mejoras 11/11/2026

## Resumen de lo revisado
Se revisó el árbol del repositorio, el contrato de datos, la importación/exportación, el
servidor Windows, el arranque Android/PWA, los componentes de administración y navegación,
los tests existentes, el flujo GitHub Actions y la documentación de proyecto.

## Implementado en esta entrega
- **Perfiles de trabajo locales** (hasta 20 por navegador): crear, seleccionar, renombrar,
  registrar una función y eliminar sin borrar inventario ni otros registros.
- **Personalización independiente por perfil**: claro/oscuro/sistema, verde/azul/violeta/ámbar,
  densidad cómoda/compacta, tamaño de texto normal/grande y módulo de inicio preferido.
- Selector de operador desde la cabecera en Windows y Android.
- Etiqueta del perfil activo en la descripción de las operaciones de historial futuras.
  Es una **etiqueta declarativa**, no una identidad verificada.
- Persistencia de preferencias en localStorage **del origen/dispositivo**. No se guardan
  contraseñas ni información de autenticación.
- **Servidor Windows experimental más cerrado**: rechaza configuración para escuchar
  fuera de loopback, verifica Host para impedir DNS rebinding y valida los orígenes de
  peticiones con modificaciones, además de Sec-Fetch-Site cuando exista.
- Tests automatizados para crear, seleccionar y conservar perfiles; navegar sin salir y
  asegurar que los datos de los módulos no cambian por cambiar de perfil.

## Riesgos y límites que permanecen

### Seguridad y usuarios
**No hay cuentas con inicio de sesión, contraseñas, MFA, sesiones ni permisos por rol.**
Todos los perfiles de un mismo navegador ven los mismos datos y pueden hacer las mismas
operaciones. El registro de acciones y los perfiles se pueden alterar por una persona
que controle el equipo, por lo que **no son auditoría fiable de una entidad corporativa**.
La seguridad de dispositivos, datos de trabajadores, inventario corporativo y redes
requiere evaluación, permisos e infraestructura autorizados.

### Persistencia Windows/Android
- Android y Windows con navegador local usan IndexedDB; cambiar de navegador/origen
  crea otra base. Los perfiles visuales usan localStorage y **no viajan dentro de la
  copia JSON de registros**.
- El servidor Node en Windows continúa siendo experimental, solo escucha en loopback,
  no ofrece multiusuario ni conexiones TLS. No se puede usar Android para conectarse
  directamente a ese servidor mientras siga esta restricción de seguridad.
- No hay sincronización online/offline ni resolución de conflictos entre dispositivos.

### Almacén y flujos
El módulo Movimientos registra entradas, salidas, préstamos y devoluciones, pero todavía
no aplica reglas contables de stock ni asientos inmutables. El resto de módulos siguen
siendo configurables, con opciones de importación y relaciones por UUID.

### Copias y OCR
Las copias JSON pueden contener datos y fotografías sin cifrado. Deben guardarse en
destinos autorizados. La captura OCR tiene límites según compatibilidad del navegador.
Los modelos de idiomas deben estar incluidos en el paquete para funcionar sin conexión.
No se han probado todos los modelos físicos de móvil.

## Mejoras recomendadas por prioridad

**P0 · Para uso real compartido**
1. Elegir un backend corporativo aprobado y el modelo de identidad
   (SSO/LDAP/OIDC, roles y permisos por módulo, centro, campo y operación).
2. Controlar cada solicitud en el servidor, MFA según políticas, bloqueo de sesiones,
   logs inalterables e identidad verificable por operación.
3. HTTPS y certificado de organización; base SQL transaccional, migraciones,
   integridad referencial, copias cifradas y restauraciones verificadas.
4. Copias externas supervisadas, recuperación ante desastre y permisos de
   almacenamiento de fotos y documentos.

**P1 · Para trabajo diario**
1. Flujo real de entradas/salidas: existencias, reservas, préstamos, devoluciones,
   ubicaciones, números de serie y conciliación.
2. Panel de incidencias con SLA, colas, escalado, responsables y filtros guardados.
3. Calendario de citas y vencimientos, notificaciones con permiso del usuario.
4. Historial por registro y adjuntos de evidencias con integridad y trazabilidad.
5. Importación Excel XLSX y reglas de mapeo reutilizables por módulo.

**P2 · Para más dispositivos**
1. Sincronización basada en identificadores y revisiones (con cola offline y conflictos
   explícitos); no escribir directamente JSON simultáneamente desde varios dispositivos.
2. Android empaquetado opcionalmente con Capacitor y capacidades nativas aprobadas:
   capturas, notificaciones y diagnóstico de red, siempre con permisos.
3. Favoritos, vistas guardadas, tablero configurable, etiquetas y búsqueda indexada.
4. Accesibilidad: navegación teclado, contraste, lectura de pantalla y tamaños de
   controles de toque; pruebas físicas Windows, Chrome Android, Edge y PWA instalada.

## Cómo probar la nueva funcionalidad
1. Haz primero una exportación JSON de los registros desde Administración.
2. Abre Administración → Perfiles de trabajo. Crea un perfil de prueba.
3. Cambia color, densidad y tema; vuelve a cargar la aplicación.
4. Cambia de perfil desde la cabecera: cada uno mantiene sus preferencias visuales.
5. Comprueba que Inventario, Redes, Incidencias y los archivos conservan sus datos.
6. Si pruebas el servidor Windows, ábrelo en http://127.0.0.1:8787; los intentos
   de usar su dirección LAN están bloqueados deliberadamente.

**No utilizar perfiles locales como base de una política de acceso o privacidad.**
