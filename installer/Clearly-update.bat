@echo off
rem Updates the Clearly extension to the latest version. Then restart Chrome or click the refresh icon on the extension.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0update.ps1"
echo.
pause
