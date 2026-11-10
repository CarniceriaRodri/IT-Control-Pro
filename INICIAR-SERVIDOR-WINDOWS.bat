@echo off
setlocal
title IT Control Pro - Servidor Windows
pushd "%~dp0" || (echo No se puede acceder a la carpeta del proyecto. & pause & exit /b 1)
where node >nul 2>&1 || (echo ERROR: Se necesita Node.js 22 o superior. & pause & exit /b 1)
where npm >nul 2>&1 || (echo ERROR: npm no disponible. & pause & exit /b 1)
if not exist "node_modules" (
 echo No se han instalado las dependencias. Ejecuta PREPARAR-WINDOWS.bat en un entorno autorizado.
 pause
 exit /b 1
)
echo Preparando la version de Windows...
call npm run build
if errorlevel 1 (echo ERROR: No se pudo compilar. & pause & exit /b 1)
echo.
echo Datos centrales en: %CD%\datos
echo.
echo El acceso en red requiere autorizacion, autenticacion y HTTPS adicionales.
echo Por seguridad, el servidor se inicia solo en el equipo local.
set "IT_HOST=127.0.0.1"
set "IT_PORT=8787"
start "" "http://127.0.0.1:8787/"
node server\windows.mjs
pause
