import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from state import audio_capture, session_state, system_config

router = APIRouter()

class StartRecordingRequest(BaseModel):
    pass

@router.post("/start")
def start_recording(request: Optional[StartRecordingRequest] = None):
    """Inicia la grabación del dispositivo especificado."""
    if audio_capture.is_recording:
        raise HTTPException(status_code=400, detail="Ya hay una grabación en curso.")

    try:
        # Directorio de grabaciones
        recordings_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "recordings")
        record_mode = system_config.get("record_mode", "both")
        mic_device_id = system_config.get("mic_device_id", "default")
        audio_path = audio_capture.start(output_dir=recordings_dir, mode=record_mode, mic_device_id=mic_device_id)
        session_state["recording"] = True
        session_state["audio_path"] = audio_path
        session_state["transcript"] = None
        session_state["analysis"] = None
        return {"status": "recording", "audio_path": audio_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/pause")
def pause_recording():
    """Pausa la grabación activa."""
    if not audio_capture.is_recording:
        raise HTTPException(status_code=400, detail="No hay una grabación activa.")
    if audio_capture.is_paused:
        raise HTTPException(status_code=400, detail="La grabación ya está pausada.")
    try:
        audio_capture.pause()
        return {"status": "paused"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/resume")
def resume_recording():
    """Reanuda la grabación pausada."""
    if not audio_capture.is_recording:
        raise HTTPException(status_code=400, detail="No hay una grabación activa.")
    if not audio_capture.is_paused:
        raise HTTPException(status_code=400, detail="La grabación no está pausada.")
    try:
        audio_capture.resume()
        return {"status": "recording"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/stop")
def stop_recording():
    """Detiene la grabación y guarda el archivo WAV."""
    if not audio_capture.is_recording:
        raise HTTPException(status_code=400, detail="No hay ninguna grabación activa.")

    try:
        audio_path = audio_capture.stop()
        session_state["recording"] = False
        session_state["audio_path"] = audio_path
        return {"status": "stopped", "audio_path": audio_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
