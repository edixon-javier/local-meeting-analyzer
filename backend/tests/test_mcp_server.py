"""
tests/test_mcp_server.py
Pruebas unitarias para las herramientas y recursos del servidor MCP.
"""

import os
import sys
import unittest
import tempfile
import json
import shutil

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from tests import _testenv  # noqa: F401
from core.paths import get_recordings_dir
import mcp_server


class TestMCPServer(unittest.TestCase):
    def setUp(self):
        self.recordings_dir = get_recordings_dir()
        self.test_audio_path = os.path.join(self.recordings_dir, "mcp_test_meeting.wav")
        self.test_json_path = os.path.join(self.recordings_dir, "mcp_test_meeting.json")

        # Crear archivo de audio dummy
        with open(self.test_audio_path, "wb") as f:
            f.write(b"RIFFdummydataWAVEfmt ")

        # Crear metadatos de prueba
        self.sample_metadata = {
            "filename": "mcp_test_meeting.wav",
            "audio_path": self.test_audio_path,
            "created": 1700000000.0,
            "transcript": "Hola a todos, hoy revisaremos el presupuesto de marketing para Q4 con Carlos.",
            "segments": [
                {"speaker": "Hablante A", "start": 0.0, "end": 4.5, "text": "Hola a todos."},
                {"speaker": "Carlos", "start": 5.0, "end": 10.0, "text": "Revisaremos el presupuesto de marketing para Q4."}
            ],
            "bookmarks": [
                {"id": "bm-1", "time": 5.0, "note": "Inicio revisión presupuesto"}
            ],
            "analysis": {
                "category": "Finanzas",
                "tone": "Formal y estratégico",
                "duration_insight": "Reunión breve y concisa.",
                "summary": [
                    "Se presentó la propuesta preliminar de presupuesto para Q4.",
                    "Carlos liderará la ejecución del plan."
                ],
                "key_decisions": [
                    "Aprobar el incremento del 15% para el canal digital."
                ],
                "action_items": [
                    {
                        "task": "Enviar reporte consolidado de gastos",
                        "assignee": "Carlos",
                        "deadline": "Viernes 18:00",
                        "completed": False
                    },
                    {
                        "task": "Firmar acta de aprobación",
                        "assignee": "Dirección",
                        "deadline": "Lunes",
                        "completed": True
                    }
                ]
            }
        }

        with open(self.test_json_path, "w", encoding="utf-8") as f:
            json.dump(self.sample_metadata, f, ensure_ascii=False, indent=2)

    def tearDown(self):
        if os.path.exists(self.test_audio_path):
            os.remove(self.test_audio_path)
        if os.path.exists(self.test_json_path):
            os.remove(self.test_json_path)

    def test_list_meetings(self):
        meetings = mcp_server.list_meetings()
        self.assertIsInstance(meetings, list)
        found = next((m for m in meetings if m["filename"] == "mcp_test_meeting.wav"), None)
        self.assertIsNotNone(found)
        self.assertTrue(found["has_metadata"])
        self.assertEqual(found["category"], "Finanzas")
        self.assertEqual(found["tone"], "Formal y estratégico")
        self.assertIn("presupuesto", found["summary_preview"].lower())
        self.assertEqual(found["bookmarks_count"], 1)
        self.assertEqual(found["tasks_count"], 2)
        self.assertEqual(found["pending_tasks_count"], 1)

    def test_get_meeting_summary_by_wav(self):
        summary = mcp_server.get_meeting_summary("mcp_test_meeting.wav")
        self.assertNotIn("error", summary)
        self.assertEqual(summary["category"], "Finanzas")
        self.assertEqual(len(summary["summary"]), 2)
        self.assertEqual(len(summary["key_decisions"]), 1)
        self.assertEqual(len(summary["action_items"]), 2)
        self.assertEqual(len(summary["bookmarks"]), 1)

    def test_get_meeting_summary_by_json(self):
        summary = mcp_server.get_meeting_summary("mcp_test_meeting.json")
        self.assertNotIn("error", summary)
        self.assertEqual(summary["category"], "Finanzas")

    def test_get_meeting_summary_not_found(self):
        summary = mcp_server.get_meeting_summary("non_existent_meeting_123.wav")
        self.assertIn("error", summary)

    def test_get_meeting_transcript(self):
        data = mcp_server.get_meeting_transcript("mcp_test_meeting.wav", include_segments=True)
        self.assertNotIn("error", data)
        self.assertIn("presupuesto de marketing", data["transcript"])
        self.assertIn("segments", data)
        self.assertEqual(len(data["segments"]), 2)
        self.assertEqual(data["segments"][1]["speaker"], "Carlos")

    def test_get_all_action_items(self):
        all_tasks = mcp_server.get_all_action_items()
        self.assertGreaterEqual(len(all_tasks), 2)
        target_tasks = [t for t in all_tasks if t["meeting_filename"] == "mcp_test_meeting.wav"]
        self.assertEqual(len(target_tasks), 2)

        # Filtrar solo pendientes
        pending = mcp_server.get_all_action_items(filter_completed=False)
        target_pending = [t for t in pending if t["meeting_filename"] == "mcp_test_meeting.wav"]
        self.assertEqual(len(target_pending), 1)
        self.assertEqual(target_pending[0]["assignee"], "Carlos")

        # Filtrar solo completadas
        completed = mcp_server.get_all_action_items(filter_completed=True)
        target_completed = [t for t in completed if t["meeting_filename"] == "mcp_test_meeting.wav"]
        self.assertEqual(len(target_completed), 1)
        self.assertEqual(target_completed[0]["assignee"], "Dirección")

    def test_search_meetings(self):
        # Búsqueda por término en la transcripción y decisiones
        results = mcp_server.search_meetings("presupuesto digital", max_results=3)
        self.assertGreaterEqual(len(results), 1)
        top = results[0]
        self.assertEqual(top["filename"], "mcp_test_meeting.wav")
        self.assertGreater(top["score"], 0)

        # Búsqueda por término exclusivo en tareas (action_items)
        results_task = mcp_server.search_meetings("reporte consolidado", max_results=3)
        self.assertGreaterEqual(len(results_task), 1)
        self.assertEqual(results_task[0]["filename"], "mcp_test_meeting.wav")

        # Búsqueda por término exclusivo en notas de marcadores (bookmarks)
        results_bm = mcp_server.search_meetings("Inicio revisión", max_results=3)
        self.assertGreaterEqual(len(results_bm), 1)
        self.assertEqual(results_bm[0]["filename"], "mcp_test_meeting.wav")
        self.assertIn("presupuesto", top["matched_terms"])

    def test_search_meetings_no_match(self):
        results = mcp_server.search_meetings("invernadero hidroponico desconocido")
        matched = [r for r in results if r["filename"] == "mcp_test_meeting.wav"]
        self.assertEqual(len(matched), 0)

    def test_resources_markdown(self):
        md = mcp_server.meeting_summary_resource("mcp_test_meeting.wav")
        self.assertIn("# Minuta Ejecutiva: mcp_test_meeting.wav", md)
        self.assertIn("Finanzas", md)
        self.assertIn("Aprobar el incremento", md)
        self.assertIn("Enviar reporte consolidado", md)

        transcript_text = mcp_server.meeting_transcript_resource("mcp_test_meeting.wav")
        self.assertIn("presupuesto de marketing para Q4", transcript_text)


if __name__ == "__main__":
    unittest.main()
