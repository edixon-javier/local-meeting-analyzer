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

    def test_rename_preserves_all_metadata_keys(self):
        rec_dir = get_recordings_dir()
        os.makedirs(rec_dir, exist_ok=True)
        audio = os.path.join(rec_dir, "meeting_20260102_101010.wav")
        meta = os.path.join(rec_dir, "meeting_20260102_101010.json")
        renamed = os.path.join(rec_dir, "Nombre nuevo.wav")
        renamed_json = os.path.join(rec_dir, "Nombre nuevo.json")
        with open(audio, "wb") as f:
            f.write(b"RIFF0000WAVE")
        original = {
            "filename": "meeting_20260102_101010.wav", "audio_path": audio,
            "transcript": "A: hola", "analysis": {"summary": ["x"]}, "language": "es",
            "segments": [{"speaker": "A", "text": "hola"}],
            "bookmarks": [{"id": "b1", "time": 3.5, "note": "ojo"}],
            "speaker_map": {"Hablante 1": "A"}, "created": 1234.5, "extra": {"k": 1},
        }
        with open(meta, "w", encoding="utf-8") as f:
            json.dump(original, f)
        try:
            res = self.client.post("/recordings/meeting_20260102_101010.wav/rename", json={"new_name": "Nombre nuevo"})
            self.assertEqual(res.status_code, 200, res.text)
            with open(renamed_json, "r", encoding="utf-8") as f:
                new_meta = json.load(f)
            self.assertEqual(new_meta["filename"], "Nombre nuevo.wav")
            self.assertEqual(new_meta["audio_path"], renamed)
            for key in ("transcript", "analysis", "language", "segments", "bookmarks", "speaker_map", "created", "extra"):
                self.assertEqual(new_meta[key], original[key], key)
        finally:
            for path in (audio, meta, renamed, renamed_json):
                if os.path.exists(path):
                    os.remove(path)


class TestMicNames(unittest.TestCase):
    def test_clean_mic_name_no_duplicate_prefix(self):
        from api.routers.system import _clean_mic_name
        self.assertEqual(_clean_mic_name("Micrófono (G06-BT)"), "Micrófono (G06-BT)")
        self.assertEqual(_clean_mic_name("Microphone (USB)"), "Microphone (USB)")
        self.assertEqual(_clean_mic_name("Headset Mic"), "Micrófono - Headset Mic")

    def test_unique_labels_keeps_devices_distinguishable(self):
        from api.routers.system import _unique_labels
        out = _unique_labels([{"id": "1", "name": "Micrófono (X)"}, {"id": "2", "name": "Micrófono (X)"}, {"id": "3", "name": "Otro"}])
        self.assertEqual([d["name"] for d in out], ["Micrófono (X) (1)", "Micrófono (X) (2)", "Otro"])


if __name__ == "__main__":
    unittest.main()
