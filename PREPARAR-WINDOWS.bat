@echo off
setlocal
title IT Control Pro - Preparacion
pushd "%~dp0" || exit /b 1
where node >nul 2>&1 || (echo Instala Node.js 22 o superior. & pause & exit /b 1)
node --version
call npm ci
if errorlevel 1 (echo No se pudieron instalar dependencias. & pause & exit /b 1)
call npm run build
if errorlevel 1 (echo Fallo la compilacion. & pause & exit /b 1)
echo Preparacion finalizada. Ejecuta INICIAR-SERVIDOR-WINDOWS.bat
pause
