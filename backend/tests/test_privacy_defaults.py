"""
Pruebas de privacidad y valores por defecto:
- ai_provider = "local", allow_cloud_fallback = False, modelo qwen3:4b
- Sin respaldo silencioso a OpenAI (solo si el usuario lo activó y hay clave)
- La clave de API nunca sale en claro de GET /config y los valores enmascarados no la sobrescriben
- Recorte de <think>...</think> y "think": false en las peticiones a Ollama
- Enmascarado de claves en los logs y manejador de errores 500
No se llama nunca a Ollama ni a OpenAI reales: todo está simulado.
"""

import io
import json
import logging
import os
import sys
import tempfile
import unittest
import uuid
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from tests import _testenv  # aísla config.json y grabaciones en una carpeta temporal

from fastapi.testclient import TestClient

from core import logging_setup
from core.config import Config, DEFAULT_OLLAMA_MODEL, mask_api_key, is_masked_api_key, system_config
from core.version import APP_VERSION
from services.analysis_service import (
    AnalysisService,
    CloudOpenAIProvider,
    LocalModelUnavailableError,
    LocalOllamaProvider,
    LOCAL_UNAVAILABLE_MSG,
    parse_json_response,
    strip_think_blocks,
)

FAKE_KEY = "sk-test-0123456789abcdefWXYZ"


def make_config(**overrides) -> Config:
    """Config aislada: archivo propio dentro de la carpeta de datos temporal de las pruebas."""
    cfg = Config(os.path.join(_testenv.TEST_DATA_DIR, f"config-{uuid.uuid4().hex}.json"))
    cfg.update(overrides)
    return cfg


class TestConfigDefaults(unittest.TestCase):
    def test_privacy_defaults(self):
        cfg = make_config()
        self.assertEqual(cfg.get("ai_provider"), "local")
        self.assertIs(cfg.get("allow_cloud_fallback"), False)
        self.assertEqual(cfg.get("ollama_model"), "qwen3:4b")
        self.assertEqual(DEFAULT_OLLAMA_MODEL, "qwen3:4b")
        self.assertEqual(cfg.get("openai_api_key"), "")

    def test_existing_config_keeps_user_values_and_merges_new_keys(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "config.json")
            with open(path, "w", encoding="utf-8") as f:
                json.dump({"ollama_model": "phi3", "ai_provider": "openai", "openai_api_key": FAKE_KEY}, f)
            cfg = Config(path)
            self.assertEqual(cfg.get("ollama_model"), "phi3")
            self.assertEqual(cfg.get("ai_provider"), "openai")
            self.assertEqual(cfg.get("openai_api_key"), FAKE_KEY)
            self.assertIs(cfg.get("allow_cloud_fallback"), False)  # clave nueva con su valor por defecto
            self.assertEqual(cfg.get("whisper_model"), "small")

    def test_public_settings_masks_key(self):
        cfg = make_config(openai_api_key=FAKE_KEY)
        public = cfg.public_settings()
        self.assertTrue(public["has_api_key"])
        self.assertNotIn(FAKE_KEY, json.dumps(public))
        self.assertTrue(public["openai_api_key"].endswith("WXYZ"))
        self.assertTrue(is_masked_api_key(public["openai_api_key"]))
        # La configuración interna no cambia
        self.assertEqual(cfg.get("openai_api_key"), FAKE_KEY)

    def test_public_settings_without_key(self):
        public = make_config().public_settings()
        self.assertFalse(public["has_api_key"])
        self.assertEqual(public["openai_api_key"], "")

    def test_mask_helpers(self):
        self.assertEqual(mask_api_key(""), "")
        self.assertEqual(mask_api_key(None), "")
        self.assertFalse(is_masked_api_key(FAKE_KEY))
        self.assertFalse(is_masked_api_key(""))
        self.assertTrue(is_masked_api_key(mask_api_key("sk-short")))
        self.assertNotIn("short", mask_api_key("sk-short"))  # claves cortas: sin últimos 4


