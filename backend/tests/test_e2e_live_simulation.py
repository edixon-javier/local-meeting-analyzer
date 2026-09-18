import os
import sys
import time
import unittest
import numpy as np
import asyncio

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.live_transcription_service import LiveTranscriptionService, SAMPLE_RATE
from faster_whisper.audio import decode_audio


class TestE2ELiveSimulation(unittest.TestCase):

    def test_real_audio_streaming_simulation(self):
        """
        Simula la llegada de audio en tiempo real desde el micrófono/sistema
        alimentando fragmentos de 200 ms a LiveTranscriptionService,
        y verifica que se generen eventos parciales y confirmaciones de segmento reales.
        """
        audio_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "recordings", "meeting_20260918_120321.mp3")
        if not os.path.exists(audio_path):
            self.skipTest(f"Audio file {audio_path} not found for simulation.")

        # Cargar los primeros 8 segundos de audio real (con habla en español)
        audio_data = decode_audio(audio_path, sampling_rate=SAMPLE_RATE)
        test_samples = audio_data[int(SAMPLE_RATE * 5) : int(SAMPLE_RATE * 12)]  # 7 segundos de habla

        service = LiveTranscriptionService(model_name="tiny")
        session_id = "sim_e2e_session_001"

        # Registrar cola de eventos para capturar lo que recibiría el frontend
        received_events = []
        event_queue = asyncio.Queue()
        loop = asyncio.new_event_loop()
        service.register_listener(event_queue, loop)

        # Iniciar sesión
        service.start_session(session_id, language="es")
        self.assertTrue(service.is_active)

        # Simular llegada de fragmentos cada 200ms (3200 muestras a 16kHz)
        chunk_size = int(SAMPLE_RATE * 0.2)
        total_chunks = len(test_samples) // chunk_size

        for i in range(total_chunks):
            chunk = test_samples[i * chunk_size : (i + 1) * chunk_size]
            service.feed_audio_chunk(chunk)
            time.sleep(0.05)  # Enviar más rápido que tiempo real para agilizar la prueba

        # Enviar 1 segundo de silencio para provocar el cierre natural del segmento por VAD
        silence_chunk = np.zeros(chunk_size, dtype=np.float32)
        for _ in range(5):
            service.feed_audio_chunk(silence_chunk)
            time.sleep(0.05)

        # Detener la sesión
        final_text = service.stop_session()
        self.assertFalse(service.is_active)

        # Recoger todos los eventos del stream
        while not event_queue.empty():
            item = event_queue.get_nowait()
            received_events.append(item)

        service.unregister_listener(event_queue)
        loop.close()

        # Verificaciones
        event_types = []
        for raw in received_events:
            if "event" in raw:
                import json
                line = raw.strip()
                if line.startswith("data: "):
                    data = json.loads(line[6:])
                    event_types.append(data.get("event"))

        print(f"[E2E Simulation] Eventos generados: {event_types}")
        print(f"[E2E Simulation] Transcripción confirmada: '{final_text}'")

        self.assertIn("session_started", event_types)
        self.assertIn("final_segment", event_types)
        self.assertIn("complete", event_types)
        self.assertTrue(len(final_text.strip()) > 0)
        self.assertTrue(len(service.get_confirmed_segments()) > 0)

        # Verificar estructura de palabras en los segmentos confirmados
        first_segment = service.get_confirmed_segments()[0]
        self.assertIn("words", first_segment)
        self.assertIn("text", first_segment)
        self.assertIn("start", first_segment)
        self.assertIn("end", first_segment)
        if first_segment["words"]:
            first_word = first_segment["words"][0]
            self.assertIn("word", first_word)
            self.assertIn("start", first_word)
            self.assertIn("end", first_word)


if __name__ == "__main__":
    unittest.main()
