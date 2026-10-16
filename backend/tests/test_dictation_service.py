"""
backend/tests/test_dictation_service.py
Pruebas unitarias para el servicio de dictado en memoria, procesamiento STT/LLM y auditoría.
"""

import os
import io
import time
import json
import wave
import numpy as np
import pytest
from unittest.mock import MagicMock, patch

from services.dictation_service import (
    DictationService,
    apply_voice_formatting_fallback,
    SYSTEM_PROMPT_POLISH,
)
from core.paths import get_dictations_dir


def test_voice_formatting_fallback():
    """Valida los comandos de formato de voz cuando el LLM está inactivo o en modo literal."""
    # Punto y aparte -> doble salto de línea
    text = "primer párrafo punto y aparte segundo párrafo"
    formatted = apply_voice_formatting_fallback(text)
    assert ".\n\n" in formatted
    assert formatted.startswith("Primer párrafo")

    # Salto de línea
    text2 = "línea uno nueva línea línea dos"
    formatted2 = apply_voice_formatting_fallback(text2)
    assert "\n" in formatted2

    # Dos puntos y comas
    text3 = "lista de elementos dos puntos manzana coma pera"
    formatted3 = apply_voice_formatting_fallback(text3)
    assert ": " in formatted3
    assert ", " in formatted3


def test_audio_to_wav_bytes():
    """Valida la conversión en RAM de un array float32 a un WAV de 16kHz mono de 16 bits sin escribir en disco."""
    service = DictationService()
    # Generar 1 segundo de audio senoidal a 16kHz
    t = np.linspace(0, 1.0, 16000, dtype=np.float32)
    samples = 0.5 * np.sin(2 * np.pi * 440 * t)

    wav_bytes = service._audio_to_wav_bytes(samples, sample_rate=16000)
    assert isinstance(wav_bytes, bytes)
    assert len(wav_bytes) > 32000  # 16000 muestras * 2 bytes/muestra + cabecera WAV (44 bytes)

    # Validar cabecera WAV
    with wave.open(io.BytesIO(wav_bytes), "rb") as wf:
        assert wf.getnchannels() == 1
        assert wf.getsampwidth() == 2
        assert wf.getframerate() == 16000
        assert wf.getnframes() == 16000


def test_dictation_service_state_lifecycle():
    """Prueba el ciclo de vida de inicio, consulta de estado y cancelación en DictationService."""
    service = DictationService()

    # Estado inicial
    status = service.get_status()
    assert status["is_recording"] is False
    assert status["duration_seconds"] == 0.0

    # Iniciar dictado (mocking _record_loop para no requerir micrófono físico)
    with patch.object(service, "_record_loop"):
        start_res = service.start_dictation()
        assert start_res["status"] == "recording"
        assert service.is_recording is True

        # Comprobar que get_status refleja grabación activa
        active_status = service.get_status()
        assert active_status["is_recording"] is True

        # Cancelar dictado
        cancel_res = service.cancel_dictation()
        assert cancel_res["cancelled"] is True
        assert service.is_recording is False

        # Comprobar que volvió a idle
        final_status = service.get_status()
        assert final_status["is_recording"] is False


def test_stop_dictation_empty_or_silence():
    """Valida que detener un dictado sin audio o silencioso devuelva un resultado limpio sin error."""
    service = DictationService()
    service._is_recording = True
    service._start_time = time.time() - 0.1
    service._audio_chunks = []

    res = service.stop_dictation()
    assert res["status"] == "empty_audio"
    assert res["raw_transcript"] == ""
    assert service.is_recording is False


def test_stt_transcription_groq_success():
    """Valida el cliente STT de Groq simulando la respuesta exitosa de whisper-large-v3-turbo."""
    service = DictationService()
    fake_wav = b"RIFF....WAVEfmt ...."

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"text": "Esta es una prueba de transcripción con Groq LPU."}

    with patch("requests.post", return_value=mock_resp) as mock_post:
        text = service._stt_groq(fake_wav, "gsk_test_api_key")
        assert text == "Esta es una prueba de transcripción con Groq LPU."
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        assert args[0] == "https://api.groq.com/openai/v1/audio/transcriptions"
        assert kwargs["data"]["model"] == "whisper-large-v3-turbo"


