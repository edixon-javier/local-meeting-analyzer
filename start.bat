@echo off
title Local Meeting Analyzer

echo ================================================
echo    Local Meeting Analyzer
echo ================================================
echo Iniciando aplicacion...

REM ── Verificar Python
where python >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python no encontrado. Instala Python 3.10+
    pause
    exit /b 1
)

if not exist "backend\venv" (
    echo [SETUP] Creando entorno virtual Python ^(solo la primera vez^)...
    cd backend
    python -m venv venv
    call venv\Scripts\activate.bat
    pip install -r requirements.txt
    cd ..
)

tasklist /fi "imagename eq ollama.exe" 2>nul | find /i "ollama.exe" >nul
if errorlevel 1 (
    powershell -Command "Start-Process ollama -ArgumentList serve -WindowStyle Hidden"
    timeout /t 3 /nobreak >nul
)

cd frontend
if not exist "node_modules" (
    echo [SETUP] Instalando dependencias del frontend...
    call npm install
)

if not exist "dist\index.html" (
    echo [SETUP] Construyendo la interfaz de usuario...
    call npm run build
)

set NODE_ENV=production
set EXTERNAL_BACKEND=false
start "" "node_modules\electron\dist\electron.exe" .
exit
