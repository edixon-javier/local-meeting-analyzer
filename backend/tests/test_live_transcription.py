import os
import sys
import unittest
import numpy as np
import asyncio
from unittest.mock import MagicMock, patch, AsyncMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.live_transcription_service import LiveTranscriptionService, SAMPLE_RATE
from fastapi.testclient import TestClient
from main import app
from services.session_manager import session_manager
from services.audio_service import audio_service
from api.routers.recording import sse_live_transcription


class TestLiveTranscriptionService(unittest.TestCase):

    def setUp(self):
        self.service = LiveTranscriptionService(model_name="tiny")

    def tearDown(self):
        if self.service.is_active:
            self.service.cancel_session()

    def test_session_lifecycle(self):
        session_id = "test_session_123"
        self.assertFalse(self.service.is_active)
        self.assertIsNone(self.service.active_session_id)

        # Iniciar sesión
        self.service.start_session(session_id)
        self.assertTrue(self.service.is_active)
        self.assertEqual(self.service.active_session_id, session_id)

        # Pausar y reanudar
        self.service.pause_session()
        self.assertTrue(self.service._is_paused)

        self.service.resume_session()
        self.assertFalse(self.service._is_paused)

        # Detener sesión
        transcript = self.service.stop_session()
        self.assertFalse(self.service.is_active)
        self.assertIsInstance(transcript, str)

    def test_listener_registration_and_broadcast(self):
        event_queue = asyncio.Queue()
        loop = asyncio.new_event_loop()

        self.service.register_listener(event_queue, loop)
        self.assertEqual(len(self.service._listeners), 1)

        # Broadcast event
        self.service._broadcast_event("test_event", {"message": "hello"})
        self.assertFalse(event_queue.empty())

        item = event_queue.get_nowait()
        self.assertIn("test_event", item)
        self.assertIn("hello", item)

        self.service.unregister_listener(event_queue)
        self.assertEqual(len(self.service._listeners), 0)
        loop.close()

    def test_feed_audio_chunk_and_cancel(self):
        session_id = "test_cancel_session"
        self.service.start_session(session_id)

        # Feed 16kHz audio chunk (0.2s of synthetic tone)
        t = np.linspace(0, 0.2, int(SAMPLE_RATE * 0.2), endpoint=False, dtype=np.float32)
        chunk = 0.5 * np.sin(2 * np.pi * 440 * t)

        self.service.feed_audio_chunk(chunk)
        self.assertFalse(self.service._audio_queue.empty())

        # Cancelar sesión
        self.service.cancel_session()
        self.assertFalse(self.service.is_active)
        self.assertTrue(self.service._is_cancelled)
        self.assertTrue(self.service._audio_queue.empty())
        self.assertEqual(len(self.service.get_confirmed_segments()), 0)


class TestLiveTranscriptionEndpoints(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def setUp(self):
        # Asegurar estado limpio antes de cada test
        audio_service._recording = False
        audio_service._paused = False

    def tearDown(self):
        # Asegurar estado limpio
        self.client.post("/recording/cancel")

    def test_start_and_cancel_recording_endpoints(self):
        with patch.object(audio_service, "start", return_value="fake_meeting.wav"), \
             patch.object(audio_service, "cancel") as mock_cancel:

            # Iniciar grabación
            res = self.client.post("/recording/start")
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertEqual(data["status"], "recording")
            self.assertIn("session_id", data)
            self.assertIn("audio_path", data)

            # Verificar que el session_manager tiene el session_id
            self.assertIsNotNone(session_manager.get_session_id())

            # Cancelar grabación
            cancel_res = self.client.post("/recording/cancel")
            self.assertEqual(cancel_res.status_code, 200)
            self.assertEqual(cancel_res.json(), {"status": "cancelled"})
            mock_cancel.assert_called_once()
            self.assertIsNone(session_manager.get_session_id())

    def test_pause_and_resume_endpoints(self):
        with patch.object(audio_service, "start", return_value="fake_meeting.wav"), \
             patch.object(audio_service, "pause") as mock_pause, \
             patch.object(audio_service, "resume") as mock_resume, \
             patch.object(audio_service, "cancel"):

            # Iniciar grabación
            self.client.post("/recording/start")
            audio_service._recording = True
            audio_service._paused = False

            # Pausar
            pause_res = self.client.post("/recording/pause")
            self.assertEqual(pause_res.status_code, 200)
            self.assertEqual(pause_res.json(), {"status": "paused"})
            mock_pause.assert_called_once()
            audio_service._paused = True

            # Reanudar
            resume_res = self.client.post("/recording/resume")
            self.assertEqual(resume_res.status_code, 200)
            self.assertEqual(resume_res.json(), {"status": "recording"})
            mock_resume.assert_called_once()

            audio_service._recording = False
            audio_service._paused = False

    def test_stop_endpoint_returns_live_transcript(self):
        with patch.object(audio_service, "start", return_value="fake_meeting.wav"), \
             patch.object(audio_service, "stop", return_value="fake_meeting.mp3"):

            start_res = self.client.post("/recording/start")
            self.assertEqual(start_res.status_code, 200)
            audio_service._recording = True

            stop_res = self.client.post("/recording/stop")
            self.assertEqual(stop_res.status_code, 200)
            data = stop_res.json()
            self.assertEqual(data["status"], "stopped")
            self.assertIn("live_transcript", data)
            self.assertEqual(data["audio_path"], "fake_meeting.mp3")

    def test_sse_generator_direct(self):
        async def run_sse_test():
            mock_request = MagicMock()
            mock_request.is_disconnected = AsyncMock(side_effect=[False, True])

            mock_service = LiveTranscriptionService(model_name="tiny")
            mock_service._confirmed_segments = [
                {"seq": 1, "start": 0.0, "end": 2.0, "text": "Hola mundo", "words": []}
            ]

            response = await sse_live_transcription(
                request=mock_request,
                session_id="test_sse_direct",
                live_transcriber=mock_service,
                session=session_manager
            )

            chunks = []
            async for chunk in response.body_iterator:
                chunks.append(chunk)
                if len(chunks) >= 1:
                    break

            self.assertTrue(len(chunks) > 0)
            self.assertIn('"event": "init"', chunks[0])
            self.assertIn("Hola mundo", chunks[0])

        asyncio.run(run_sse_test())


if __name__ == "__main__":
    unittest.main()