class TestThinkStripping(unittest.TestCase):
    def test_strip_closed_block(self):
        self.assertEqual(strip_think_blocks('<think>pienso...\nmás</think>\n{"a": 1}'), '{"a": 1}')

    def test_strip_is_case_insensitive_and_multiple(self):
        self.assertEqual(strip_think_blocks("<THINK>a</THINK>hola<think>b</think> mundo"), "hola mundo")

    def test_strip_unclosed_block_truncated_response(self):
        self.assertEqual(strip_think_blocks('{"a": 1} <think>me quedé sin tokens'), '{"a": 1}')
        self.assertEqual(strip_think_blocks("<think>solo razonamiento"), "")

    def test_strip_closing_tag_without_opening(self):
        self.assertEqual(strip_think_blocks('razonamiento previo</think>{"a": 1}'), '{"a": 1}')

    def test_strip_plain_text_unchanged(self):
        self.assertEqual(strip_think_blocks("  texto normal  "), "texto normal")
        self.assertEqual(strip_think_blocks(""), "")

    def test_parse_json_response_ignores_think_block(self):
        raw = '<think>El JSON debe tener {"x": 0} pero primero pienso</think>\n{"summary": ["ok"]}'
        self.assertEqual(parse_json_response(raw, {}), {"summary": ["ok"]})

    def test_ollama_payload_disables_thinking_and_strips_response(self):
        provider = LocalOllamaProvider(make_config())
        self.assertEqual(provider.model, "qwen3:4b")
        fake_response = MagicMock()
        fake_response.raise_for_status.return_value = None
        fake_response.json.return_value = {"response": "<think>x</think> Hola "}
        with patch("services.analysis_service.requests.post", return_value=fake_response) as post:
            result = provider._call_ollama("prompt")
        self.assertEqual(result, "Hola")
        payload = post.call_args.kwargs["json"]
        self.assertIs(payload["think"], False)
        self.assertEqual(payload["model"], "qwen3:4b")


