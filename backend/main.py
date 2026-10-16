"""
main.py
API local con FastAPI para el Local Meeting Analyzer.
Se comunica con el Frontend (Electron) via HTTP en localhost.
"""

import os
import sys
import asyncio

# ─────────────────────────────────────────
# Parche para error de conexión en streaming de audio (WinError 10054)
# ─────────────────────────────────────────
if sys.platform == "win32":
    import asyncio
    from functools import wraps
    try:
        from asyncio.proactor_events import _ProactorBasePipeTransport
        def silence_connection_lost(func):
            @wraps(func)
            def wrapper(self, *args, **kwargs):
                try:
                    return func(self, *args, **kwargs)
                except (ConnectionResetError, BrokenPipeError):
                    pass
            return wrapper
        _ProactorBasePipeTransport._call_connection_lost = silence_connection_lost(_ProactorBasePipeTransport._call_connection_lost)
    except ImportError:
        pass

# ─────────────────────────────────────────
# Modo servidor MCP (stdio): "meeting-backend.exe --mcp" expone las reuniones a asistentes de IA
# (Claude Desktop, Cursor...) desde la app instalada, sin necesidad de Python. Va antes de configurar
# los registros porque el protocolo MCP usa stdout y no debe mezclarse con otros mensajes.
# ─────────────────────────────────────────
if __name__ == "__main__" and "--mcp" in sys.argv:
    import mcp_server
    mcp_server.mcp.run(transport="stdio")
    sys.exit(0)

# Rutas centralizadas (datos de usuario en MEETING_ANALYZER_DATA_DIR, binarios empaquetados)
from core.paths import get_root_dir, get_bin_dir
from core.version import APP_VERSION
from core.logging_setup import setup_logging, log_startup_banner

# Log local rotativo (<datos>/logs/backend.log, 1 MB x 5): captura print(), uvicorn y excepciones.
# También cubre el ejecutable congelado sin consola (stdout/stderr None). Solo se activa al
# ejecutar el backend (python main.py / meeting-backend.exe), no al importar main en las pruebas.
if __name__ == "__main__":
    setup_logging()
    log_startup_banner()

# Asegurar que el ffmpeg empaquetado (bin/) esté en el PATH para subprocesos.
# Si no existe, se usa el ffmpeg del PATH del sistema.
_root_dir = get_root_dir()
_local_bin = get_bin_dir()
if os.path.isdir(_local_bin):
    if _local_bin not in os.environ.get("PATH", "").split(os.pathsep):
        os.environ["PATH"] = _local_bin + os.pathsep + os.environ.get("PATH", "")

# Cargar variables de entorno desde .env centralizado en el root
_env_path = os.path.join(_root_dir, ".env")
if os.path.exists(_env_path):
    with open(_env_path, "r", encoding="utf-8") as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _k, _v = _line.split("=", 1)
                # El .env solo aporta valores por defecto: no pisa variables ya definidas
                # (p. ej. BACKEND_PORT o MEETING_ANALYZER_DATA_DIR que pasa Electron o un script)
                os.environ.setdefault(_k.strip(), _v.strip())

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

# Importar routers refactorizados
from api.routers import recording, analysis, history, system, setup, dictation

# ─────────────────────────────────────────
# App Setup
# ─────────────────────────────────────────
app = FastAPI(
    title="Local Meeting Analyzer API",
    description="Motor local de análisis de reuniones. Procesamiento 100% offline.",
    version=APP_VERSION
)

_logger = logging.getLogger("api")


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Registra cualquier error no controlado (con traceback, sin cuerpo de la petición) y responde 500."""
    _logger.error(
        "Error no controlado en %s %s", request.method, request.url.path,
        exc_info=(type(exc), exc, exc.__traceback__),
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Error interno del servidor. Revisa los registros de la aplicación (Ajustes > Ayuda y soporte)."},
        # Este manejador queda fuera del CORSMiddleware: sin la cabecera el navegador vería
        # "Network Error" y la UI creería que el backend está caído.
        headers={"Access-Control-Allow-Origin": "*"},
    )

# Permitir peticiones desde Electron (localhost cualquier puerto)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_heartbeat_task = None

@app.on_event("startup")
async def startup_event():
    global _heartbeat_task
    import asyncio
    from api.routers.system import _analyzer_instance
    from services.ollama_heartbeat import start_ollama_heartbeat
    _logger.info("Backend v%s listo", APP_VERSION)
    _heartbeat_task = asyncio.create_task(start_ollama_heartbeat(_analyzer_instance))

@app.on_event("shutdown")
async def shutdown_event():
    global _heartbeat_task
    if _heartbeat_task and not _heartbeat_task.done():
        _heartbeat_task.cancel()
        try:
            await _heartbeat_task
        except (asyncio.CancelledError, Exception):
            # CancelledError es BaseException: sin capturarla, uvicorn reporta "shutdown failed"
            pass

# ─────────────────────────────────────────
# Registro de Routers
# ─────────────────────────────────────────
app.include_router(system.router, tags=["System"])
app.include_router(recording.router, prefix="/recording", tags=["Recording"])
app.include_router(analysis.router, tags=["Analysis"])
app.include_router(history.router, prefix="/recordings", tags=["History"])
app.include_router(setup.router, tags=["Setup"])
app.include_router(dictation.router, prefix="/dictation", tags=["Dictation"])

# ─────────────────────────────────────────
# Punto de entrada
# ─────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("BACKEND_PORT", 8765))
    print("=" * 50)
    print("  Local Meeting Analyzer - Backend API")
    print(f"  Escuchando en http://localhost:{port}")
    print("=" * 50)
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
