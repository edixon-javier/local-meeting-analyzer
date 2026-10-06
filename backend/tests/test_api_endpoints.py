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

    def test_get_ollama_models_endpoint(self):
        response = self.client.get("/status/ollama-models")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("models", data)
        self.assertIsInstance(data["models"], list)
        self.assertGreater(len(data["models"]), 0)

        # Segundo llamado inmediato debe responder desde caché en tiempo prácticamente nulo
        cached_response = self.client.get("/status/ollama-models")
        self.assertEqual(cached_response.status_code, 200)
        self.assertEqual(cached_response.json(), data)

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

    def test_chat_history_with_unanalyzed_meeting_handles_null_analysis(self):
        recordings_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "recordings")
        os.makedirs(recordings_dir, exist_ok=True)
        test_filename = "test_meeting_null_analysis.wav"
        test_audio_path = os.path.join(recordings_dir, test_filename)
        test_json_path = os.path.join(recordings_dir, "test_meeting_null_analysis.json")

        with open(test_audio_path, "wb") as f:
            f.write(b"RIFFdummy_audio")
        with open(test_json_path, "w", encoding="utf-8") as f:
            json.dump({
                "audio_path": test_audio_path,
                "transcript": "Discusión sobre la arquitectura del sistema y el presupuesto",
                "analysis": None,
                "bookmarks": []
            }, f)

        try:
            res = self.client.post("/chat/history", json={
                "messages": [],
                "question": "¿Qué hablamos sobre arquitectura?"
            })
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertEqual(data["status"], "done")
        finally:
            if os.path.exists(test_audio_path):
                os.remove(test_audio_path)
            if os.path.exists(test_json_path):
                os.remove(test_json_path)

    def test_live_bookmark_session_endpoints(self):
        # 1. Agregar marcador en sesión en vivo
        res = self.client.post("/recording/bookmark", json={"time": 45.2, "note": "Acuerdo de entregables"})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "ok")
        bm = data["bookmark"]
        self.assertEqual(bm["time"], 45.2)
        self.assertEqual(bm["note"], "Acuerdo de entregables")
        bm_id = bm["id"]

        # 2. Consultar marcadores activos
        list_res = self.client.get("/recording/bookmarks")
        self.assertEqual(list_res.status_code, 200)
        bookmarks = list_res.json()["bookmarks"]
        self.assertTrue(any(b["id"] == bm_id for b in bookmarks))

        # 3. Eliminar marcador
        del_res = self.client.delete(f"/recording/bookmarks/{bm_id}")
        self.assertEqual(del_res.status_code, 200)
        remaining = del_res.json()["bookmarks"]
        self.assertFalse(any(b["id"] == bm_id for b in remaining))

    def test_recording_bookmark_metadata_endpoints(self):
        recordings_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "recordings")
        os.makedirs(recordings_dir, exist_ok=True)
        test_filename = "test_meeting_for_bookmarks.wav"
        test_audio_path = os.path.join(recordings_dir, test_filename)
        test_json_path = os.path.join(recordings_dir, "test_meeting_for_bookmarks.json")

        with open(test_audio_path, "wb") as f:
            f.write(b"RIFFfake_audio")
        with open(test_json_path, "w", encoding="utf-8") as f:
            json.dump({"transcript": "Texto de prueba", "bookmarks": []}, f)

        try:
            # 1. Agregar bookmark a reunión guardada
            add_res = self.client.post(
                f"/recordings/{test_filename}/bookmarks",
                json={"time": 125.0, "note": "Decisión de lanzamiento"}
            )
            self.assertEqual(add_res.status_code, 200)
            data = add_res.json()
            bookmarks = data["bookmarks"]
            self.assertEqual(len(bookmarks), 1)
            self.assertEqual(bookmarks[0]["note"], "Decisión de lanzamiento")
            bm_id = bookmarks[0]["id"]

            # 2. Verificar que se incluye en list_recordings
            list_res = self.client.get("/recordings/")
            self.assertEqual(list_res.status_code, 200)
            recs = list_res.json()["recordings"]
            target = next((r for r in recs if r["filename"] == test_filename), None)
            self.assertIsNotNone(target)
            self.assertEqual(target.get("bookmarks_count"), 1)

            # 3. Eliminar bookmark
            del_res = self.client.delete(f"/recordings/{test_filename}/bookmarks/{bm_id}")
            self.assertEqual(del_res.status_code, 200)
            bookmarks_after = del_res.json()["bookmarks"]
            self.assertEqual(len(bookmarks_after), 0)
        finally:
            if os.path.exists(test_audio_path):
                os.remove(test_audio_path)
            if os.path.exists(test_json_path):
                os.remove(test_json_path)

    def test_format_bookmarks_instruction(self):
        from services.analysis_service import format_bookmarks_instruction
        bms = [
            {"time": 65.0, "note": "Revisión presupuesto"},
            {"time": 12.5, "note": ""}
        ]
        instruction = format_bookmarks_instruction(bms)
        self.assertIn("MOMENTOS CLAVE MARCADOS", instruction)
        self.assertIn("[01:05] Revisión presupuesto", instruction)
        self.assertIn("[00:12] Momento relevante marcado", instruction)

    def test_test_ai_connection_invalid_provider(self):
        response = self.client.post("/status/test-ai", json={"provider": "invalid_provider"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("Proveedor desconocido", response.json()["detail"])

    def test_test_ai_connection_openai_missing_key(self):
        with patch.object(system_config, "get", return_value=""):
            response = self.client.post("/status/test-ai", json={"provider": "openai", "api_key": ""})
            self.assertEqual(response.status_code, 400)
            self.assertIn("API de OpenAI", response.json()["detail"])

    def test_test_ai_connection_openai_mock_success(self):
        with patch("openai.OpenAI") as mock_openai_cls:
            mock_client = mock_openai_cls.return_value
            mock_client.chat.completions.create.return_value = {
                "choices": [{"message": {"content": "pong"}}]
            }
            response = self.client.post(
                "/status/test-ai",
                json={"provider": "openai", "api_key": "sk-test-key-mock", "model": "gpt-4o-mini"}
            )
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertEqual(data["status"], "ok")
            self.assertEqual(data["provider"], "openai")
            self.assertEqual(data["model"], "gpt-4o-mini")
            self.assertIn("latency_ms", data)
            self.assertGreaterEqual(data["latency_ms"], 1)

    def test_test_ai_connection_ollama_mock_offline(self):
        import requests
        with patch("requests.get", side_effect=requests.exceptions.ConnectionError("Connection refused")):
            response = self.client.post("/status/test-ai", json={"provider": "local", "model": "phi3"})
            self.assertEqual(response.status_code, 503)
            self.assertIn("Ollama no está en ejecución", response.json()["detail"])

    def test_test_ai_connection_ollama_mock_success(self):
        from unittest.mock import MagicMock
        mock_tags = MagicMock()
        mock_tags.status_code = 200
        mock_tags.json.return_value = {"models": [{"name": "phi3:latest"}]}

        mock_gen = MagicMock()
        mock_gen.status_code = 200
        mock_gen.json.return_value = {"response": "pong"}

        with patch("requests.get", return_value=mock_tags), patch("requests.post", return_value=mock_gen):
            response = self.client.post("/status/test-ai", json={"provider": "local", "model": "phi3"})
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertEqual(data["status"], "ok")
            self.assertEqual(data["provider"], "local")
            self.assertEqual(data["model"], "phi3")
            self.assertIn("latency_ms", data)

    def test_update_meeting_task_status_lifecycle(self):
        recordings_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "recordings")
        os.makedirs(recordings_dir, exist_ok=True)
        test_filename = "test_meeting_for_task_status.wav"
        test_audio_path = os.path.join(recordings_dir, test_filename)
        test_json_path = os.path.join(recordings_dir, "test_meeting_for_task_status.json")

        with open(test_audio_path, "wb") as f:
            f.write(b"RIFFdummy_audio_tasks")
        with open(test_json_path, "w", encoding="utf-8") as f:
            json.dump({
                "audio_path": test_audio_path,
                "transcript": "Discusión de tareas y compromisos",
                "analysis": {
                    "summary": ["Resumen"],
                    "action_items": [
                        {"task": "Preparar informe trimestral", "assignee": "Carlos", "deadline": "Viernes", "completed": False},
                        {"task": "Enviar contrato a cliente", "assignee": "Ana", "deadline": "Lunes"}
                    ],
                    "category": "Operaciones",
                    "tone": "Formal"
                }
            }, f)

        try:
            # 1. Marcar primera tarea como completada (completed=True)
            res1 = self.client.patch(f"/recordings/{test_filename}/tasks/0", json={"completed": True})
            self.assertEqual(res1.status_code, 200)
            data1 = res1.json()
            self.assertEqual(data1["status"], "ok")
            items1 = data1["action_items"]
            self.assertTrue(items1[0]["completed"])
            self.assertFalse(items1[1].get("completed", False))

            # 2. Desmarcar la tarea (completed=False)
            res2 = self.client.patch(f"/recordings/{test_filename}/tasks/0", json={"completed": False})
            self.assertEqual(res2.status_code, 200)
            items2 = res2.json()["action_items"]
            self.assertFalse(items2[0]["completed"])

            # 3. Índice fuera de rango debe retornar 400
            res3 = self.client.patch(f"/recordings/{test_filename}/tasks/99", json={"completed": True})
            self.assertEqual(res3.status_code, 400)

            # 4. Archivo inexistente debe retornar 404
            res4 = self.client.patch("/recordings/non_existent_meeting_123.wav/tasks/0", json={"completed": True})
            self.assertEqual(res4.status_code, 404)
        finally:
            if os.path.exists(test_audio_path):
                os.remove(test_audio_path)
            if os.path.exists(test_json_path):
                os.remove(test_json_path)


if __name__ == "__main__":
    unittest.main()