class TestNoSilentCloudFallback(unittest.TestCase):
    """Con proveedor local, OpenAI solo se usa si allow_cloud_fallback está activo y hay clave."""

    def _service(self, **overrides) -> AnalysisService:
        cfg = make_config(**overrides)
        with patch("openai.OpenAI"):
            return AnalysisService(cfg)

    def test_local_running_uses_local_only(self):
        service = self._service(openai_api_key=FAKE_KEY, allow_cloud_fallback=True)
        with patch.object(LocalOllamaProvider, "is_running", return_value=True), \
             patch.object(LocalOllamaProvider, "analyze", return_value={"summary": ["local"]}) as local_analyze, \
             patch.object(CloudOpenAIProvider, "analyze") as cloud_analyze:
            result = service.analyze("hola")
        self.assertEqual(result, {"summary": ["local"]})
        local_analyze.assert_called_once()
        cloud_analyze.assert_not_called()

    def test_no_fallback_by_default_even_with_api_key(self):
        service = self._service(openai_api_key=FAKE_KEY)  # allow_cloud_fallback = False (defecto)
        with patch.object(LocalOllamaProvider, "is_running", return_value=False), \
             patch.object(CloudOpenAIProvider, "analyze") as cloud_analyze, \
             patch.object(CloudOpenAIProvider, "chat_with_transcript") as cloud_chat, \
             patch.object(CloudOpenAIProvider, "diarize_transcript") as cloud_diarize:
            self.assertFalse(service.is_running())
            self.assertEqual(service.model, "qwen3:4b")

            result = service.analyze("hola")
            self.assertIn(LOCAL_UNAVAILABLE_MSG, result["summary"][0])

            with self.assertRaises(LocalModelUnavailableError) as ctx:
                service.chat_with_transcript("t", [], "¿qué?")
            self.assertEqual(str(ctx.exception), LOCAL_UNAVAILABLE_MSG)

            segments = [{"start": 0.0, "end": 1.0, "text": " hola "}]
            diarized = service.diarize_transcript(segments)
            self.assertEqual(diarized[0]["speaker"], "Hablante A")
        cloud_analyze.assert_not_called()
        cloud_chat.assert_not_called()
        cloud_diarize.assert_not_called()

    def test_unavailable_message_is_clear_spanish(self):
        self.assertEqual(
            LOCAL_UNAVAILABLE_MSG,
            "El modelo local no está disponible. Inicia Ollama o activa el uso de la nube en Ajustes.",
        )

    def test_fallback_when_user_opted_in(self):
        service = self._service(openai_api_key=FAKE_KEY, allow_cloud_fallback=True)
        with patch.object(LocalOllamaProvider, "is_running", return_value=False), \
             patch.object(CloudOpenAIProvider, "analyze", return_value={"summary": ["nube"]}) as cloud_analyze, \
             patch.object(CloudOpenAIProvider, "chat_with_transcript", return_value="respuesta nube") as cloud_chat:
            self.assertTrue(service.is_running())
            self.assertEqual(service.analyze("hola"), {"summary": ["nube"]})
            self.assertEqual(service.chat_with_transcript("t", [], "¿qué?"), "respuesta nube")
        cloud_analyze.assert_called_once()
        cloud_chat.assert_called_once()

    def test_fallback_opt_in_without_api_key_is_still_unavailable(self):
        service = self._service(allow_cloud_fallback=True)  # sin clave
        with patch.object(LocalOllamaProvider, "is_running", return_value=False):
            self.assertFalse(service.is_running())
            with self.assertRaises(LocalModelUnavailableError):
                service.chat_with_history("ctx", [], "¿qué?")

    def test_retry_in_cloud_after_local_error_only_when_opted_in(self):
        for opted_in, expect_cloud in ((False, False), (True, True)):
            with self.subTest(opted_in=opted_in):
                service = self._service(openai_api_key=FAKE_KEY, allow_cloud_fallback=opted_in)
                with patch.object(LocalOllamaProvider, "is_running", return_value=True), \
                     patch.object(LocalOllamaProvider, "chat_with_transcript", side_effect=RuntimeError("falló")), \
                     patch.object(CloudOpenAIProvider, "chat_with_transcript", return_value="nube") as cloud_chat:
                    if expect_cloud:
                        self.assertEqual(service.chat_with_transcript("t", [], "q"), "nube")
                    else:
                        with self.assertRaises(RuntimeError):
                            service.chat_with_transcript("t", [], "q")
                self.assertEqual(cloud_chat.called, expect_cloud)

    def test_openai_provider_uses_cloud_when_explicit(self):
        service = self._service(ai_provider="openai", openai_api_key=FAKE_KEY)
        with patch.object(CloudOpenAIProvider, "analyze", return_value={"summary": ["nube"]}) as cloud_analyze:
            self.assertEqual(service.analyze("hola"), {"summary": ["nube"]})
        cloud_analyze.assert_called_once()

    def test_deleting_key_drops_cloud_client(self):
        cfg = make_config(openai_api_key=FAKE_KEY, allow_cloud_fallback=True)
        with patch("openai.OpenAI"):
            service = AnalysisService(cfg)
            self.assertTrue(service.cloud_provider.is_running())
            cfg.update({"openai_api_key": ""})
            service.set_config(cfg)
        self.assertFalse(service.cloud_provider.is_running())


class TestTranscriptionNeverUsesCloudWhenLocal(unittest.TestCase):
    def test_local_provider_has_no_openai_client_and_refuses_cloud_transcription(self):
        from services.transcription_service import TranscriptionService

        cfg = make_config(openai_api_key=FAKE_KEY)  # clave guardada, pero proveedor local
        with patch("openai.OpenAI") as openai_cls:
            service = TranscriptionService(cfg)
            self.assertIsNone(service.openai_client)
            openai_cls.assert_not_called()

            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp.write(b"RIFF")
            try:
                with self.assertRaises(RuntimeError):
                    service._transcribe_openai(tmp.name, "es")
            finally:
                os.remove(tmp.name)

    def test_switching_from_openai_to_local_drops_client(self):
        from services.transcription_service import TranscriptionService

        cfg = make_config(ai_provider="openai", openai_api_key=FAKE_KEY)
        with patch("openai.OpenAI"):
            service = TranscriptionService(cfg)
            self.assertIsNotNone(service.openai_client)
            cfg.update({"ai_provider": "local"})
            service.set_config(cfg)
        self.assertIsNone(service.openai_client)

    def test_model_is_loaded_lazily(self):
        from services.transcription_service import TranscriptionService

        with patch("services.transcription_service.WhisperModel") as whisper_cls:
            service = TranscriptionService(make_config())
            service.set_model("tiny")
            whisper_cls.assert_not_called()  # nada se descarga/carga al arrancar ni al cambiar de modelo


