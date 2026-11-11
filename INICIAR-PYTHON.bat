@echo off
setlocal
cd /d "%~dp0"
echo.
echo  IT Control Pro - inicio local sin Node.js ni npm
echo.
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 servidor_python.py
) else (
  where python >nul 2>nul
  if %errorlevel%==0 (
    python servidor_python.py
  ) else (
    echo ERROR: No se encuentra Python ni el lanzador py.
    echo Comprueba en CMD: py --version
    pause
    exit /b 1
  )
)
if errorlevel 1 (
  echo.
  echo El servidor se ha detenido con un error.
  pause
)
endlocal
