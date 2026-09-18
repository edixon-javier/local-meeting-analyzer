import os
import sys
import tempfile
import unittest
import json
from unittest.mock import patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app
from services.metadata_repository import MetadataRepository
from services.session_manager import session_manager


class TestSpeakerRename(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.repo = MetadataRepository()
        self.client = TestClient(app)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_repo_rename_speaker_segments_transcript_and_assignee(self):
        audio_path = os.path.join(self.temp_dir.name, "sample_meeting.mp3")
        json_path = os.path.join(self.temp_dir.name, "sample_meeting.json")

        initial_segments = [
            {"start": 0, "end": 4.5, "text": "Buenos días a todos.", "speaker": "Hablante A"},
            {"start": 5.0, "end": 9.2, "text": "¿Cómo va el sprint?", "speaker": "Hablante B"},
            {"start": 9.5, "end": 14.0, "text": "Todo en orden por aquí.", "speaker": "Hablante A"}
        ]
        initial_analysis = {
            "summary": ["Revisión del sprint."],
            "action_items": [
                {"task": "Preparar demo", "assignee": "Hablante A", "deadline": "Viernes"}
            ],
            "tone": "Colaborativo",
            "category": "Daily"
        }
        
        self.repo.save_meeting_metadata(
            audio_path=audio_path,
            transcript="Hablante A: Buenos días a todos.\n\nHablante B: ¿Cómo va el sprint?\n\nHablante A: Todo en orden por aquí.",
            analysis=initial_analysis,
            language="es",
            segments=initial_segments
        )

        updated = self.repo.rename_speaker(json_path, "Hablante A", "Carlos Mendoza")
        self.assertIsNotNone(updated)

        # Verificar segmentos actualizados
        self.assertEqual(updated["segments"][0]["speaker"], "Carlos Mendoza")
        self.assertEqual(updated["segments"][1]["speaker"], "Hablante B")
        self.assertEqual(updated["segments"][2]["speaker"], "Carlos Mendoza")

        # Verificar transcripción actualizada
        self.assertIn("Carlos Mendoza: Buenos días a todos.", updated["transcript"])
        self.assertIn("Hablante B: ¿Cómo va el sprint?", updated["transcript"])
        self.assertNotIn("Hablante A:", updated["transcript"])

        # Verificar tareas actualizadas
        self.assertEqual(updated["analysis"]["action_items"][0]["assignee"], "Carlos Mendoza")

        # Verificar speaker_map
        self.assertEqual(updated["speaker_map"]["Hablante A"], "Carlos Mendoza")

        # Verificar persistencia recargando de disco
        reloaded = self.repo.get_metadata(json_path)
        self.assertEqual(reloaded["segments"][0]["speaker"], "Carlos Mendoza")
        self.assertIn("Carlos Mendoza: Todo en orden por aquí.", reloaded["transcript"])

    def test_api_rename_speaker_endpoint(self):
        recordings_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "recordings")
        os.makedirs(recordings_dir, exist_ok=True)

        test_audio_name = "test_rename_speaker_api.wav"
        test_audio_path = os.path.join(recordings_dir, test_audio_name)
        test_json_path = os.path.join(recordings_dir, "test_rename_speaker_api.json")

        with open(test_audio_path, "wb") as f:
            f.write(b"RIFFfake_audio")

        meta = {
            "filename": test_audio_name,
            "audio_path": test_audio_path,
            "transcript": "Hablante 1: Probando endpoint.",
            "analysis": {
                "summary": ["Test"],
                "action_items": [{"task": "Verificar API", "assignee": "Hablante 1", "deadline": "Hoy"}]
            },
            "segments": [
                {"start": 0, "end": 2.0, "text": "Probando endpoint.", "speaker": "Hablante 1"}
            ]
        }
        with open(test_json_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False)

        try:
            # Invocar endpoint
            response = self.client.post(
                f"/recordings/{test_audio_name}/rename-speaker",
                json={"old_speaker": "Hablante 1", "new_speaker": "Ana Gomez"}
            )
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertEqual(data["status"], "updated")
            self.assertEqual(data["old_speaker"], "Hablante 1")
            self.assertEqual(data["new_speaker"], "Ana Gomez")
            self.assertEqual(data["metadata"]["segments"][0]["speaker"], "Ana Gomez")
            self.assertEqual(data["metadata"]["analysis"]["action_items"][0]["assignee"], "Ana Gomez")

            # Intentar con nombre vacío
            bad_res = self.client.post(
                f"/recordings/{test_audio_name}/rename-speaker",
                json={"old_speaker": "Ana Gomez", "new_speaker": "   "}
            )
            self.assertEqual(bad_res.status_code, 400)

            # Intentar archivo inexistente
            not_found_res = self.client.post(
                "/recordings/non_existent_meeting.wav/rename-speaker",
                json={"old_speaker": "Hablante 1", "new_speaker": "Carlos"}
            )
            self.assertEqual(not_found_res.status_code, 404)

        finally:
            if os.path.exists(test_audio_path):
                os.remove(test_audio_path)
            if os.path.exists(test_json_path):
                os.remove(test_json_path)


if __name__ == "__main__":
    unittest.main()
