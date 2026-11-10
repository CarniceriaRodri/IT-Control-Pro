@echo off
setlocal
title IT Control Pro - Cliente
echo IT Control Pro (cliente Windows)
echo.
echo Escribe el nombre o IP del equipo servidor.
echo Este acceso solo funcionara cuando el servidor este autorizado y preparado para red.
set /p "IT_SERVIDOR=Servidor: "
if "%IT_SERVIDOR%"=="" (echo No se especifico servidor. & pause & exit /b 1)
start "" "http://%IT_SERVIDOR%:8787/"
