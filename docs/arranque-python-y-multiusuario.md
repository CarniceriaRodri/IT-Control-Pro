# Arranque con Python y camino hacia multiusuario

## Arranque de IT Control Pro compilado (Windows)

La aplicación conserva su código React y la distribución generada en `index.html` + `assets/`.
En el ordenador del trabajo no se necesita instalar Node.js, npm ni Vite para **ejecutar** la distribución ya compilada.

1. Descargar/copiar el repositorio completo, incluyendo `index.html`, `assets/`, `sw.js`, manifiesto e iconos. Mantener las rutas.
2. Ejecutar `INICIAR-PYTHON.bat`, o desde CMD: `py -3 servidor_python.py`.
3. Abrir `http://127.0.0.1:8788/` (se intentará abrir el navegador automáticamente).
4. Cerrar con Ctrl+C. Si el puerto está ocupado, desde CMD: `set IT_CONTROL_PORT=8790` seguido de `py -3 servidor_python.py`.

No se instalan paquetes Python. La distribución estática puede quedarse desfasada del código fuente mientras no se compile con herramientas de desarrollo **en otro entorno autorizado**.

## Limitaciones importantes

- **Esto NO habilita multiusuario.** La aplicación actual sigue guardando inventario, incidencias, documentos y copias en IndexedDB en cada perfil de navegador, no en el servidor Python.
- `servidor_python.py` escucha exclusivamente en `127.0.0.1`, y comprueba la cabecera Host. No hay API de escritura ni acceso de otros equipos.
- Cambiar de navegador, puerto, equipo o perfil crea otro origen/contenedor de datos. Exportar el JSON desde Administración antes de hacer cambios.
- Una carpeta compartida SMB 24/7 no ejecuta por sí misma un servidor ni proporciona control transaccional a navegadores.
- **No alojar la base SQLite directamente en SMB para varios procesos concurrentes.**
- No introducir datos de pacientes, credenciales ni información sensible o corporativa sin evaluación y autorización.

## Fase de multiusuario real (no implementada en este arranque)

Requiere equipo anfitrión autorizado, encendido y accesible desde la LAN, además de aprobación de seguridad, autenticación y HTTPS.
El backend debe ser el único escritor de la base SQL almacenada en disco local del anfitrión.
Se necesita adaptar el repositorio React actual a una API compartida (con control de revisiones,
permisos, conflictos, auditoría y migración/importación de datos); **servir solo HTML por HTTP
desde Python no sincroniza los registros**.
Los otros técnicos accederían a una URL corporativa del servicio autorizado, no a la carpeta SMB.
Mientras tanto, la carpeta SMB puede utilizarse para distribuir la versión compilada y para
copias exportadas, siguiendo las reglas corporativas.

## Prueba básica

- Comprobar `py --version`.
- Arrancar y abrir `http://127.0.0.1:8788/`.
- Confirmar que Inventario, Administración y la importación/exportación local funcionan.
- No interpretar dos navegadores abiertos con datos independientes como una prueba de sincronización.
