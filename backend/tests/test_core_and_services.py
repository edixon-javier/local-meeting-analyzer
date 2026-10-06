import os
import sys
import tempfile
import unittest
import json

# Agregar backend al path para importar módulos limpios
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from tests import _testenv  # noqa: F401  (aísla config.json y grabaciones en una carpeta temporal)

from core.config import Config
from services.session_manager import SessionManager
from services.metadata_repository import MetadataRepository
from services.analysis_service import parse_json_response
from api.routers.history import _get_json_path, SUPPORTED_AUDIO_EXTS


class TestConfig(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.config_path = os.path.join(self.temp_dir.name, "test_config.json")
        self.config = Config(self.config_path)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_default_values(self):
        self.assertEqual(self.config.get("whisper_model"), "small")
        self.assertEqual(self.config.get("ai_provider"), "local")
        self.assertEqual(self.config.get("record_mode"), "both")

    def test_update_and_save(self):
        self.config.update({"whisper_model": "medium", "ai_provider": "local"})
        self.config.save()

        # Reload from disk
        reloaded = Config(self.config_path)
        self.assertEqual(reloaded.get("whisper_model"), "medium")
        self.assertEqual(reloaded.get("ai_provider"), "local")


class TestSessionManager(unittest.TestCase):
    def setUp(self):
        self.session = SessionManager()

    def test_initial_state(self):
        state = self.session.get_state()
        self.assertFalse(state["recording"])
        self.assertFalse(state["paused"])
        self.assertFalse(state["processing"])
        self.assertIsNone(state["transcript"])
        self.assertIsNone(state["analysis"])

    def test_recording_and_processing_flags(self):
        self.session.set_recording(True)
        self.assertTrue(self.session.get_state()["recording"])
        
        self.session.set_processing(True)
        self.assertTrue(self.session.is_processing())

        self.session.set_processing(False)
        self.assertFalse(self.session.is_processing())

    def test_reset_for_new_recording(self):
        self.session.set_transcript("Texto previo")
        self.session.set_analysis({"summary": ["test"]})
        self.session.reset_for_new_recording()

        self.assertIsNone(self.session.get_transcript())
        self.assertIsNone(self.session.get_state()["analysis"])


class TestMetadataRepository(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.repo = MetadataRepository()

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_save_and_get_metadata_wav(self):
        audio_file = os.path.join(self.temp_dir.name, "meeting_test.wav")
        with open(audio_file, "wb") as f:
            f.write(b"fake audio bytes")

        transcript = "Hola mundo"
        analysis = {"summary": ["Punto 1"], "category": "Test"}
        
        self.repo.save_meeting_metadata(audio_file, transcript, analysis)
        
        json_file = os.path.join(self.temp_dir.name, "meeting_test.json")
        self.assertTrue(os.path.exists(json_file))
        
        # Audio file must NOT be modified
        with open(audio_file, "rb") as f:
            self.assertEqual(f.read(), b"fake audio bytes")

        meta = self.repo.get_metadata(json_file)
        self.assertIsNotNone(meta)
        self.assertEqual(meta["transcript"], transcript)
        self.assertEqual(meta["analysis"]["category"], "Test")

    def test_save_metadata_for_uploaded_m4a_never_overwrites_audio(self):
        # Prevent regression of the critical data-loss bug
        m4a_file = os.path.join(self.temp_dir.name, "reunion_externa.m4a")
        original_content = b"fake m4a audio binary stream"
        with open(m4a_file, "wb") as f:
            f.write(original_content)

        self.repo.save_meeting_metadata(m4a_file, "Transcripción de m4a", {"summary": ["OK"]})

        expected_json = os.path.join(self.temp_dir.name, "reunion_externa.json")
        self.assertTrue(os.path.exists(expected_json))

        # Check that original audio binary content remains intact and is not overwritten with JSON
        with open(m4a_file, "rb") as f:
            self.assertEqual(f.read(), original_content)


class TestAudioFormatHelpers(unittest.TestCase):
    def test_supported_audio_extensions(self):
        self.assertIn(".wav", SUPPORTED_AUDIO_EXTS)
        self.assertIn(".mp3", SUPPORTED_AUDIO_EXTS)
        self.assertIn(".m4a", SUPPORTED_AUDIO_EXTS)
        self.assertIn(".flac", SUPPORTED_AUDIO_EXTS)
        self.assertIn(".ogg", SUPPORTED_AUDIO_EXTS)

    def test_get_json_path(self):
        self.assertEqual(_get_json_path("c:/test/meeting.wav"), "c:/test/meeting.json")
        self.assertEqual(_get_json_path("c:/test/meeting.mp3"), "c:/test/meeting.json")
        self.assertEqual(_get_json_path("c:/test/meeting.m4a"), "c:/test/meeting.json")
        self.assertEqual(_get_json_path("c:/test/meeting.flac"), "c:/test/meeting.json")


class TestAnalysisParsers(unittest.TestCase):
    def test_clean_json_parsing(self):
        raw = '{"summary": ["Punto 1"], "tone": "Formal"}'
        fallback = {"summary": []}
        res = parse_json_response(raw, fallback)
        self.assertEqual(res["tone"], "Formal")
        self.assertEqual(res["summary"], ["Punto 1"])

    def test_markdown_codeblock_json_parsing(self):
        raw = '```json\n{"0": "Hablante A", "1": "Juan"}\n```'
        fallback = {}
        res = parse_json_response(raw, fallback)
        self.assertEqual(res.get("0"), "Hablante A")
        self.assertEqual(res.get("1"), "Juan")

    def test_noisy_text_with_json_parsing(self):
        raw = 'Aquí tienes el resultado solicitado:\n{"category": "Técnica", "decisions": []}\nEspero te sirva.'
        fallback = {}
        res = parse_json_response(raw, fallback)
        self.assertEqual(res.get("category"), "Técnica")

    def test_malformed_json_returns_fallback_safely(self):
        raw = 'Este texto no tiene ningún formato JSON válido.'
        fallback = {"summary": ["Fallback seguro"]}
        res = parse_json_response(raw, fallback)
        self.assertEqual(res, fallback)


if __name__ == "__main__":
    unittest.main()
