"""
backend/tests/test_api_dictation.py
Pruebas para los endpoints API de dictado en cursor (/dictation/*).
"""

import os
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from main import app
from core.paths import get_dictations_dir


@pytest.fixture
def client():
    return TestClient(app)


def test_api_dictation_status(client):
    """Verifica GET /dictation/status."""
    res = client.get("/dictation/status")
    assert res.status_code == 200
    data = res.json()
    assert "is_recording" in data
    assert "duration_seconds" in data
    assert "rms_level" in data
    assert "mode" in data
    assert "provider" in data


def test_api_dictation_start_and_cancel(client):
    """Verifica POST /dictation/start y POST /dictation/cancel."""
    with patch("services.dictation_service.dictation_service._record_loop"):
        start_res = client.post("/dictation/start", json={"mode": "smart_polish", "provider": "groq"})
        assert start_res.status_code == 200
        start_data = start_res.json()
        assert start_data.get("status") in ("recording", "already_recording")

        cancel_res = client.post("/dictation/cancel")
        assert cancel_res.status_code == 200
        cancel_data = cancel_res.json()
        assert cancel_data["cancelled"] is True


def test_api_dictation_stop(client):
    """Verifica POST /dictation/stop."""
    mock_result = {
        "id": "dict_test_123",
        "raw_transcript": "texto de prueba",
        "polished_transcript": "Texto de prueba.",
        "injected_text": "Texto de prueba.",
        "mode": "smart_polish",
        "provider": "groq",
        "injection_result": {"injected": True},
        "metrics": {"total_latency_ms": 150.0},
    }
    with patch("services.dictation_service.dictation_service.stop_dictation", return_value=mock_result):
        res = client.post("/dictation/stop", json={"mode": "smart_polish", "inject": True})
        assert res.status_code == 200
        data = res.json()
        assert data["id"] == "dict_test_123"
        assert data["raw_transcript"] == "texto de prueba"


def test_api_dictation_history(client):
    """Verifica GET /dictation/history."""
    res = client.get("/dictation/history?limit=10")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_api_dictation_audio_security_and_streaming(client):
    """Verifica seguridad contra Path Traversal y streaming en GET /dictation/audio/{filename}."""
    # 1. Intento de path traversal con ../
    res_traversal = client.get("/dictation/audio/..%2F..%2Fconfig.json")
    assert res_traversal.status_code in (400, 404)

    # 2. Archivo inexistente -> 404
    res_404 = client.get("/dictation/audio/non_existent_audio.mp3")
    assert res_404.status_code == 404

    # 3. Archivo válido
    dict_dir = get_dictations_dir()
    test_audio = os.path.join(dict_dir, "test_audio_sample.wav")
    with open(test_audio, "wb") as f:
        f.write(b"RIFF_FAKE_WAV_FOR_TESTING")

    try:
        res_ok = client.get("/dictation/audio/test_audio_sample.wav")
        assert res_ok.status_code == 200
        assert res_ok.headers["content-type"] == "audio/wav"
        assert res_ok.content == b"RIFF_FAKE_WAV_FOR_TESTING"

        # 4. Solicitud pidiendo .mp3 cuando solo existe .wav -> resuelve a .wav
        res_fallback = client.get("/dictation/audio/test_audio_sample.mp3")
        assert res_fallback.status_code == 200
        assert res_fallback.headers["content-type"] == "audio/wav"
        assert res_fallback.content == b"RIFF_FAKE_WAV_FOR_TESTING"
    finally:
        if os.path.exists(test_audio):
            os.remove(test_audio)


def test_api_dictation_delete_and_reinject(client):
    """Verifica DELETE /dictation/{id} y POST /dictation/{id}/reinject."""
    # Dictado inexistente -> 404
    del_res = client.delete("/dictation/non_existent_dict_id")
    assert del_res.status_code == 404

    reinject_res = client.post("/dictation/non_existent_dict_id/reinject")
    assert reinject_res.status_code == 404
