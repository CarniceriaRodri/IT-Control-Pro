@echo off
powershell -NoProfile -Command "Unregister-ScheduledTask -TaskName 'IT-Control-Pro' -Confirm:$false"
pause
