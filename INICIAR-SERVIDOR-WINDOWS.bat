@echo off
setlocal
title IT Control Pro - Servidor Windows (pruebas)
pushd "%~dp0" || (echo ERROR: No se puede acceder a la carpeta. & pause & exit /b 1)
if exist "runtime\node.exe" (
 set "NODE=runtime\node.exe"
) else (
 where node >nul 2>&1 || (echo ERROR: Falta Node.js 22+ o el paquete Windows portatil. & pause & exit /b 1)
 set "NODE=node"
 if exist "node_modules" (
  echo Compilando la version de desarrollo...
  call npm run build
  if errorlevel 1 (echo ERROR: Fallo la compilacion. & pause & exit /b 1)
 )
)
if not exist "index.html" (
 echo ERROR: Falta index.html. Descarga el paquete Windows completo.
 pause
 exit /b 1
)
if exist "configuracion-local.cmd" call "configuracion-local.cmd"
echo.
echo IT CONTROL PRO - SERVIDOR LOCAL DE PRUEBAS
if defined IT_DATA_DIR (echo Carpeta de datos: %IT_DATA_DIR%) else (echo Carpeta de datos: %CD%\datos)
if defined IT_BACKUP_DIR echo Carpeta de copias: %IT_BACKUP_DIR%
echo Solo accesible desde este equipo. Sin acceso remoto por ahora.
echo Sin autorizacion de Sistemas, no utilizar datos corporativos.
echo.
set "IT_HOST=127.0.0.1"
set "IT_PORT=8787"
start "" "http://127.0.0.1:8787/"
"%NODE%" server\windows.mjs
if errorlevel 1 (
 echo.
 echo El servidor se ha detenido o hay otra instancia abierta.
)
pause
