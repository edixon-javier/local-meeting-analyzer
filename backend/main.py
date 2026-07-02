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

# Asegurar que ffmpeg esté en el PATH de Windows para Whisper
if r"C:\ffmpeg\bin" not in os.environ["PATH"]:
    os.environ["PATH"] += os.pathsep + r"C:\ffmpeg\bin"

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
    print("=" * 50)
    print("  Local Meeting Analyzer - Backend API")
    print("  Escuchando en http://localhost:8765")
    print("=" * 50)
    uvicorn.run(app, host="127.0.0.1", port=8765, log_level="info")
