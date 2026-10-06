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

_models_cache = {
    "models": ["phi3", "llama3", "gemma", "mistral"],
    "timestamp": 0.0,
    "ttl": 30.0  # 30 segundos
}

@router.get("/status/ollama-models")
def get_ollama_models():
    """Retorna la lista de modelos de Ollama disponibles localmente con respuesta inmediata y caché TTL."""
    import time
    import services.ollama_heartbeat as heartbeat

    now = time.time()

    # 1. Si el heartbeat ya tiene modelos en memoria y Ollama está online, responder de inmediato (<1ms)
    if getattr(heartbeat, "ollama_online", False) and getattr(heartbeat, "cached_models", None):
        return {"models": heartbeat.cached_models}

    # 2. Si Ollama está marcado explícitamente como offline por el heartbeat, devolver fallback al instante sin bloquear
    if not getattr(heartbeat, "ollama_online", False) and _models_cache["timestamp"] > 0:
        return {"models": _models_cache["models"]}

    # 3. Si la caché local sigue vigente dentro del TTL, retornar inmediatamente (<1ms)
    if (now - _models_cache["timestamp"]) < _models_cache["ttl"]:
        return {"models": _models_cache["models"]}

    # 4. Si Ollama está offline según el heartbeat, evitar completamente peticiones HTTP
    if not getattr(heartbeat, "ollama_online", True):
        _models_cache["timestamp"] = now
        return {"models": _models_cache["models"]}

    # 5. Consulta sincrónica con timeout ultra-corto (0.6s) solo si no se sabe el estado y expiró el TTL
    import requests
    try:
        response = requests.get("http://localhost:11434/api/tags", timeout=0.6)
        if response.status_code == 200:
            models_data = response.json().get("models", [])
            models = [m["name"] for m in models_data if isinstance(m, dict) and "name" in m]
            if models:
                _models_cache["models"] = models
                _models_cache["timestamp"] = now
                return {"models": models}
    except Exception as e:
        print(f"[API] Ollama offline o timeout en /status/ollama-models: {e}")

    # Fallback si Ollama no responde
    _models_cache["timestamp"] = now
    return {"models": _models_cache["models"]}

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

class TestAiRequest(BaseModel):
    provider: str
    api_key: Optional[str] = None
    model: Optional[str] = None

@router.post("/status/test-ai")
def test_ai_connection(
    request: TestAiRequest,
    config: Config = Depends(get_config)
):
    """Prueba la conexión y latencia con el proveedor de IA configurado (OpenAI o Ollama)."""
    import time
    provider = request.provider.lower().strip()
    
    if provider == "openai":
        api_key = (request.api_key or "").strip() or config.get("openai_api_key", "").strip()
        if not api_key:
            raise HTTPException(status_code=400, detail="Debes ingresar o tener guardada una clave API de OpenAI.")
        
        model = (request.model or "").strip() or config.get("openai_model", "gpt-4o-mini")
        
        try:
            import openai
            client = openai.OpenAI(api_key=api_key, timeout=12.0)
            t0 = time.time()
            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": "ping"}],
                max_tokens=2
            )
            latency_ms = max(1, int((time.time() - t0) * 1000))
            return {
                "status": "ok",
                "provider": "openai",
                "model": model,
                "latency_ms": latency_ms,
                "message": f"Conexión exitosa con OpenAI ({latency_ms} ms). Modelo '{model}' verificado y listo."
            }
        except Exception as e:
            err_str = str(e).lower()
            if "authentication" in err_str or "invalid_api_key" in err_str or "incorrect api key" in err_str or "401" in err_str:
                raise HTTPException(status_code=401, detail="API Key de OpenAI inválida o no autorizada (Error 401). Verifica tu clave en platform.openai.com.")
            elif "rate_limit" in err_str or "quota" in err_str or "429" in err_str:
                raise HTTPException(status_code=429, detail="Límite de cuota excedido o saldo insuficiente en tu cuenta de OpenAI (Error 429).")
            elif "model_not_found" in err_str or "does not exist" in err_str or "404" in err_str:
                raise HTTPException(status_code=404, detail=f"El modelo '{model}' no existe o tu cuenta no tiene acceso a él en OpenAI.")
            else:
                raise HTTPException(status_code=500, detail=f"Error al conectar con OpenAI: {str(e)}")

    elif provider == "local":
        model = (request.model or "").strip() or config.get("ollama_model", "phi3")
        import requests
        t0 = time.time()
        try:
            tags_res = requests.get("http://localhost:11434/api/tags", timeout=3.0)
            if tags_res.status_code != 200:
                raise HTTPException(status_code=503, detail="Ollama respondió con error al listar modelos.")
            
            gen_res = requests.post(
                "http://localhost:11434/api/generate",
                json={"model": model, "prompt": "ping", "stream": False, "options": {"num_predict": 2}},
                timeout=15.0
            )
            if gen_res.status_code != 200:
                raise HTTPException(
                    status_code=gen_res.status_code,
                    detail=f"Ollama no pudo generar con el modelo '{model}'. Verifica si está descargado con 'ollama run {model}'."
                )
            latency_ms = max(1, int((time.time() - t0) * 1000))
            return {
                "status": "ok",
                "provider": "local",
                "model": model,
                "latency_ms": latency_ms,
                "message": f"Ollama local en línea ({latency_ms} ms). Modelo '{model}' respondiendo correctamente."
            }
        except requests.exceptions.ConnectionError:
            raise HTTPException(status_code=503, detail="Ollama no está en ejecución en http://localhost:11434. Inicia el servicio con 'ollama serve'.")
        except requests.exceptions.Timeout:
            raise HTTPException(status_code=504, detail="Tiempo de espera agotado (>15s) al conectar con Ollama. El modelo podría estar cargándose en RAM.")
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(status_code=500, detail=f"Error al verificar Ollama: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail=f"Proveedor desconocido: '{provider}'. Valores permitidos: 'openai', 'local'.")

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
