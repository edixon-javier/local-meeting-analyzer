"""
backend/api/routers/dictation.py
Controlador de endpoints para el Dictado en Cursor y Auditoría de Voz.
"""

import os
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel

from core.paths import get_dictations_dir
from services.dictation_service import dictation_service

logger = logging.getLogger("api.dictation")

router = APIRouter()


class StartDictationRequest(BaseModel):
    mode: Optional[str] = None
    provider: Optional[str] = None


class StopDictationRequest(BaseModel):
    mode: Optional[str] = None
    provider: Optional[str] = None
    inject: Optional[bool] = True


@router.post("/start")
async def start_dictation(request: Optional[StartDictationRequest] = None):
    """Inicia la captura de audio en memoria para dictado interactivo."""
    try:
        mode = request.mode if request else None
        provider = request.provider if request else None
        result = dictation_service.start_dictation(mode=mode, provider=provider)
        return result
    except Exception as e:
        logger.error(f"Error al iniciar dictado: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stop")
async def stop_dictation(request: Optional[StopDictationRequest] = None):
    """
    Detiene la grabación en curso, procesa STT, pulido con LLM (si aplica),
    inyecta en cursor y devuelve el resultado completo con métricas de latencia.
    """
    try:
        mode = request.mode if request else None
        provider = request.provider if request else None
        inject = request.inject if (request and request.inject is not None) else True
        result = dictation_service.stop_dictation(mode=mode, provider=provider, inject=inject)
        return result
    except Exception as e:
        logger.error(f"Error al detener y procesar dictado: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cancel")
async def cancel_dictation():
    """Cancela y descarta el dictado actual liberando memoria."""
    try:
        return dictation_service.cancel_dictation()
    except Exception as e:
        logger.error(f"Error al cancelar dictado: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def get_dictation_status():
    """Retorna el estado de la captura, duración y nivel RMS en vivo."""
    try:
        return dictation_service.get_status()
    except Exception as e:
        logger.error(f"Error obteniendo estado de dictado: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history")
async def get_dictation_history(
    limit: int = Query(50, ge=1, le=500),
    search: str = Query("", max_length=200)
):
    """Retorna la lista de dictados y notas de voz registrados."""
    try:
        return dictation_service.get_history(limit=limit, search=search)
    except Exception as e:
        logger.error(f"Error consultando historial de dictados: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/audio/{filename}")
async def get_dictation_audio(filename: str):
    """Sirve el archivo de audio (.mp3 o .wav) de un dictado con protección path traversal y resolución de formato."""
    safe_name = os.path.basename(filename)
    dict_dir = get_dictations_dir()
    file_path = os.path.join(dict_dir, safe_name)

    # Validar que no se salga de la carpeta
    if not os.path.commonpath([dict_dir, os.path.abspath(file_path)]) == os.path.abspath(dict_dir):
        raise HTTPException(status_code=400, detail="Ruta de archivo inválida")

    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        # Fallback a otra extensión si existe (ej. pidieron .mp3 pero se conservó .wav o viceversa)
        base_name, _ = os.path.splitext(safe_name)
        alt_ext = ".wav" if safe_name.lower().endswith(".mp3") else ".mp3"
        alt_path = os.path.join(dict_dir, f"{base_name}{alt_ext}")
        if os.path.exists(alt_path) and os.path.isfile(alt_path):
            file_path = alt_path
            safe_name = f"{base_name}{alt_ext}"
        else:
            raise HTTPException(status_code=404, detail="Archivo de audio no encontrado")

    media_type = "audio/mpeg" if safe_name.lower().endswith(".mp3") else "audio/wav"
    return FileResponse(file_path, media_type=media_type, filename=safe_name)


@router.delete("/{dictation_id}")
async def delete_dictation(dictation_id: str):
    """Elimina permanentemente un dictado y sus archivos del disco."""
    try:
        success = dictation_service.delete_dictation(dictation_id)
        if not success:
            raise HTTPException(status_code=404, detail="Dictado no encontrado")
        return {"success": True, "id": dictation_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error eliminando dictado '{dictation_id}': {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{dictation_id}/reinject")
async def reinject_dictation(dictation_id: str):
    """Vuelve a inyectar en el cursor activo el texto de un dictado previo."""
    try:
        result = dictation_service.reinject(dictation_id)
        return result
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Dictado no encontrado")
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Error re-inyectando dictado '{dictation_id}': {e}")
        raise HTTPException(status_code=500, detail=str(e))
