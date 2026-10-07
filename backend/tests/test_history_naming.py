import os
import sys
import json
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from tests import _testenv  # noqa: F401  (aísla config.json y grabaciones en una carpeta temporal)
from core.paths import get_recordings_dir

from fastapi.testclient import TestClient
from main import app
from api.routers.history import _sanitize_filename, _summary_preview


class TestHistoryNaming(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_sanitize_filename_removes_invalid_windows_chars(self):
        self.assertEqual(_sanitize_filename('Reunión: 6/oct ¿plan?  '), 'Reunión- 6-oct ¿plan-')
        self.assertEqual(_sanitize_filename('a<b>c|d*e"g'), 'a-b-c-d-e-g')
        self.assertEqual(_sanitize_filename('  .oculto. '), 'oculto')

    def test_summary_preview_uses_first_point_and_truncates(self):
        self.assertEqual(_summary_preview({"summary": ["Plan de lanzamiento", "Otro"]}), "Plan de lanzamiento")
        self.assertIsNone(_summary_preview({"summary": []}))
        long_text = "x" * 200
        preview = _summary_preview({"summary": [long_text]})
        self.assertTrue(preview.endswith("…"))
        self.assertLessEqual(len(preview), 160)

    def test_list_includes_preview_and_rename_sanitizes(self):
        rec_dir = get_recordings_dir()
        os.makedirs(rec_dir, exist_ok=True)
        audio = os.path.join(rec_dir, "meeting_20260101_101010.wav")
        meta = os.path.join(rec_dir, "meeting_20260101_101010.json")
        with open(audio, "wb") as f:
            f.write(b"RIFF0000WAVE")
        with open(meta, "w", encoding="utf-8") as f:
            json.dump({"analysis": {"summary": ["Revisión del presupuesto"], "category": "Finanzas"}}, f)
        renamed = os.path.join(rec_dir, "Presupuesto- Q1.wav")
        try:
            recs = self.client.get("/recordings/").json()["recordings"]
            target = next(r for r in recs if r["filename"] == "meeting_20260101_101010.wav")
            self.assertEqual(target["summary_preview"], "Revisión del presupuesto")
            self.assertIn("duration", target)  # None si el archivo no es audio válido

            res = self.client.post("/recordings/meeting_20260101_101010.wav/rename", json={"new_name": "Presupuesto: Q1"})
            self.assertEqual(res.status_code, 200, res.text)
            self.assertEqual(res.json()["new_filename"], "Presupuesto- Q1.wav")
            self.assertTrue(os.path.exists(renamed))
        finally:
            for path in (audio, meta, renamed, os.path.splitext(renamed)[0] + ".json"):
                if os.path.exists(path):
                    os.remove(path)


if __name__ == "__main__":
    unittest.main()
