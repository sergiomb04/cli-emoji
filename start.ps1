$projectDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
Set-Location $projectDir

# Detener cualquier instancia previa para evitar conflictos con los atajos globales
Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 300

# Lanzar Electron a través de npm en segundo plano sin ventana de consola visible
Start-Process powershell -WindowStyle Hidden -ArgumentList "-Command", "npm run electron"