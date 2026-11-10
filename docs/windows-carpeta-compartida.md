# IT Control Pro en carpeta compartida de Windows

## Estado

Esta entrega incluye **Incidencias y Tareas como módulos separados**, búsqueda global en todos los módulos y un **servidor local experimental** que almacena los registros y adjuntos en archivos de la carpeta `datos`.

El código React se sigue compilando con `npm run build`. Para acceder al nuevo código hay que compilarlo; los archivos publicados anteriormente en `assets` no incluyen estas funciones hasta entonces.

## Preparación en un equipo de prueba

1. Colocar el proyecto completo en una carpeta local o compartida de Windows.
2. Instalar Node.js 22 o superior en **el ordenador que ejecutará el servidor**, usando los canales autorizados.
3. Ejecutar `PREPARAR-WINDOWS.bat` una vez; necesita disponer de las dependencias de npm.
4. Ejecutar `INICIAR-SERVIDOR-WINDOWS.bat` **solo en un ordenador** y mantener la ventana abierta.
5. Abrir `http://127.0.0.1:8787/` en ese mismo equipo. El acceso se limita deliberadamente a localhost.

Los datos quedan en `datos/sistema.json`, y los archivos en `datos/archivos`. El servidor crea una copia diaria de prueba en `datos/copias`. Para guardar una copia en otra unidad o carpeta compartida autorizada, iniciar el proceso con `IT_BACKUP_DIR` configurada a una ruta independiente. **Las copias en el mismo disco no protegen de averías de hardware.** Comprobar periódicamente restauraciones.

## Carpeta compartida y varios ordenadores

La carpeta puede albergar el código y los datos, pero **no debe ejecutarse una copia del servidor en cada equipo**: solo un proceso debe escribir en los datos centralizados. Los clientes accederán al proceso por navegador. No se debe ejecutar directamente `index.html` por `file://`.

El servidor suministrado para pruebas se enlaza únicamente a `127.0.0.1` y **no dispone todavía de autenticación, autorización ni HTTPS**. Por tanto, NO se debe exponer en la red ni utilizar con datos corporativos. El BAT `ABRIR-CLIENTE-WINDOWS.bat` queda preparado para la futura versión de red, después de implantar seguridad de servidor, autorización corporativa, cifrado y reglas de cortafuegos.

### Migración de datos anteriores

En el navegador de origen, generar antes una copia completa JSON desde Administración. Al abrir la nueva instalación Windows, restaurar la copia con la herramienta de importación; las fotos y adjuntos están incluidos en el JSON de exportación completa. Realizar pruebas de restauración sin borrar el origen. **Abrir una ruta diferente no traslada IndexedDB automáticamente**.

### Límites actuales y siguientes trabajos

- La búsqueda global recorre los registros activos de los módulos configurados; no realiza OCR del contenido de documentos adjuntos.
- No hay todavía bloqueo multiusuario de autenticación ni permisos por usuario; existe revisión optimista de versión para evitar sobrescrituras silenciosas.
- El servidor guarda un JSON central con escritura por reemplazo; para uso corporativo, sustituirlo por una base de datos transaccional, controles de acceso y un sistema de copias de seguridad robusto.
- Las copias automáticas del servidor tienen una primera implementación diaria, sin política completa de conservación semanal y mensual ni verificación automática de restauración.
- El despliegue en red queda condicionado a la validación por Sistemas y Seguridad.


## Paquete portátil para Windows

Desde GitHub, pestaña **Actions** → **Preparar paquete Windows de pruebas** → ejecución completada → **Artifacts** → descargar `IT-Control-Pro-Windows-Pruebas`. Extrae todo el ZIP a una carpeta con permisos de escritura y ejecuta `INICIAR-SERVIDOR-WINDOWS.bat`. No es necesario instalar Node.js por separado porque incluye `runtime/node.exe`.

**Almacenamiento en carpeta compartida:** el paquete incluye `CONFIGURACION-EJEMPLO.cmd`. Cópialo a `configuracion-local.cmd` y sustituye las rutas ficticias por carpetas aprobadas por Sistemas. `IT_DATA_DIR` guarda el archivo de datos y los adjuntos; `IT_BACKUP_DIR` guarda las copias. Sin este archivo, se utilizan rutas locales dentro de la carpeta de la aplicación. No almacenes simultáneamente los datos y sus únicas copias en la misma unidad o carpeta. El usuario Windows que ejecute el proceso debe tener los permisos necesarios.

El paquete portátil sirve exclusivamente para pruebas en localhost. El soporte de red y usuarios requiere una fase posterior de autenticación, gestión de sesiones y acceso cifrado antes de conectar PCs adicionales o dispositivos móviles.

**Importante:** la ejecución del paquete debe estar permitida por las políticas de la organización. No ejecutar `.exe` o scripts no autorizados en equipos corporativos.
