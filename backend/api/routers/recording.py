import os
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from core.config import Config
from domain.interfaces import IAudioCapture
from services.session_manager import SessionManager
from api.routers.system import get_config, get_session_manager, get_audio_service

router = APIRouter()

@router.post("/start")
def start_recording(
    config: Config = Depends(get_config),
    session: SessionManager = Depends(get_session_manager),
    audio: IAudioCapture = Depends(get_audio_service)
):
    """Inicia la grabación del dispositivo especificado."""
    if audio.is_recording:
        raise HTTPException(status_code=400, detail="Ya hay una grabación en curso.")

    try:
        recordings_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "recordings")
        record_mode = config.get("record_mode", "both")
        mic_device_id = config.get("mic_device_id", "default")
        
        audio_path = audio.start(output_dir=recordings_dir, mode=record_mode, mic_device_id=mic_device_id)
        
        session.reset_for_new_recording()
        session.set_recording(True)
        session.set_audio_path(audio_path)
        
        return {"status": "recording", "audio_path": audio_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/pause")
def pause_recording(audio: IAudioCapture = Depends(get_audio_service)):
    """Pausa la grabación activa."""
    if not audio.is_recording:
        raise HTTPException(status_code=400, detail="No hay una grabación activa.")
    if audio.is_paused:
        raise HTTPException(status_code=400, detail="La grabación ya está pausada.")
    try:
        audio.pause()
        return {"status": "paused"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/resume")
def resume_recording(audio: IAudioCapture = Depends(get_audio_service)):
    """Reanuda la grabación pausada."""
    if not audio.is_recording:
        raise HTTPException(status_code=400, detail="No hay una grabación activa.")
    if not audio.is_paused:
        raise HTTPException(status_code=400, detail="La grabación no está pausada.")
    try:
        audio.resume()
        return {"status": "recording"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/stop")
def stop_recording(
    session: SessionManager = Depends(get_session_manager),
    audio: IAudioCapture = Depends(get_audio_service)
):
    """Detiene la grabación y guarda el archivo WAV."""
    if not audio.is_recording:
        raise HTTPException(status_code=400, detail="No hay ninguna grabación activa.")

    try:
        audio_path = audio.stop()
        session.set_recording(False)
        session.set_audio_path(audio_path)
        return {"status": "stopped", "audio_path": audio_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/test/start")
def start_test(
    config: Config = Depends(get_config),
    audio: IAudioCapture = Depends(get_audio_service)
):
    """Inicia la grabación de prueba del micrófono y/o sistema."""
    if audio.is_recording:
        raise HTTPException(status_code=400, detail="Ya hay una grabación oficial en curso.")
    if audio.is_testing:
        raise HTTPException(status_code=400, detail="Ya hay una prueba de audio en curso.")
        
    try:
        recordings_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "recordings")
        record_mode = config.get("record_mode", "both")
        mic_device_id = config.get("mic_device_id", "default")
        
        audio_path = audio.start_test(output_dir=recordings_dir, mode=record_mode, mic_device_id=mic_device_id)
        return {"status": "testing", "audio_path": audio_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/test/stop")
def stop_test(audio: IAudioCapture = Depends(get_audio_service)):
    """Detiene la grabación de prueba."""
    if not audio.is_testing:
        raise HTTPException(status_code=400, detail="No hay ninguna prueba activa.")
        
    try:
        audio_path = audio.stop_test()
        return {"status": "stopped", "audio_path": audio_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/test/levels")
def get_test_levels(audio: IAudioCapture = Depends(get_audio_service)):
    """Retorna los niveles de volumen en tiempo real (RMS) de micrófono y sistema."""
    try:
        return audio.get_levels()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
