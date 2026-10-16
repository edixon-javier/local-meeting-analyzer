import unittest
from unittest.mock import patch, MagicMock
from core.config import Config, mask_api_key, is_masked_api_key
from services.analysis_service import (
    CloudClaudeProvider, 
    CloudGeminiProvider, 
    AnalysisService,
    LocalModelUnavailableError
)
from services.transcription_service import TranscriptionService


class TestMultimodelProviders(unittest.TestCase):
    def setUp(self):
        self.config_dict = {
            "ai_provider": "local",
            "whisper_model": "small",
            "ollama_model": "qwen3:4b",
            "openai_api_key": "sk-openai-fake12345678",
            "openai_model": "gpt-4o-mini",
            "anthropic_api_key": "sk-ant-fake12345678",
            "claude_model": "claude-3-5-haiku-20241022",
            "gemini_api_key": "AIzaSyFake12345678",
            "gemini_model": "gemini-2.0-flash",
            "allow_cloud_fallback": False
        }
        self.config = Config.__new__(Config)
        self.config._config_path = "mock_config.json"
        self.config._default_config = self.config_dict.copy()
        self.config.settings = self.config_dict.copy()

    def test_key_masking(self):
        public = self.config.public_settings()
        self.assertTrue(public["has_openai_key"])
        self.assertTrue(public["has_claude_key"])
        self.assertTrue(public["has_gemini_key"])
        
        self.assertTrue(is_masked_api_key(public["openai_api_key"]))
        self.assertTrue(is_masked_api_key(public["anthropic_api_key"]))
        self.assertTrue(is_masked_api_key(public["gemini_api_key"]))
        
        self.assertTrue(public["openai_api_key"].endswith("5678"))
        self.assertTrue(public["anthropic_api_key"].endswith("5678"))
        self.assertTrue(public["gemini_api_key"].endswith("5678"))

    @patch("requests.post")
    def test_claude_provider_diarization_and_analysis(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "content": [{"type": "text", "text": '{"0": "Hablante A", "1": "Carlos"}'}]
        }
        mock_post.return_value = mock_resp

        provider = CloudClaudeProvider(self.config)
        self.assertTrue(provider.is_running())
        self.assertEqual(provider.ai_provider, "claude")

        segments = [
            {"start": 0.0, "end": 2.0, "text": "Hola a todos"},
            {"start": 2.0, "end": 4.0, "text": "Buenos días"}
        ]
        diarized = provider.diarize_transcript(segments)
        self.assertEqual(len(diarized), 2)
        self.assertEqual(diarized[0]["speaker"], "Hablante A")
        self.assertEqual(diarized[1]["speaker"], "Carlos")

        # Test analysis
        mock_resp.json.return_value = {
            "content": [{"type": "text", "text": '{"summary": ["Acuerdo clave"], "action_items": [], "tone": "Colaborativo", "category": "Planificación", "key_decisions": [], "duration_insight": "Breve"}'}]
        }
        analysis = provider.analyze("Transcripción de prueba")
        self.assertIn("summary", analysis)
        self.assertEqual(analysis["summary"], ["Acuerdo clave"])

    @patch("requests.post")
    def test_gemini_provider_diarization_and_analysis(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "candidates": [
                {
                    "content": {
                        "parts": [{"text": '{"0": "Laura", "1": "Hablante B"}'}],
                        "role": "model"
                    }
                }
            ]
        }
        mock_post.return_value = mock_resp

        provider = CloudGeminiProvider(self.config)
        self.assertTrue(provider.is_running())
        self.assertEqual(provider.ai_provider, "gemini")

        segments = [
            {"start": 0.0, "end": 3.0, "text": "Comenzamos la reunión"},
            {"start": 3.0, "end": 6.0, "text": "De acuerdo"}
        ]
        diarized = provider.diarize_transcript(segments)
        self.assertEqual(len(diarized), 2)
        self.assertEqual(diarized[0]["speaker"], "Laura")
        self.assertEqual(diarized[1]["speaker"], "Hablante B")

        # Test analysis
        mock_resp.json.return_value = {
            "candidates": [
                {
                    "content": {
                        "parts": [{"text": '{"summary": ["Punto 1"], "action_items": [], "tone": "Formal", "category": "Toma de Decisiones", "key_decisions": ["Aprobado"], "duration_insight": "OK"}'}],
                        "role": "model"
                    }
                }
            ]
        }
        analysis = provider.analyze("Transcripción")
        self.assertEqual(analysis["key_decisions"], ["Aprobado"])

    def test_analysis_service_provider_switching(self):
        service = AnalysisService(self.config)
        self.assertEqual(service.ai_provider, "local")

        self.config.set("ai_provider", "claude")
        service.set_config(self.config)
        self.assertEqual(service.ai_provider, "claude")
        self.assertEqual(service.active_provider.ai_provider, "claude")

        self.config.set("ai_provider", "gemini")
        service.set_config(self.config)
        self.assertEqual(service.ai_provider, "gemini")
        self.assertEqual(service.active_provider.ai_provider, "gemini")

        self.config.set("ai_provider", "openai")
        service.set_config(self.config)
        self.assertEqual(service.ai_provider, "openai")
        self.assertEqual(service.active_provider.ai_provider, "openai")

    @patch("requests.post")
    def test_gemini_transcription(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "candidates": [
                {
                    "content": {
                        "parts": [{
                            "text": '{"text": "Hola mundo", "language": "es", "segments": [{"start": 0.0, "end": 1.5, "text": "Hola mundo"}]}'
                        }]
                    }
                }
            ]
        }
        mock_post.return_value = mock_resp

        self.config.set("ai_provider", "gemini")
        transcriber = TranscriptionService(self.config)

        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(b"RIFFdummydataWAVEfmt ")
            tmp_path = f.name

        try:
            res = transcriber.transcribe(tmp_path, language="es")
            self.assertEqual(res["text"], "Hola mundo")
            self.assertEqual(len(res["segments"]), 1)
            self.assertEqual(res["segments"][0]["text"], "Hola mundo")
        finally:
            import os
            if os.path.exists(tmp_path):
                os.remove(tmp_path)


if __name__ == "__main__":
    unittest.main()
