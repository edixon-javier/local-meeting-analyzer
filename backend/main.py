"""
main.py
API local con FastAPI para el Local Meeting Analyzer.
Se comunica con el Frontend (Electron) via HTTP en localhost.
"""

import os
import sys

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

# Asegurar que ffmpeg local esté en el PATH para Whisper y subprocesos
def get_root_dir() -> str:
    if getattr(sys, "frozen", False):
        exe_dir = os.path.dirname(sys.executable)
        if os.path.basename(exe_dir).lower() == "backend":
            return os.path.dirname(exe_dir)
        return exe_dir
    else:
        return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

_root_dir = get_root_dir()
_local_bin = os.path.join(_root_dir, "bin")
if os.path.exists(_local_bin):
    if _local_bin not in os.environ["PATH"]:
        os.environ["PATH"] = _local_bin + os.pathsep + os.environ["PATH"]
else:
    if r"C:\ffmpeg\bin" not in os.environ["PATH"]:
        os.environ["PATH"] += os.pathsep + r"C:\ffmpeg\bin"

# Cargar variables de entorno desde .env centralizado en el root
_env_path = os.path.join(_root_dir, ".env")
if os.path.exists(_env_path):
    with open(_env_path, "r", encoding="utf-8") as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _k, _v = _line.split("=", 1)
                os.environ[_k.strip()] = _v.strip()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Importar routers refactorizados
from api.routers import recording, analysis, history, system

# ─────────────────────────────────────────
# App Setup
# ─────────────────────────────────────────
app = FastAPI(
    title="Local Meeting Analyzer API",
    description="Motor local de análisis de reuniones. Procesamiento 100% offline.",
    version="1.0.0"
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
    _heartbeat_task = asyncio.create_task(start_ollama_heartbeat(_analyzer_instance))

@app.on_event("shutdown")
async def shutdown_event():
    global _heartbeat_task
    if _heartbeat_task and not _heartbeat_task.done():
        _heartbeat_task.cancel()
        try:
            await _heartbeat_task
        except Exception:
            pass

# ─────────────────────────────────────────
# Registro de Routers
# ─────────────────────────────────────────
app.include_router(system.router, tags=["System"])
app.include_router(recording.router, prefix="/recording", tags=["Recording"])
app.include_router(analysis.router, tags=["Analysis"])
app.include_router(history.router, prefix="/recordings", tags=["History"])

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
