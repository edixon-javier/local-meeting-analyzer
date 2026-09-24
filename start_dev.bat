@echo off
title Local Meeting Analyzer [Desarrollo]

echo ================================================
echo    Local Meeting Analyzer - Modo Desarrollo
echo ================================================
echo.

REM ── Verificar Python
where python >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python no encontrado. Instala Python 3.10+
    pause
    exit /b 1
)

REM ── Verificar que el entorno virtual existe o crearlo
if not exist "backend\venv" (
    echo [SETUP] Creando entorno virtual Python...
    cd backend
    python -m venv venv
    echo [SETUP] Instalando dependencias del backend...
    call venv\Scripts\activate.bat
    pip install -r requirements.txt
    cd ..
) else (
    echo [OK] Entorno virtual Python listo.
)

REM ── Iniciar Ollama si no está corriendo
tasklist /fi "imagename eq ollama.exe" 2>nul | find /i "ollama.exe" >nul
if errorlevel 1 (
    echo [SETUP] Iniciando Ollama...
    powershell -Command "Start-Process ollama -ArgumentList serve -WindowStyle Hidden"
    timeout /t 3 /nobreak >nul
) else (
    echo [OK] Ollama ya está corriendo.
)

REM ── Iniciar Backend Python en background visible
echo [START] Iniciando Backend API (Python FastAPI)...
start "Meeting Analyzer Backend" cmd /c "cd backend && call venv\Scripts\activate.bat && python main.py"

REM ── Esperar que el backend esté listo
echo [WAIT] Esperando al backend...
timeout /t 5 /nobreak >nul

REM ── Iniciar Frontend Electron
echo [START] Iniciando Frontend (Electron)...
cd frontend
set NODE_ENV=development
set EXTERNAL_BACKEND=true
call npm run dev

echo.
echo [INFO] Cerrando aplicacion...
