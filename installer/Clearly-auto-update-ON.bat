@echo off
rem Turns ON the automatic daily update of the Clearly extension (runs once, no administrator needed).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0update.ps1" -InstallTask
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0update.ps1"
echo.
pause