class TestConfigEndpoint(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from main import app
        cls.client = TestClient(app)

    def setUp(self):
        self._original = dict(system_config.settings)
        system_config.update({"openai_api_key": FAKE_KEY, "allow_cloud_fallback": False, "ai_provider": "local"})

    def tearDown(self):
        system_config.settings = self._original
        system_config.save()
        from api.routers.system import _analyzer_instance, _transcriber_instance
        _analyzer_instance.set_config(system_config)
        _transcriber_instance.set_config(system_config)

    def test_get_config_masks_api_key(self):
        res = self.client.get("/config")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertNotIn(FAKE_KEY, res.text)
        self.assertTrue(data["has_api_key"])
        self.assertTrue(data["openai_api_key"].endswith("WXYZ"))
        self.assertIs(data["allow_cloud_fallback"], False)

    def test_post_config_response_is_masked_too(self):
        res = self.client.post("/config", json={"analysis_focus": "x"})
        self.assertEqual(res.status_code, 200)
        self.assertNotIn(FAKE_KEY, res.text)

    def test_masked_value_does_not_overwrite_key(self):
        masked = self.client.get("/config").json()["openai_api_key"]
        res = self.client.post("/config", json={"openai_api_key": masked, "diarize": True})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(system_config.get("openai_api_key"), FAKE_KEY)
        self.assertIs(system_config.get("diarize"), True)

    def test_new_key_replaces_and_empty_string_clears(self):
        new_key = "sk-nueva-clave-abcdefgh1234"
        self.client.post("/config", json={"openai_api_key": f"  {new_key}  "})
        self.assertEqual(system_config.get("openai_api_key"), new_key)
        res = self.client.post("/config", json={"openai_api_key": ""})
        self.assertEqual(system_config.get("openai_api_key"), "")
        self.assertFalse(res.json()["config"]["has_api_key"])

    def test_omitted_key_is_unchanged(self):
        self.client.post("/config", json={"analysis_focus": "otro"})
        self.assertEqual(system_config.get("openai_api_key"), FAKE_KEY)

    def test_allow_cloud_fallback_can_be_saved(self):
        res = self.client.post("/config", json={"allow_cloud_fallback": True})
        self.assertIs(res.json()["config"]["allow_cloud_fallback"], True)
        self.assertIs(system_config.get("allow_cloud_fallback"), True)

    def test_test_ai_ignores_masked_key(self):
        masked = self.client.get("/config").json()["openai_api_key"]
        with patch("openai.OpenAI") as openai_cls:
            openai_cls.return_value.chat.completions.create.return_value = MagicMock()
            res = self.client.post("/status/test-ai", json={"provider": "openai", "api_key": masked})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(openai_cls.call_args.kwargs["api_key"], FAKE_KEY)

    def test_status_exposes_version(self):
        self.assertEqual(self.client.get("/status").json()["version"], APP_VERSION)
        # La versión del backend debe coincidir con la de la app (frontend/package.json, la que publica el CI)
        pkg_path = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "package.json")
        with open(pkg_path, encoding="utf-8") as f:
            self.assertEqual(APP_VERSION, json.load(f)["version"])

    def test_fallback_model_list(self):
        from api.routers.system import _models_cache
        self.assertEqual(_models_cache["models"], ["qwen3:4b", "qwen3:1.7b", "phi3", "mistral", "llama3.2"])


