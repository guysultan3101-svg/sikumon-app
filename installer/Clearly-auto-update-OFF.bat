@echo off
rem Turns OFF the automatic daily update.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0update.ps1" -RemoveTask
echo.
pause
