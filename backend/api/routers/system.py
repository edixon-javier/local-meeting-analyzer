from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from core.config import Config, system_config
from services.session_manager import SessionManager, session_manager
from domain.interfaces import IAudioCapture, IAnalyzer, ITranscriber
from services.audio_service import audio_service
from services.analysis_service import AnalysisService
from services.transcription_service import TranscriptionService

router = APIRouter()

class ConfigUpdateRequest(BaseModel):
    whisper_model: Optional[str] = None
    ollama_model: Optional[str] = None
    ai_provider: Optional[str] = None
    openai_api_key: Optional[str] = None
    openai_model: Optional[str] = None
    analysis_focus: Optional[str] = None
    record_mode: Optional[str] = None
    mic_device_id: Optional[str] = None
    diarize: Optional[bool] = None

def get_config() -> Config:
    return system_config

def get_session_manager() -> SessionManager:
    return session_manager

def get_audio_service() -> IAudioCapture:
    return audio_service

# To keep singleton state for transcriber and analyzer without globals in routers, 
# we can instantiate them in a container or just import the configured instances. 
# For DI in FastAPI, we use generators.
_transcriber_instance = TranscriptionService(system_config)
_analyzer_instance = AnalysisService(system_config)

def get_transcriber() -> ITranscriber:
    return _transcriber_instance

def get_analyzer() -> IAnalyzer:
    return _analyzer_instance

@router.get("/status")
def get_status(
    config: Config = Depends(get_config),
    session: SessionManager = Depends(get_session_manager),
    audio: IAudioCapture = Depends(get_audio_service),
    analyzer: IAnalyzer = Depends(get_analyzer),
    transcriber: ITranscriber = Depends(get_transcriber)
):
    """Estado general del sistema."""
    return {
        "ollama_running": analyzer.is_running(),
        "recording": audio.is_recording,
        "paused": audio.is_paused,
        "processing": session.is_processing(),
        "has_transcript": session.get_transcript() is not None,
        "has_analysis": session.get_state().get("analysis") is not None,
        "whisper_model": transcriber.model_name,
        "llm_model": analyzer.model,
        "transcription_progress": transcriber.get_progress(),
        "ai_provider": config.get("ai_provider", "local")
    }

@router.get("/status/ollama-models")
def get_ollama_models():
    """Retorna la lista de modelos de Ollama disponibles localmente."""
    import requests
    try:
        response = requests.get("http://localhost:11434/api/tags", timeout=3)
        if response.status_code == 200:
            models_data = response.json().get("models", [])
            return {"models": [m["name"] for m in models_data]}
    except Exception as e:
        print(f"[API] Error al consultar modelos en Ollama: {e}")
    # Fallback si Ollama no responde
    return {"models": ["phi3", "llama3", "gemma", "mistral"]}

@router.get("/session")
def get_session(
    session: SessionManager = Depends(get_session_manager),
    audio: IAudioCapture = Depends(get_audio_service)
):
    """Retorna el estado completo de la sesión actual."""
    session.set_recording(audio.is_recording)
    session.set_paused(audio.is_paused)
    return session.get_state()

@router.get("/audio/devices")
def get_audio_devices():
    """Retorna los dispositivos de audio de grabación disponibles."""
    import soundcard as sc
    try:
        devices = []
        try:
            ds = sc.default_speaker()
            devices.append({"id": "loopback", "name": f"Audio del Sistema (Loopback) - {ds.name}"})
        except Exception as e:
            devices.append({"id": "loopback", "name": "Audio del Sistema (Loopback)"})
            print(f"[API] Error al obtener default speaker: {e}")

        mics = sc.all_microphones(include_loopback=False)
        for mic in mics:
            devices.append({"id": mic.id, "name": f"Micrófono - {mic.name}"})
        return {"devices": devices}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/config")
def get_current_config(config: Config = Depends(get_config)):
    """Retorna la configuración actual del sistema."""
    return config.settings

@router.post("/config")
def update_config(
    request: ConfigUpdateRequest,
    config: Config = Depends(get_config),
    analyzer: IAnalyzer = Depends(get_analyzer),
    transcriber: ITranscriber = Depends(get_transcriber)
):
    """Actualiza la configuración del sistema."""
    updates = {k: v for k, v in request.model_dump().items() if v is not None}
    config.update(updates)
    config.save()
    
    if "whisper_model" in updates:
        transcriber.set_model(updates["whisper_model"])
        
    analyzer.set_config(config)
    transcriber.set_config(config)
    
    return {"status": "success", "config": config.settings}

@router.get("/events")
async def sse_events():
    """Endpoint de Server-Sent Events (SSE) para notificar cambios de estado en tiempo real del sistema (ej. Ollama)."""
    from fastapi.responses import StreamingResponse
    from services.ollama_heartbeat import active_listeners, ollama_online
    import asyncio

    async def event_generator():
        queue = asyncio.Queue()
        active_listeners.append(queue)
        
        # Enviar estado inicial inmediato al conectar
        initial_status = "online" if ollama_online else "offline"
        yield f"data: {{\"event\": \"ollama_status\", \"status\": \"{initial_status}\"}}\n\n"
        
        try:
            while True:
                data = await queue.get()
                yield data
        finally:
            # Limpiar al desconectar el cliente bajo cualquier circunstancia
            if queue in active_listeners:
                active_listeners.remove(queue)
                
    return StreamingResponse(event_generator(), media_type="text/event-stream")
