@echo off
if exist "%~dp0Meeting Analyzer.exe" (
    start "" "%~dp0Meeting Analyzer.exe" %*
    exit /b 0
)

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
)

REM ── Cerrar instancias previas para asegurar que los cambios se apliquen directamente
tasklist /fi "imagename eq electron.exe" 2>nul | find /i "electron.exe" >nul
if not errorlevel 1 (
    echo [RESTART] Cerrando ventana previa para aplicar cambios...
    taskkill /f /im electron.exe >nul 2>&1
    timeout /t 1 /nobreak >nul
)
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8765 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1

cd frontend
if not exist "node_modules" (
    echo [SETUP] Instalando dependencias del frontend...
    call npm install
)

REM Electron descarga su ejecutable bajo demanda; aquí se lanza directamente, así que hay que asegurarlo.
if not exist "node_modules\electron\dist\electron.exe" (
    echo [SETUP] Descargando Electron ^(solo la primera vez^)...
    call node node_modules\electron\install.js
    if not exist "node_modules\electron\dist\electron.exe" (
        echo [ERROR] No se pudo descargar Electron. Revisa tu conexion y vuelve a intentarlo.
        pause
        exit /b 1
    )
)

echo [BUILD] Compilando interfaz de usuario actualizada...
call npm run build
if errorlevel 1 (
    echo [ERROR] Error al compilar la interfaz de usuario.
    pause
    exit /b 1
)

set NODE_ENV=production
set EXTERNAL_BACKEND=false
start "" "node_modules\electron\dist\electron.exe" .
exit
