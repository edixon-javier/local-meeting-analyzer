import os
import sys
import tempfile
import unittest
import shutil
import json
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from tests import _testenv  # noqa: F401  (aísla config.json y grabaciones en una carpeta temporal)
from core.paths import get_recordings_dir

from fastapi.testclient import TestClient
from main import app
from core.config import system_config
from services.session_manager import session_manager
from api.routers.system import _analyzer_instance


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
        recordings_dir = get_recordings_dir()
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
        recordings_dir = get_recordings_dir()
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
            # Se simula solo la llamada al LLM: la prueba valida el manejo de analysis=None
            # sin depender de una API key real ni de Ollama.
            with patch.object(_analyzer_instance, "chat_with_history", return_value="Respuesta simulada"):
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

    def test_chat_history_with_none_created_and_none_transcript(self):
        recordings_dir = get_recordings_dir()
        os.makedirs(recordings_dir, exist_ok=True)
        test_filename = "test_meeting_none_fields.wav"
        test_audio_path = os.path.join(recordings_dir, test_filename)
        test_json_path = os.path.join(recordings_dir, "test_meeting_none_fields.json")

        with open(test_audio_path, "wb") as f:
            f.write(b"RIFFdummy_audio")
        with open(test_json_path, "w", encoding="utf-8") as f:
            json.dump({
                "audio_path": test_audio_path,
                "transcript": None,
                "created": None,
                "analysis": {
                    "summary": ["Resumen de prueba"],
                    "action_items": ["Tarea sin completar"],
                    "category": "Estrategia",
                    "tone": "Neutro"
                },
                "bookmarks": None
            }, f)

        try:
            with patch.object(_analyzer_instance, "chat_with_history", return_value="Respuesta de respaldo"):
                # 1. Consulta sin términos que coincidan para forzar el fallback de ordenación por fecha
                res_fallback = self.client.post("/chat/history", json={
                    "messages": [],
                    "question": "¿Hola qué tal?"
                })
                self.assertEqual(res_fallback.status_code, 200)
                data_fb = res_fallback.json()
                self.assertEqual(data_fb["status"], "done")
                self.assertEqual(data_fb["response"], "Respuesta de respaldo")

                # 2. Consulta que coincida con la tarea del análisis (a pesar de transcript=None)
                res_task = self.client.post("/chat/history", json={
                    "messages": [],
                    "question": "¿Qué tarea tenemos pendiente?"
                })
                self.assertEqual(res_task.status_code, 200)
                data_task = res_task.json()
                self.assertEqual(data_task["status"], "done")
                self.assertTrue(len(data_task["referenced_meetings"]) > 0)
                self.assertEqual(data_task["referenced_meetings"][0]["action_items_count"], 1)
                self.assertEqual(data_task["referenced_meetings"][0]["pending_tasks_count"], 1)
        finally:
            if os.path.exists(test_audio_path):
                os.remove(test_audio_path)
            if os.path.exists(test_json_path):
                os.remove(test_json_path)

    def test_chat_history_indexes_tasks_and_bookmarks(self):
        recordings_dir = get_recordings_dir()
        os.makedirs(recordings_dir, exist_ok=True)
        test_filename = "test_meeting_tasks_rag.wav"
        test_audio_path = os.path.join(recordings_dir, test_filename)
        test_json_path = os.path.join(recordings_dir, "test_meeting_tasks_rag.json")

        with open(test_audio_path, "wb") as f:
            f.write(b"RIFFdummy_audio")
        with open(test_json_path, "w", encoding="utf-8") as f:
            json.dump({
                "filename": test_filename,
                "audio_path": test_audio_path,
                "transcript": "Reunión de sincronización de equipo.",
                "analysis": {
                    "category": "Sincronización",
                    "tone": "Colaborativo",
                    "summary": ["Revisión del sprint"],
                    "key_decisions": ["Lanzamiento pospuesto una semana"],
                    "action_items": [
                        {"task": "Actualizar el despliegue del frontend", "assignee": "Carlos", "deadline": "Viernes", "completed": False},
                        {"task": "Enviar métricas de analítica", "assignee": "Laura", "deadline": "Lunes", "completed": True}
                    ]
                },
                "bookmarks": [
                    {"time": 120.0, "note": "Discusión sobre cuellos de botella"}
                ]
            }, f)

        try:
            captured_context = {}
            def mock_chat_history(context, messages, question):
                captured_context["context"] = context
                return "Respuesta simulada con tareas"

            with patch.object(_analyzer_instance, "chat_with_history", side_effect=mock_chat_history):
                res = self.client.post("/chat/history", json={
                    "messages": [],
                    "question": "¿Quién tiene asignado el despliegue?"
                })

            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertEqual(data["status"], "done")
            self.assertEqual(data["response"], "Respuesta simulada con tareas")
            self.assertTrue(len(data["referenced_meetings"]) > 0)
            ref = data["referenced_meetings"][0]
            self.assertEqual(ref["action_items_count"], 2)
            self.assertEqual(ref["pending_tasks_count"], 1)

            # Verificar que el contexto formateado contiene la sección de tareas y marcadores
            ctx = captured_context.get("context", "")
            self.assertIn("COMPROMISOS Y TAREAS:", ctx)
            self.assertIn("[PENDIENTE] Actualizar el despliegue del frontend", ctx)
            self.assertIn("[COMPLETADA] Enviar métricas de analítica", ctx)
            self.assertIn("MOMENTOS CLAVE:", ctx)
            self.assertIn("Discusión sobre cuellos de botella", ctx)
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
        recordings_dir = get_recordings_dir()
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
            self.assertIn("latency_ms", data)

    def test_test_ai_connection_claude_missing_key(self):
        with patch.object(system_config, "get", return_value=""):
            response = self.client.post("/status/test-ai", json={"provider": "claude", "api_key": ""})
            self.assertEqual(response.status_code, 400)
            self.assertIn("Anthropic (Claude)", response.json()["detail"])

    def test_test_ai_connection_claude_mock_success(self):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"content": [{"type": "text", "text": "pong"}]}
        with patch("requests.post", return_value=mock_resp):
            response = self.client.post(
                "/status/test-ai",
                json={"provider": "claude", "api_key": "sk-ant-test", "model": "claude-3-5-haiku-20241022"}
            )
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertEqual(data["status"], "ok")
            self.assertEqual(data["provider"], "claude")
            self.assertEqual(data["model"], "claude-3-5-haiku-20241022")
            self.assertIn("latency_ms", data)

    def test_test_ai_connection_gemini_missing_key(self):
        with patch.object(system_config, "get", return_value=""):
            response = self.client.post("/status/test-ai", json={"provider": "gemini", "api_key": ""})
            self.assertEqual(response.status_code, 400)
            self.assertIn("Google Gemini", response.json()["detail"])

    def test_test_ai_connection_gemini_mock_success(self):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "candidates": [{"content": {"parts": [{"text": "pong"}]}}]
        }
        with patch("requests.post", return_value=mock_resp):
            response = self.client.post(
                "/status/test-ai",
                json={"provider": "gemini", "api_key": "AIzaSy-test", "model": "gemini-2.0-flash"}
            )
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertEqual(data["status"], "ok")
            self.assertEqual(data["provider"], "gemini")
            self.assertEqual(data["model"], "gemini-2.0-flash")
            self.assertIn("latency_ms", data)

    def test_update_config_claude_and_gemini(self):
        res = self.client.post("/config", json={
            "ai_provider": "gemini",
            "gemini_api_key": "AIzaSySecret123",
            "gemini_model": "gemini-1.5-flash",
            "anthropic_api_key": "sk-ant-Secret456",
            "claude_model": "claude-3-5-sonnet-20241022"
        })
        self.assertEqual(res.status_code, 200)
        cfg = res.json()["config"]
        self.assertEqual(cfg["ai_provider"], "gemini")
        self.assertTrue(cfg["has_gemini_key"])
        self.assertTrue(cfg["has_claude_key"])
        self.assertTrue(cfg["gemini_api_key"].startswith("••••••••"))
        self.assertTrue(cfg["anthropic_api_key"].startswith("••••••••"))
        # Restaurar a local
        self.client.post("/config", json={"ai_provider": "local"})

    def test_update_meeting_task_status_lifecycle(self):
        recordings_dir = get_recordings_dir()
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

    def test_update_meeting_string_task_converts_to_dict(self):
        recordings_dir = get_recordings_dir()
        os.makedirs(recordings_dir, exist_ok=True)
        test_filename = "test_meeting_string_task_update.wav"
        test_audio_path = os.path.join(recordings_dir, test_filename)
        test_json_path = os.path.join(recordings_dir, "test_meeting_string_task_update.json")

        with open(test_audio_path, "wb") as f:
            f.write(b"RIFFdummy_audio_tasks")
        with open(test_json_path, "w", encoding="utf-8") as f:
            json.dump({
                "audio_path": test_audio_path,
                "transcript": "Discusión con tareas en formato string",
                "analysis": {
                    "summary": ["Resumen"],
                    "action_items": ["Tarea escrita en string plano"]
                }
            }, f)

        try:
            res = self.client.patch(f"/recordings/{test_filename}/tasks/0", json={"completed": True})
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertEqual(data["status"], "ok")
            item = data["action_items"][0]
            self.assertIsInstance(item, dict)
            self.assertEqual(item["task"], "Tarea escrita en string plano")
            self.assertTrue(item["completed"])
        finally:
            if os.path.exists(test_audio_path):
                os.remove(test_audio_path)
            if os.path.exists(test_json_path):
                os.remove(test_json_path)

    def test_get_audio_file_download_and_stream(self):
        recordings_dir = get_recordings_dir()
        os.makedirs(recordings_dir, exist_ok=True)
        test_filename = "test_audio_download.wav"
        test_audio_path = os.path.join(recordings_dir, test_filename)

        with open(test_audio_path, "wb") as f:
            f.write(b"RIFFdummybytesWAVEfmt ")

        try:
            # 1. Reproducción en streaming (inline) con ruta absoluta
            res_stream = self.client.get(f"/recordings/audio?path={test_audio_path}")
            self.assertEqual(res_stream.status_code, 200)
            self.assertEqual(res_stream.headers.get("content-type"), "audio/wav")
            self.assertNotIn("attachment", res_stream.headers.get("content-disposition", ""))

            # 2. Descarga (attachment) con nombre de archivo relativo
            res_download = self.client.get(f"/recordings/audio?path={test_filename}&download=true")
            self.assertEqual(res_download.status_code, 200)
            disp = res_download.headers.get("content-disposition", "")
            self.assertIn("attachment", disp)
            self.assertIn(test_filename, disp)

            # 3. Descarga con filename personalizado
            custom_name = "mi_reunion_exportada.wav"
            res_custom = self.client.get(f"/recordings/audio?path={test_filename}&download=true&filename={custom_name}")
            self.assertEqual(res_custom.status_code, 200)
            disp_custom = res_custom.headers.get("content-disposition", "")
            self.assertIn(custom_name, disp_custom)

            # 4. Seguridad: ruta fuera de recordings debe retornar 403
            res_unsafe = self.client.get("/recordings/audio?path=../../outside.wav")
            self.assertEqual(res_unsafe.status_code, 403)
        finally:
            if os.path.exists(test_audio_path):
                os.remove(test_audio_path)

    def test_chat_history_with_segments_and_multiturn(self):
        recordings_dir = get_recordings_dir()
        os.makedirs(recordings_dir, exist_ok=True)
        test_filename = "test_meeting_segments.wav"
        test_audio_path = os.path.join(recordings_dir, test_filename)
        test_json_path = os.path.join(recordings_dir, "test_meeting_segments.json")

        with open(test_audio_path, "wb") as f:
            f.write(b"RIFFdummy_audio")
        with open(test_json_path, "w", encoding="utf-8") as f:
            json.dump({
                "audio_path": test_audio_path,
                "transcript": "Ana y Carlos hablaron del nuevo servidor",
                "created": 1700000000.0,
                "segments": [
                    {"start": 75.0, "end": 80.0, "speaker": "Carlos", "text": "El servidor estara listo el viernes"},
                    {"start": 120.0, "end": 125.0, "speaker": "Ana", "text": "Aprobamos el nuevo presupuesto del servidor"}
                ],
                "analysis": {
                    "summary": ["Despliegue del nuevo servidor"],
                    "key_decisions": ["Se aprueba el servidor"],
                    "action_items": [{"task": "Configurar servidor", "assignee": "Carlos", "deadline": "Viernes", "completed": False}],
                    "category": "Infraestructura",
                    "tone": "Técnico"
                },
                "bookmarks": []
            }, f)

        try:
            with patch.object(_analyzer_instance, "chat_with_history", return_value="Carlos dijo que el servidor estara el viernes"):
                # Simular pregunta multi-turn donde la pregunta usa solo 'servidor' y aprovecha el contexto
                res = self.client.post("/chat/history", json={
                    "messages": [
                        {"role": "user", "content": "¿Quién habló sobre infraestructura en la reunión?"},
                        {"role": "assistant", "content": "Se discutió la infraestructura tecnológica."}
                    ],
                    "question": "¿Qué dijo Carlos sobre el servidor?"
                })
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertEqual(data["status"], "done")
            refs = data.get("referenced_meetings", [])
            self.assertTrue(len(refs) > 0)
            # Validar que los snippets contienen el formato [MM:SS] Carlos: ...
            snippets = refs[0].get("snippets", [])
            self.assertTrue(len(snippets) > 0)
            self.assertTrue(any("Carlos" in s and "[01:15]" in s for s in snippets))
        finally:
            if os.path.exists(test_audio_path):
                os.remove(test_audio_path)
            if os.path.exists(test_json_path):
                os.remove(test_json_path)

    def test_chat_meeting_with_enriched_context(self):
        recordings_dir = get_recordings_dir()
        os.makedirs(recordings_dir, exist_ok=True)
        test_filename = "test_meeting_chat_single.wav"
        test_audio_path = os.path.join(recordings_dir, test_filename)
        test_json_path = os.path.join(recordings_dir, "test_meeting_chat_single.json")

        with open(test_audio_path, "wb") as f:
            f.write(b"RIFFdummy_audio")
        with open(test_json_path, "w", encoding="utf-8") as f:
            json.dump({
                "audio_path": test_audio_path,
                "transcript": "Discusión sobre la fecha de entrega del proyecto",
                "created": 1700000000.0,
                "segments": [
                    {"start": 65.0, "end": 70.0, "speaker": "Elena", "text": "La entrega final sera el 15 de noviembre"}
                ],
                "analysis": {
                    "summary": ["Definición de fecha de entrega"],
                    "key_decisions": ["Entrega fijada para el 15 de noviembre"],
                    "action_items": [{"task": "Subir código", "assignee": "Elena", "deadline": "15 nov", "completed": False}],
                    "category": "Planificación",
                    "tone": "Formal"
                },
                "bookmarks": [{"time": 65.0, "note": "Definición de fecha"}]
            }, f)

        try:
            captured_context = []
            def fake_chat(context, messages, question):
                captured_context.append(context)
                return "La entrega es el 15 de noviembre"

            with patch.object(_analyzer_instance, "chat_with_transcript", side_effect=fake_chat):
                res = self.client.post("/chat", json={
                    "audio_path": test_audio_path,
                    "messages": [],
                    "question": "¿Cuándo es la entrega?"
                })

            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertEqual(data["status"], "done")
            self.assertIn("15 de noviembre", data["response"])

            # Validar que el contexto inyectado al modelo incluye metadatos y timestamps
            self.assertTrue(len(captured_context) > 0)
            c = captured_context[0]
            self.assertIn("REUNIÓN:", c)
            self.assertIn("RESUMEN REGISTRADO:", c)
            self.assertIn("DECISIONES CLAVE:", c)
            self.assertIn("COMPROMISOS Y TAREAS:", c)
            self.assertIn("[01:05] Elena: La entrega final sera el 15 de noviembre", c)
        finally:
            if os.path.exists(test_audio_path):
                os.remove(test_audio_path)
            if os.path.exists(test_json_path):
                os.remove(test_json_path)

    def test_chat_meeting_without_transcript_returns_400(self):
        res = self.client.post("/chat", json={
            "audio_path": "non_existent_audio.wav",
            "messages": [],
            "question": "¿De qué hablaron?"
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn("No se encontró la transcripción", res.json()["detail"])

    def test_chat_meeting_stream_emits_sse_events(self):
        recordings_dir = get_recordings_dir()
        test_filename = "test_meeting_chat_stream.wav"
        test_audio_path = os.path.join(recordings_dir, test_filename)
        test_json_path = os.path.join(recordings_dir, "test_meeting_chat_stream.json")

        with open(test_audio_path, "wb") as f:
            f.write(b"RIFFdummydata")

        with open(test_json_path, "w", encoding="utf-8") as f:
            json.dump({
                "filename": test_filename,
                "audio_path": test_audio_path,
                "transcript": "Transcripción de prueba para streaming",
                "analysis": {"category": "Demo"}
            }, f)

        try:
            def fake_stream(context, messages, question):
                yield "Hola "
                yield "mundo"

            with patch.object(_analyzer_instance, "stream_chat_with_transcript", side_effect=fake_stream):
                res = self.client.post("/chat/stream", json={
                    "audio_path": test_audio_path,
                    "messages": [],
                    "question": "¿Qué dijeron?"
                })

            self.assertEqual(res.status_code, 200)
            self.assertIn("text/event-stream", res.headers.get("content-type", ""))
            body = res.text
            self.assertIn("data: ", body)
            self.assertIn("Hola ", body)
            self.assertIn("mundo", body)
            self.assertIn('"done": true', body)
        finally:
            if os.path.exists(test_audio_path):
                os.remove(test_audio_path)
            if os.path.exists(test_json_path):
                os.remove(test_json_path)

    def test_chat_history_stream_emits_sse_events(self):
        def fake_stream_history(context, messages, question):
            yield "Respuesta "
            yield "historial"

        with patch.object(_analyzer_instance, "stream_chat_with_history", side_effect=fake_stream_history):
            res = self.client.post("/chat/history/stream", json={
                "messages": [],
                "question": "¿Qué tareas hay?"
            })

        self.assertEqual(res.status_code, 200)
        self.assertIn("text/event-stream", res.headers.get("content-type", ""))
        body = res.text
        self.assertIn("data: ", body)
        self.assertIn('"done": true', body)

    def test_grounding_score_calculation(self):
        from api.routers.analysis import _compute_meeting_grounding, _compute_history_grounding

        # 1. Meeting grounding con timestamps -> high
        g1 = _compute_meeting_grounding("Se acordó [02:15] lanzar el producto", "Contexto de reunión producto", "¿Cuándo?")
        self.assertEqual(g1["level"], "high")
        self.assertTrue(g1["has_timestamps"])
        self.assertIn("timestamp", g1["label"])

        # 2. Meeting grounding con negación -> unmentioned
        g2 = _compute_meeting_grounding("No se menciona el presupuesto en la reunión", "Contexto", "¿Presupuesto?")
        self.assertEqual(g2["level"], "unmentioned")

        # 3. History grounding con fragmentos verificados -> high
        g3 = _compute_history_grounding("El producto se lanza el viernes", [{"filename": "reunion1.wav", "snippets": ["lanza el viernes"]}], "¿Fecha?")
        self.assertEqual(g3["level"], "high")
        self.assertIn("Alta concordancia", g3["label"])

        # 4. History grounding con negación -> unmentioned
        g4 = _compute_history_grounding("No encontré información sobre marketing", [{"filename": "reunion1.wav", "snippets": []}], "¿Marketing?")
        self.assertEqual(g4["level"], "unmentioned")


if __name__ == "__main__":
    unittest.main()

