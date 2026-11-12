@echo off
setlocal
cd /d "%~dp0"
where pythonw.exe >nul 2>&1
if errorlevel 1 (
 echo No se encuentra Python para ejecutar en segundo plano. Instala Python o utiliza INICIAR-PYTHON.bat.
 pause
 exit /b 1
)
powershell -NoProfile -Command "$p=(Get-Command pythonw.exe).Source; $a=New-ScheduledTaskAction -Execute $p -Argument ('\"'+(Join-Path (Get-Location) 'servidor_python.py')+'\"') -WorkingDirectory (Get-Location).Path; $t=New-ScheduledTaskTrigger -AtLogOn -User ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name); $s=New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew; Register-ScheduledTask -TaskName 'IT-Control-Pro' -Action $a -Trigger $t -Settings $s -Description 'Alarmas y copias de IT Control Pro durante la sesion de Windows' -Force"
if errorlevel 1 (echo No se ha podido registrar el inicio automatico.) else (echo Inicio automatico configurado para tu sesion de Windows.)
pause