class TestUnhandledErrorHandler(unittest.TestCase):
    def test_unhandled_exception_returns_json_500_and_logs(self):
        from fastapi import FastAPI
        import main as backend_main

        probe = FastAPI()
        probe.add_exception_handler(Exception, backend_main.unhandled_exception_handler)

        @probe.get("/boom")
        def boom():
            raise ValueError("secreto interno")

        client = TestClient(probe, raise_server_exceptions=False)
        with self.assertLogs("api", level="ERROR") as logs:
            res = client.get("/boom")
        self.assertEqual(res.status_code, 500)
        self.assertIn("detail", res.json())
        self.assertNotIn("secreto interno", res.text)  # el detalle interno no llega al cliente
        self.assertTrue(any("/boom" in line for line in logs.output))
        self.assertEqual(res.headers.get("access-control-allow-origin"), "*")


class TestLoggingSetup(unittest.TestCase):
    def test_mask_secrets(self):
        self.assertEqual(logging_setup.mask_secrets(f"key={FAKE_KEY} fin"), "key=sk-*** fin")
        self.assertEqual(logging_setup.mask_secrets("sin claves"), "sin claves")
        self.assertEqual(logging_setup.mask_secrets("sk-corta"), "sk-corta")  # < 8 caracteres tras sk-

    def test_filter_masks_message_and_args(self):
        flt = logging_setup.SecretMaskingFilter()
        record = logging.LogRecord("t", logging.INFO, __file__, 1, "clave %s", (FAKE_KEY,), None)
        flt.filter(record)
        self.assertNotIn("0123456789", record.getMessage())
        self.assertIn("sk-***", record.getMessage())

    def test_file_log_captures_prints_masks_secrets_and_tracebacks(self):
        with tempfile.TemporaryDirectory() as tmp:
            fake_stdout, fake_stderr = io.StringIO(), io.StringIO()
            real_stdout, real_stderr = sys.stdout, sys.stderr
            sys.stdout, sys.stderr = fake_stdout, fake_stderr
            try:
                path = logging_setup.setup_logging(log_dir=tmp)
                try:
                    print(f"[Test] usando {FAKE_KEY} en el backend")
                    print("INFO:     127.0.0.1:5000 - \"GET /status HTTP/1.1\" 200 OK")  # sondeo: no se guarda
                    print("[Test] \x1b[32mcolor\x1b[0m")
                    print("[Test] descarga 10%\r[Test] descarga 55%\r[Test] descarga 100%")  # barra de progreso
                    try:
                        raise ValueError(f"fallo con {FAKE_KEY}")
                    except ValueError:
                        logging.getLogger("test").exception("Traza de prueba")
                    sys.stdout.flush()
                    for handler in logging.getLogger().handlers:
                        handler.flush()
                finally:
                    logging_setup.teardown_logging()
            finally:
                sys.stdout, sys.stderr = real_stdout, real_stderr

            with open(path, "r", encoding="utf-8") as f:
                content = f.read()

            self.assertTrue(path.endswith("backend.log"))
            self.assertIn("usando sk-*** en el backend", content)
            self.assertNotIn("0123456789", content)
            self.assertNotIn("GET /status", content)
            self.assertIn("color", content)
            self.assertNotIn("\x1b[", content)
            self.assertIn("descarga 100%", content)  # de una barra de progreso solo queda el estado final
            self.assertNotIn("descarga 10%", content)
            self.assertIn("Traza de prueba", content)
            self.assertIn("ValueError", content)
            # La consola (stream original) sigue recibiendo la salida sin modificar
            self.assertIn(FAKE_KEY, fake_stdout.getvalue())

    def test_startup_banner_has_version_and_paths(self):
        with self.assertLogs("startup", level="INFO") as logs:
            logging_setup.log_startup_banner()
        joined = "\n".join(logs.output)
        self.assertIn(APP_VERSION, joined)
        self.assertIn("Carpeta de datos", joined)
        self.assertIn("ffmpeg", joined)


if __name__ == "__main__":
    unittest.main()