def test_llm_polish_transcript_groq():
    """Valida el pulido de texto con Groq Llama 3.1 8B Instant."""
    service = DictationService()
    raw = "eh bueno vamos a enviar tres no cuatro reportes punto y aparte"

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [
            {
                "message": {
                    "content": "Vamos a enviar cuatro reportes.\n\n"
                }
            }
        ]
    }

    with patch("core.config.system_config.get") as mock_cfg_get, patch("requests.post", return_value=mock_resp):
        mock_cfg_get.side_effect = lambda k, default=None: "gsk_key" if k == "groq_api_key" else default
        polished, model_used = service._polish_transcript(raw)
        assert "Vamos a enviar cuatro reportes" in polished
        assert model_used == "llama-3.1-8b-instant"


def test_dictation_audit_persistence_and_history():
    """Valida que el guardado de auditoría persista JSON y audio, y que get_history lo liste y filtre correctamente."""
    service = DictationService()
    test_id = f"test_dict_{int(time.time())}"
    dict_dir = get_dictations_dir()

    payload = {
        "id": test_id,
        "timestamp": "2026-10-15T12:00:00",
        "duration_seconds": 3.5,
        "target_app": {"exe_name": "Code.exe", "title": "VS Code - Project"},
        "raw_transcript": "esta es una prueba de dictado guardada",
        "polished_transcript": "Esta es una prueba de dictado guardada.",
        "injected_text": "Esta es una prueba de dictado guardada.",
        "mode": "smart_polish",
        "provider": "groq",
        "audio_file": f"{test_id}.wav",
    }

    # Guardar worker directamente
    fake_wav = b"RIFF_TEST_AUDIO_BYTES_FOR_AUDIT"
    service._save_audit_worker(test_id, fake_wav, payload)

    # Verificar que el archivo JSON existe
    json_path = os.path.join(dict_dir, f"{test_id}.json")
    assert os.path.exists(json_path)

    try:
        # Verificar lectura de historial
        history = service.get_history(limit=50)
        matching = [item for item in history if item.get("id") == test_id]
        assert len(matching) == 1
        assert matching[0]["raw_transcript"] == "esta es una prueba de dictado guardada"

        # Verificar búsqueda por texto y por aplicación
        search_app = service.get_history(search="Code.exe")
        assert any(item.get("id") == test_id for item in search_app)

        search_text = service.get_history(search="dictado guardada")
        assert any(item.get("id") == test_id for item in search_text)

        search_nomatch = service.get_history(search="palabra_que_no_existe_xyz_99")
        assert not any(item.get("id") == test_id for item in search_nomatch)

    finally:
        # Limpiar (incluso usando test_id con extensión .json)
        service.delete_dictation(f"{test_id}.json")
        assert not os.path.exists(json_path)


def test_transcribe_audio_empty_groq_does_not_fall_through():
    """Verifica que si Groq responde con texto vacío (silencio) sin error, no se intente OpenAI ni local."""
    service = DictationService()
    fake_wav = b"RIFF_FAKE_WAV"

    with patch("core.config.system_config.get") as mock_cfg, \
         patch.object(service, "_stt_groq", return_value="") as mock_groq, \
         patch.object(service, "_stt_openai") as mock_openai, \
         patch.object(service, "_stt_local") as mock_local:

        mock_cfg.side_effect = lambda k, default=None: "key" if "key" in k else default
        text, prov = service._transcribe_audio(fake_wav, "groq")

        assert text == ""
        assert prov == "groq"
        mock_groq.assert_called_once()
        mock_openai.assert_not_called()
        mock_local.assert_not_called()


def test_record_loop_fallback_to_48k():
    """Verifica que si el micrófono rechaza 16kHz, _record_loop intente 48kHz sin abortar."""
    service = DictationService()

    mock_mic = MagicMock()
    # Primera llamada a recorder (16kHz) falla; segunda (48kHz) tiene éxito
    rec_48k = MagicMock()
    rec_48k.__enter__.return_value = rec_48k
    rec_48k.record.return_value = np.zeros((4800, 1), dtype=np.float32)

    def mock_recorder(samplerate, channels, blocksize):
        if samplerate == 16000:
            raise RuntimeError("16kHz not supported by this device")
        return rec_48k

    mock_mic.recorder.side_effect = mock_recorder

    with patch.object(service, "_get_mic", return_value=mock_mic):
        service._stop_event.clear()
        # Enviar stop tras una iteración
        def stop_after_one(*args, **kwargs):
            service._stop_event.set()
            return np.zeros((4800, 1), dtype=np.float32)
        rec_48k.record.side_effect = stop_after_one

        service._record_loop()
        assert len(service._audio_chunks) > 0
        # 4800 muestras a 48kHz diezman a 1600 muestras a 16kHz
        assert len(service._audio_chunks[0]) == 1600
