import os
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import StreamingResponse
import asyncio
import json

from core.config import Config
from domain.interfaces import IAudioCapture
from services.session_manager import SessionManager
from services.live_transcription_service import live_transcription_service, LiveTranscriptionService
from api.routers.system import get_config, get_session_manager, get_audio_service

router = APIRouter()


def get_live_transcriber() -> LiveTranscriptionService:
    return live_transcription_service


@router.post("/start")
def start_recording(
    config: Config = Depends(get_config),
    session: SessionManager = Depends(get_session_manager),
    audio: IAudioCapture = Depends(get_audio_service),
    live_transcriber: LiveTranscriptionService = Depends(get_live_transcriber)
):
    """Inicia la grabación del dispositivo especificado y la sesión de transcripción en tiempo real."""
    if audio.is_recording:
        raise HTTPException(status_code=400, detail="Ya hay una grabación en curso.")

    try:
        recordings_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "recordings")
        record_mode = config.get("record_mode", "both")
        mic_device_id = config.get("mic_device_id", "default")

        session.reset_for_new_recording()
        session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        session.set_session_id(session_id)

        audio_path = audio.start(output_dir=recordings_dir, mode=record_mode, mic_device_id=mic_device_id)

        session.set_recording(True)
        session.set_audio_path(audio_path)

        # Conectar flujo de audio en vivo al transcriptor
        audio.add_live_listener(live_transcriber.feed_audio_chunk)
        live_transcriber.start_session(session_id)

        return {
            "status": "recording",
            "audio_path": audio_path,
            "session_id": session_id
        }
    except Exception as e:
        audio.remove_live_listener(live_transcriber.feed_audio_chunk)
        live_transcriber.cancel_session()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pause")
def pause_recording(
    audio: IAudioCapture = Depends(get_audio_service),
    session: SessionManager = Depends(get_session_manager),
    live_transcriber: LiveTranscriptionService = Depends(get_live_transcriber)
):
    """Pausa la grabación activa y la transcripción en vivo."""
    if not audio.is_recording:
        raise HTTPException(status_code=400, detail="No hay una grabación activa.")
    if audio.is_paused:
        raise HTTPException(status_code=400, detail="La grabación ya está pausada.")
    try:
        audio.pause()
        session.set_paused(True)
        live_transcriber.pause_session()
        return {"status": "paused"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/resume")
def resume_recording(
    audio: IAudioCapture = Depends(get_audio_service),
    session: SessionManager = Depends(get_session_manager),
    live_transcriber: LiveTranscriptionService = Depends(get_live_transcriber)
):
    """Reanuda la grabación pausada y la transcripción en vivo."""
    if not audio.is_recording:
        raise HTTPException(status_code=400, detail="No hay una grabación activa.")
    if not audio.is_paused:
        raise HTTPException(status_code=400, detail="La grabación no está pausada.")
    try:
        audio.resume()
        session.set_paused(False)
        live_transcriber.resume_session()
        return {"status": "recording"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stop")
def stop_recording(
    session: SessionManager = Depends(get_session_manager),
    audio: IAudioCapture = Depends(get_audio_service),
    live_transcriber: LiveTranscriptionService = Depends(get_live_transcriber)
):
    """Detiene la grabación, finaliza la transcripción en vivo y guarda el archivo."""
    if not audio.is_recording:
        raise HTTPException(status_code=400, detail="No hay ninguna grabación activa.")

    try:
        audio.remove_live_listener(live_transcriber.feed_audio_chunk)
        live_text = live_transcriber.stop_session()
        session.set_live_transcript(live_text)

        audio_path = audio.stop()
        session.set_recording(False)
        session.set_audio_path(audio_path)
        return {
            "status": "stopped",
            "audio_path": audio_path,
            "session_id": session.get_session_id(),
            "live_transcript": live_text
        }
    except Exception as e:
        audio.remove_live_listener(live_transcriber.feed_audio_chunk)
        live_transcriber.cancel_session()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cancel")
def cancel_recording(
    session: SessionManager = Depends(get_session_manager),
    audio: IAudioCapture = Depends(get_audio_service),
    live_transcriber: LiveTranscriptionService = Depends(get_live_transcriber)
):
    """Cancela inmediatamente la grabación y la transcripción en vivo, liberando todos los recursos."""
    try:
        audio.remove_live_listener(live_transcriber.feed_audio_chunk)
        live_transcriber.cancel_session()
        audio.cancel()
        session.reset_for_new_recording()
        session.set_recording(False)
        return {"status": "cancelled"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/live-transcription")
async def sse_live_transcription(
    request: Request,
    session_id: Optional[str] = None,
    live_transcriber: LiveTranscriptionService = Depends(get_live_transcriber),
    session: SessionManager = Depends(get_session_manager)
):
    """
    Canal SSE dedicado para transmitir en tiempo real la transcripción palabra por palabra
    mientras se graba la reunión.
    """
    loop = asyncio.get_running_loop()
    event_queue = asyncio.Queue()
    live_transcriber.register_listener(event_queue, loop)

    active_id = session_id or session.get_session_id() or live_transcriber.active_session_id

    async def event_generator():
        # Enviar estado inicial y segmentos confirmados si existen (permite reconexión sin pérdida)
        confirmed = live_transcriber.get_confirmed_segments()
        init_data = {
            "event": "init",
            "session_id": active_id,
            "status": "recording" if live_transcriber.is_active else "idle",
            "confirmed_segments": confirmed
        }
        yield f"data: {json.dumps(init_data, ensure_ascii=False)}\n\n"

        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    data = await asyncio.wait_for(event_queue.get(), timeout=1.0)
                    yield data

                    # Si el evento recibido indica fin de sesión o cancelación, salir del generador
                    try:
                        line = data.strip()
                        if line.startswith("data: "):
                            parsed = json.loads(line[6:])
                            ev = parsed.get("event")
                            if ev in ("complete", "cancelled"):
                                break
                    except Exception:
                        pass
                except asyncio.TimeoutError:
                    if await request.is_disconnected():
                        break
                    # Enviar ping de keep-alive SSE para mantener la conexión activa
                    yield ": ping\n\n"
        finally:
            live_transcriber.unregister_listener(event_queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


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
