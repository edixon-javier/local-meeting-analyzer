"""
backend/tests/test_task_export.py
Pruebas unitarias y de integración para la exportación de compromisos e interoperabilidad
(.ics iCalendar y CSV compatible con Excel).
"""

import os
import sys
import json
import unittest
from datetime import date
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from tests import _testenv  # noqa: F401
from core.paths import get_recordings_dir
from main import app
from services.task_export_service import (
    TaskExportService,
    normalize_action_item,
    parse_deadline_date,
    escape_ics_text,
    fold_ics_line
)


class TestTaskExportService(unittest.TestCase):
    def test_normalize_action_item_dict(self):
        item = {
            "task": "Preparar demo para el cliente",
            "assignee": "María",
            "deadline": "2026-10-15",
            "completed": True
        }
        res = normalize_action_item(item, default_meeting_title="Demo Q4", default_date="2026-10-08")
        self.assertEqual(res["task"], "Preparar demo para el cliente")
        self.assertEqual(res["assignee"], "María")
        self.assertEqual(res["deadline"], "2026-10-15")
        self.assertTrue(res["completed"])
        self.assertEqual(res["meeting_title"], "Demo Q4")
        self.assertEqual(res["meeting_date"], "2026-10-08")

    def test_normalize_action_item_legacy_string(self):
        res = normalize_action_item("Revisar logs de servidor", default_meeting_title="Sync", default_date="2026-10-08")
        self.assertEqual(res["task"], "Revisar logs de servidor")
        self.assertEqual(res["assignee"], "Sin asignar")
        self.assertEqual(res["deadline"], "Sin fecha")
        self.assertFalse(res["completed"])

    def test_parse_deadline_date(self):
        # Formatos ISO
        self.assertEqual(parse_deadline_date("2026-11-20"), date(2026, 11, 20))
        self.assertEqual(parse_deadline_date("2026-10-15T14:30:00Z"), date(2026, 10, 15))
        self.assertEqual(parse_deadline_date("2026.5.4"), date(2026, 5, 4))

        # Formatos latinos con y sin ceros, con año de 2 y 4 dígitos
        self.assertEqual(parse_deadline_date("15/10/2026"), date(2026, 10, 15))
        self.assertEqual(parse_deadline_date("05-12-2026"), date(2026, 12, 5))
        self.assertEqual(parse_deadline_date("5/4/2026"), date(2026, 4, 5))
        self.assertEqual(parse_deadline_date("15/10/26"), date(2026, 10, 15))
        self.assertEqual(parse_deadline_date("15.10.2026"), date(2026, 10, 15))

        # Formatos textuales en español
        self.assertEqual(parse_deadline_date("15 de octubre de 2026"), date(2026, 10, 15))
        self.assertEqual(parse_deadline_date("15 oct 2026"), date(2026, 10, 15))
        self.assertEqual(parse_deadline_date("15 de octubre"), date(date.today().year, 10, 15))

        # Textos no reconocibles o vacíos
        self.assertIsNone(parse_deadline_date("Sin fecha"))
        self.assertIsNone(parse_deadline_date("Próximo lunes"))
        self.assertIsNone(parse_deadline_date(""))

    def test_escape_and_fold_ics(self):
        text = "Línea 1; con punto y coma, coma y barra: C:\\temp\nLínea 2"
        escaped = escape_ics_text(text)
        self.assertIn("\\;", escaped)
        self.assertIn("\\,", escaped)
        self.assertIn("\\\\temp", escaped)
        self.assertIn("\\nLínea 2", escaped)

        long_line = "DESCRIPTION:" + ("ABCDE " * 20)
        folded = fold_ics_line(long_line)
        self.assertIn("\r\n ", folded)

    def test_export_to_csv_single(self):
        tasks = [
            {"task": "Tarea A", "assignee": "Ana", "deadline": "2026-10-12", "completed": False},
            {"task": "Tarea B", "assignee": "Beto", "deadline": "Sin fecha", "completed": True},
            # Caso de sanitización de inyección de fórmulas CSV (CWE-1236)
            {"task": "- Revisar presupuesto", "assignee": "=SUM(1+1)", "deadline": "2026-10-15", "completed": False}
        ]
        csv_str = TaskExportService.export_to_csv(tasks, meeting_title="Sprint Planning")
        self.assertTrue(csv_str.startswith("\ufeff"), "Debe incluir UTF-8 BOM para compatibilidad con Excel")
        self.assertIn("Nº,Tarea / Compromiso,Responsable,Fecha Límite,Estado", csv_str)
        self.assertIn("Tarea A,Ana,2026-10-12,Pendiente", csv_str)
        self.assertIn("Tarea B,Beto,Sin fecha,Completada", csv_str)
        # Verificar neutralización de fórmulas
        self.assertIn("'- Revisar presupuesto", csv_str)
        self.assertIn("'=SUM(1+1)", csv_str)

    def test_export_to_csv_consolidated(self):
        tasks = [
            {
                "meeting_title": "Sprint Planning",
                "meeting_date": "2026-10-08",
                "task": "Definir backlog",
                "assignee": "Carlos",
                "deadline": "2026-10-10",
                "completed": False
            }
        ]
        csv_str = TaskExportService.export_to_csv(tasks, is_consolidated=True)
        self.assertIn("Reunión,Fecha Reunión,Nº,Tarea / Compromiso,Responsable,Fecha Límite,Estado", csv_str)
        self.assertIn("Sprint Planning,2026-10-08,1,Definir backlog,Carlos,2026-10-10,Pendiente", csv_str)

    def test_export_to_ics_structure(self):
        tasks = [
            {"task": "Entregar informe financiero", "assignee": "Diana", "deadline": "2026-10-15", "completed": False},
            {"task": "Firmar acta", "assignee": "Sin asignar", "deadline": "Sin fecha", "completed": True}
        ]
        ics_str = TaskExportService.export_to_ics(tasks, meeting_title="Comité Directivo")
        self.assertIn("BEGIN:VCALENDAR", ics_str)
        self.assertIn("VERSION:2.0", ics_str)
        self.assertIn("PRODID:-//Local Meeting Analyzer//Compromisos//ES", ics_str)
        self.assertIn("BEGIN:VEVENT", ics_str)
        self.assertIn("SUMMARY:[Compromiso] Entregar informe financiero (Diana)", ics_str)
        self.assertIn("SUMMARY:[Compromiso - Completado] Firmar acta", ics_str)
        self.assertIn("DTSTART;VALUE=DATE:20261015", ics_str)
        # RFC 5545: VEVENT status debe ser CONFIRMED
        self.assertIn("STATUS:CONFIRMED", ics_str)
        self.assertIn("X-STATUS:COMPLETED", ics_str)
        self.assertIn("END:VEVENT", ics_str)
        self.assertIn("END:VCALENDAR", ics_str)
        self.assertTrue(ics_str.endswith("\r\n"))


class TestTaskExportEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def setUp(self):
        self.rec_dir = get_recordings_dir()
        os.makedirs(self.rec_dir, exist_ok=True)
        self.files_to_clean = []

    def tearDown(self):
        for path in self.files_to_clean:
            if os.path.exists(path):
                try:
                    os.remove(path)
                except Exception:
                    pass

    def _create_meeting_fixtures(self):
        audio1 = os.path.join(self.rec_dir, "reunion_alpha.wav")
        meta1 = os.path.join(self.rec_dir, "reunion_alpha.json")
        audio2 = os.path.join(self.rec_dir, "reunion_beta.wav")
        meta2 = os.path.join(self.rec_dir, "reunion_beta.json")

        with open(audio1, "wb") as f:
            f.write(b"RIFFdummyalpha")
        with open(audio2, "wb") as f:
            f.write(b"RIFFdummybeta")

        with open(meta1, "w", encoding="utf-8") as f:
            json.dump({
                "filename": "reunion_alpha.wav",
                "created": 1760000000,
                "analysis": {
                    "category": "Estrategia",
                    "action_items": [
                        {"task": "Actualizar roadmap Q4", "assignee": "Elena", "deadline": "2026-10-25", "completed": False},
                        {"task": "Aprobar presupuesto", "assignee": "Federico", "deadline": "2026-10-30", "completed": True}
                    ]
                }
            }, f)

        with open(meta2, "w", encoding="utf-8") as f:
            json.dump({
                "filename": "reunion_beta.wav",
                "created": 1760010000,
                "analysis": {
                    "category": "Desarrollo",
                    "action_items": [
                        "Tarea en texto plano de prueba"
                    ]
                }
            }, f)

        self.files_to_clean.extend([audio1, meta1, audio2, meta2])

    def test_list_consolidated_tasks_endpoint(self):
        self._create_meeting_fixtures()

        # Todas las tareas
        res = self.client.get("/recordings/tasks")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["total"], 3)
        self.assertEqual(data["completed"], 1)
        self.assertEqual(data["pending"], 2)

        # Filtrar solo pendientes
        res_pending = self.client.get("/recordings/tasks?status=pending")
        self.assertEqual(res_pending.status_code, 200)
        self.assertEqual(len(res_pending.json()["tasks"]), 2)

        # Filtrar solo completadas
        res_completed = self.client.get("/recordings/tasks?status=completed")
        self.assertEqual(res_completed.status_code, 200)
        self.assertEqual(len(res_completed.json()["tasks"]), 1)

    def test_export_consolidated_tasks_csv(self):
        self._create_meeting_fixtures()
        res = self.client.get("/recordings/tasks/export?format=csv")
        self.assertEqual(res.status_code, 200)
        self.assertIn("text/csv", res.headers.get("content-type", ""))
        self.assertIn('attachment; filename="compromisos_consolidados.csv"', res.headers.get("content-disposition", ""))
        content = res.content.decode("utf-8")
        self.assertTrue(content.startswith("\ufeff"))
        self.assertIn("Actualizar roadmap Q4", content)
        self.assertIn("Aprobar presupuesto", content)
        self.assertIn("Tarea en texto plano de prueba", content)

    def test_export_consolidated_tasks_ics(self):
        self._create_meeting_fixtures()
        res = self.client.get("/recordings/tasks/export?format=ics")
        self.assertEqual(res.status_code, 200)
        self.assertIn("text/calendar", res.headers.get("content-type", ""))
        self.assertIn('attachment; filename="compromisos_consolidados.ics"', res.headers.get("content-disposition", ""))
        content = res.content.decode("utf-8")
        self.assertIn("BEGIN:VCALENDAR", content)
        self.assertIn("[Compromiso] Actualizar roadmap Q4 (Elena)", content)
        self.assertIn("DTSTART;VALUE=DATE:20261025", content)

    def test_export_single_meeting_tasks_csv_and_ics(self):
        self._create_meeting_fixtures()

        # CSV individual
        res_csv = self.client.get("/recordings/reunion_alpha.wav/tasks/export?format=csv")
        self.assertEqual(res_csv.status_code, 200)
        self.assertIn('attachment; filename="compromisos_reunion_alpha.csv"', res_csv.headers.get("content-disposition", ""))
        content_csv = res_csv.content.decode("utf-8")
        self.assertIn("Actualizar roadmap Q4", content_csv)
        self.assertIn("Aprobar presupuesto", content_csv)

        # ICS individual
        res_ics = self.client.get("/recordings/reunion_alpha.wav/tasks/export?format=ics")
        self.assertEqual(res_ics.status_code, 200)
        self.assertIn('attachment; filename="compromisos_reunion_alpha.ics"', res_ics.headers.get("content-disposition", ""))
        content_ics = res_ics.content.decode("utf-8")
        self.assertIn("BEGIN:VCALENDAR", content_ics)
        self.assertIn("[Compromiso] Actualizar roadmap Q4 (Elena)", content_ics)

    def test_export_single_meeting_tasks_with_title_and_filter(self):
        self._create_meeting_fixtures()

        # Filtrar solo pendientes con título personalizado
        res = self.client.get("/recordings/reunion_alpha.wav/tasks/export?format=csv&status=pending&title=Estrategia%20Q4")
        self.assertEqual(res.status_code, 200)
        content = res.content.decode("utf-8")
        self.assertIn("Actualizar roadmap Q4", content)
        self.assertNotIn("Aprobar presupuesto", content)

        # ICS con título personalizado y solo completadas
        res_ics = self.client.get("/recordings/reunion_alpha.wav/tasks/export?format=ics&status=completed&title=Estrategia%20Q4")
        self.assertEqual(res_ics.status_code, 200)
        content_ics = res_ics.content.decode("utf-8")
        self.assertIn("Aprobar presupuesto", content_ics)
        self.assertNotIn("Actualizar roadmap Q4", content_ics)
        self.assertIn("Compromisos - Estrategia Q4", content_ics)

    def test_mcp_action_items_and_export(self):
        self._create_meeting_fixtures()
        from mcp_server import get_all_action_items, export_action_items

        # Verifica que action_items maneje strings legados sin fallar
        items = get_all_action_items()
        self.assertEqual(len(items), 3)
        self.assertTrue(any(it["task"] == "Tarea en texto plano de prueba" for it in items))

        # Exportar CSV desde MCP
        csv_mcp = export_action_items(format="csv", filter_completed=False)
        self.assertIn("Actualizar roadmap Q4", csv_mcp)
        self.assertNotIn("Aprobar presupuesto", csv_mcp)

        # Exportar ICS desde MCP
        ics_mcp = export_action_items(format="ics", meeting_identifier="reunion_alpha.wav")
        self.assertIn("BEGIN:VCALENDAR", ics_mcp)
        self.assertIn("Actualizar roadmap Q4", ics_mcp)

    def test_export_meeting_tasks_not_found(self):
        res = self.client.get("/recordings/reunion_inexistente_xyz.wav/tasks/export")
        self.assertEqual(res.status_code, 404)


if __name__ == "__main__":
    unittest.main()
