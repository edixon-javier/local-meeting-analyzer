import os
import sys
import tempfile
import unittest
import shutil
import json
from unittest.mock import patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app
from core.config import system_config
from services.session_manager import session_manager


class TestApiEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_get_status_endpoint(self):
        response = self.client.get("/status")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("ollama_running", data)
        self.assertIn("recording", data)
        self.assertIn("paused", data)
        self.assertIn("processing", data)
        self.assertIn("ai_provider", data)

    def test_get_and_update_config(self):
        # Read current
        get_res = self.client.get("/config")
        self.assertEqual(get_res.status_code, 200)
        current_cfg = get_res.json()
        
        # Update
        new_focus = "Revisión técnica de estabilidad"
        update_res = self.client.post("/config", json={"analysis_focus": new_focus})
        self.assertEqual(update_res.status_code, 200)
        self.assertEqual(update_res.json()["config"]["analysis_focus"], new_focus)

        # Revert back to original
        self.client.post("/config", json={"analysis_focus": current_cfg.get("analysis_focus", "")})

    def test_cancel_processing_endpoint(self):
        session_manager.set_processing(True)
        self.assertTrue(session_manager.is_processing())

        response = self.client.post("/processing/cancel")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "cancelled"})
        self.assertFalse(session_manager.is_processing())

    def test_upload_and_list_recording(self):
        recordings_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "recordings")
        os.makedirs(recordings_dir, exist_ok=True)
        
        test_filename = "test_upload_audio_sample.wav"
        test_content = b"RIFFfake_wav_data_for_api_test"

        # Test upload
        response = self.client.post(
            "/recordings/upload",
            files={"file": (test_filename, test_content, "audio/wav")}
        )
        self.assertEqual(response.status_code, 200)
        uploaded_info = response.json()
        self.assertEqual(uploaded_info["status"], "uploaded")
        actual_name = uploaded_info["filename"]
        actual_path = uploaded_info["path"]

        try:
            # Test listing
            list_res = self.client.get("/recordings/")
            self.assertEqual(list_res.status_code, 200)
            recordings = list_res.json().get("recordings", [])
            filenames = [r["filename"] for r in recordings]
            self.assertIn(actual_name, filenames)

            # Test renaming
            new_title = "test_renamed_audio_sample"
            rename_res = self.client.post(
                f"/recordings/{actual_name}/rename",
                json={"new_name": new_title}
            )
            self.assertEqual(rename_res.status_code, 200)
            renamed_name = rename_res.json()["new_filename"]
            self.assertTrue(renamed_name.endswith(".wav"))
            
            # Delete renamed file
            del_res = self.client.delete(f"/recordings/{renamed_name}")
            self.assertEqual(del_res.status_code, 200)
        finally:
            if os.path.exists(actual_path):
                os.remove(actual_path)

    def test_upload_invalid_file_extension(self):
        response = self.client.post(
            "/recordings/upload",
            files={"file": ("virus.exe", b"dangerous bytes", "application/x-msdownload")}
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("no soportado", response.json()["detail"])

    def test_path_traversal_prevention_on_audio_and_metadata(self):
        # Audio endpoint rejects path outside recordings dir
        audio_traversal = self.client.get("/recordings/audio", params={"path": "../../forbidden.wav"})
        self.assertIn(audio_traversal.status_code, [400, 403])

        # Metadata endpoint rejects path outside recordings dir
        meta_traversal = self.client.get("/recordings/metadata", params={"path": "../../secret.json"})
        self.assertEqual(meta_traversal.status_code, 403)

    def test_invalid_recording_actions_return_400(self):
        # Stopping when no active recording
        stop_res = self.client.post("/recording/stop")
        self.assertEqual(stop_res.status_code, 400)
        self.assertIn("No hay ninguna grabación activa", stop_res.json()["detail"])

        # Pausing when no active recording
        pause_res = self.client.post("/recording/pause")
        self.assertEqual(pause_res.status_code, 400)
        self.assertIn("No hay una grabación activa", pause_res.json()["detail"])

        # Resuming when no active recording
        resume_res = self.client.post("/recording/resume")
        self.assertEqual(resume_res.status_code, 400)
        self.assertIn("No hay una grabación activa", resume_res.json()["detail"])

    def test_analyze_empty_transcript_generates_safe_dummy(self):
        res = self.client.post("/analyze", json={"transcript": "   "})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "empty")
        self.assertEqual(data["analysis"]["category"], "Vacía")
        self.assertEqual(data["analysis"]["tone"], "Silencioso")

    def test_chat_history_with_empty_or_no_meetings(self):
        res = self.client.post("/chat/history", json={
            "messages": [],
            "question": "¿De qué hablamos en la reunión de ventas?"
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "done")
        self.assertIn("response", data)


if __name__ == "__main__":
    unittest.main()
