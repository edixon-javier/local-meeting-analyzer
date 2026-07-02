from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from state import analyzer, audio_capture, transcriber, session_state
import config_manager

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

@router.get("/status")
def get_status():
    """Estado general del sistema: si Ollama está corriendo, si hay grabación activa, etc."""
    from state import system_config
    return {
        "ollama_running": analyzer.is_ollama_running(),
        "recording": audio_capture.is_recording,
        "paused": audio_capture.is_paused,
        "processing": session_state["processing"],
        "has_transcript": session_state["transcript"] is not None,
        "has_analysis": session_state["analysis"] is not None,
        "whisper_model": transcriber.model_name,
        "llm_model": analyzer.model,
        "transcription_progress": transcriber.get_progress(),
        "ai_provider": system_config.get("ai_provider", "local")
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
        print(f"[Backend] Error al consultar modelos en Ollama: {e}")
    # Fallback si Ollama no está respondiendo
    return {"models": ["phi3", "llama3", "gemma", "mistral"]}

@router.get("/session")
def get_session():
    """Retorna el estado completo de la sesión actual."""
    session_state["recording"] = audio_capture.is_recording
    session_state["paused"] = audio_capture.is_paused
    return session_state

@router.get("/audio/devices")
def get_audio_devices():
    """Retorna los dispositivos de audio de grabación disponibles (loopback y micrófonos)."""
    import soundcard as sc
    try:
        devices = []
        try:
            ds = sc.default_speaker()
            devices.append({
                "id": "loopback",
                "name": f"Audio del Sistema (Loopback) - {ds.name}"
            })
        except Exception as e:
            devices.append({
                "id": "loopback",
                "name": "Audio del Sistema (Loopback)"
            })
            print(f"[Backend] Error al obtener default speaker: {e}")

        # Listar micrófonos físicos
        mics = sc.all_microphones(include_loopback=False)
        for mic in mics:
            devices.append({
                "id": mic.id,
                "name": f"Micrófono - {mic.name}"
            })
        return {"devices": devices}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/config")
def get_config():
    """Retorna la configuración actual del sistema."""
    from state import system_config
    return system_config

@router.post("/config")
def update_config(request: ConfigUpdateRequest):
    """Actualiza la configuración del sistema."""
    from state import system_config
    
    if request.whisper_model is not None:
        system_config["whisper_model"] = request.whisper_model
        transcriber.set_model(request.whisper_model)
        
    if request.ollama_model is not None:
        system_config["ollama_model"] = request.ollama_model
        analyzer.model = request.ollama_model
        
    if request.ai_provider is not None:
        system_config["ai_provider"] = request.ai_provider
        
    if request.openai_api_key is not None:
        system_config["openai_api_key"] = request.openai_api_key
        
    if request.openai_model is not None:
        system_config["openai_model"] = request.openai_model
        
    # Reconfigurar instancias
    analyzer.set_config(system_config)
    transcriber.set_config(system_config)
    if request.analysis_focus is not None:
        system_config["analysis_focus"] = request.analysis_focus
        analyzer.analysis_focus = request.analysis_focus
        
    if request.record_mode is not None:
        system_config["record_mode"] = request.record_mode
        
    if request.mic_device_id is not None:
        system_config["mic_device_id"] = request.mic_device_id
        
    if request.diarize is not None:
        system_config["diarize"] = request.diarize
        
    config_manager.save_config(system_config)
    return {"status": "success", "config": system_config}
