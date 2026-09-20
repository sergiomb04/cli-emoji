@echo off
cd /d "%~dp0"
if exist "%~dp0node_modules\electron\dist\electron.exe" (
    start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0."
) else (
    npm run electron
)