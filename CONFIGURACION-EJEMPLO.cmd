@echo off
rem Archivo de ejemplo. Para usarlo, copialo como configuracion-local.cmd.
rem Ajustar SOLO a rutas de red aprobadas por Sistemas.
rem Si no se configura, los datos se guardan dentro de la carpeta del programa.
rem No habilitar acceso por red hasta disponer de autorizacion, HTTPS y permisos.
set "IT_DATA_DIR=\\SERVIDOR-AUTORIZADO\IT-Control-Pro\Datos"
set "IT_BACKUP_DIR=\\SERVIDOR-AUTORIZADO\IT-Control-Pro\Copias"
