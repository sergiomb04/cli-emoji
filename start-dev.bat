@echo off
title cli-emoji [Modo Depuracion / Logs]
cd /d "%~dp0"
echo ====================================================================
echo  Iniciando cli-emoji en modo consola (Electron con logs en vivo)
echo  Presiona Ctrl+Alt+X o Ctrl+Alt+Z para probar el overlay
echo ====================================================================
npx electron . --enable-logging
pause
