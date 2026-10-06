import os
import sys
import time
import json
import subprocess
import unittest
from collections import namedtuple
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from tests import _testenv  # noqa: F401  (aísla config.json y grabaciones en una carpeta temporal)

import requests
from fastapi.testclient import TestClient
from main import app
from api.routers import setup as setup_router

GIB = 1024 ** 3
DiskUsage = namedtuple("DiskUsage", "total used free")


class _StubConfig:
    def __init__(self, **values):
        self._values = values

    def get(self, key, default=None):
        return self._values.get(key, default)


def _requirements(ram_gib, cores, build, disk_free_gib, machine="AMD64", avx2=True):
    """Ejecuta GET /setup/requirements con un hardware simulado."""
    client = TestClient(app)
    with patch.object(setup_router, "get_memory_bytes", return_value=(int(ram_gib * GIB), int(ram_gib * GIB / 2))), \
         patch.object(setup_router.os, "cpu_count", return_value=cores), \
         patch.object(setup_router, "get_windows_build", return_value=(10, 0, build)), \
         patch.object(setup_router, "has_avx2", return_value=avx2), \
         patch.object(setup_router.platform, "machine", return_value=machine), \
         patch.object(setup_router.shutil, "disk_usage", return_value=DiskUsage(500 * GIB, 100 * GIB, int(disk_free_gib * GIB))):
        res = client.get("/setup/requirements")
    return res


def _status_of(data, item_id):
    return next(i["status"] for i in data["items"] if i["id"] == item_id)


class TestSetupRequirements(unittest.TestCase):
    def test_equipo_recomendado_todo_ok(self):
        res = _requirements(ram_gib=15.8, cores=8, build=22631, disk_free_gib=120)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["overall"], "ok")
        ids = [i["id"] for i in data["items"]]
        for expected in ("os", "arch", "cpu", "ram", "disk"):
            self.assertIn(expected, ids)
        for item in data["items"]:
            self.assertEqual(set(item), {"id", "label", "value", "status", "detail"})
            self.assertEqual(item["status"], "ok", item)
        self.assertEqual(data["recommendations"]["whisper_model"], "small")
        self.assertEqual(data["recommendations"]["llm_model"], "qwen3:4b")
        self.assertEqual(data["recommendations"]["live_whisper_model"], "tiny")

    def test_equipo_justo_da_warn_pero_no_fail(self):
        # 8 GB instalados suelen mostrarse como ~7.5 GB en Windows: debe contar como mínimo cumplido
        res = _requirements(ram_gib=7.5, cores=4, build=19045, disk_free_gib=12)
        data = res.json()
        self.assertEqual(data["overall"], "warn")
        self.assertEqual(_status_of(data, "ram"), "warn")
        self.assertEqual(_status_of(data, "cpu"), "warn")
        self.assertEqual(_status_of(data, "disk"), "warn")
        self.assertEqual(_status_of(data, "os"), "ok")
        self.assertEqual(data["recommendations"]["llm_model"], "qwen3:4b")

    def test_equipo_modesto_falla_y_recomienda_modelos_ligeros(self):
        res = _requirements(ram_gib=4, cores=2, build=17000, disk_free_gib=5)
        data = res.json()
        self.assertEqual(data["overall"], "fail")
        for item_id in ("ram", "cpu", "disk", "os"):
            self.assertEqual(_status_of(data, item_id), "fail", item_id)
        self.assertEqual(data["recommendations"]["whisper_model"], "base")
        self.assertEqual(data["recommendations"]["llm_model"], "qwen3:1.7b")

    def test_arquitectura_arm_falla(self):
        data = _requirements(ram_gib=16, cores=8, build=22631, disk_free_gib=100, machine="ARM64").json()
        self.assertEqual(_status_of(data, "arch"), "fail")
        self.assertEqual(data["overall"], "fail")

    def test_sin_avx2_es_warn(self):
        data = _requirements(ram_gib=16, cores=8, build=22631, disk_free_gib=100, avx2=False).json()
        self.assertEqual(_status_of(data, "avx2"), "warn")

    def test_pocos_nucleos_bajan_whisper_a_base(self):
        data = _requirements(ram_gib=16, cores=2, build=22631, disk_free_gib=100).json()
        self.assertEqual(data["recommendations"]["whisper_model"], "base")

    def test_endpoint_real_sin_mocks_devuelve_estructura_valida(self):
        res = TestClient(app).get("/setup/requirements")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn(data["overall"], ("ok", "warn", "fail"))
        self.assertIn("recommendations", data)
        self.assertGreater(len(data["items"]), 0)


class TestSetupOllamaState(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.addCleanup(app.dependency_overrides.clear)

    def _override_config(self, **values):
        app.dependency_overrides[setup_router.get_config] = lambda: _StubConfig(**values)

    def _tags_response(self, names):
        res = MagicMock()
        res.status_code = 200
        res.json.return_value = {"models": [{"name": n} for n in names]}
        return res

    def test_instalado_en_ejecucion_con_modelo_configurado(self):
        self._override_config(ollama_model="qwen3:4b", ai_provider="local")
        with patch.object(setup_router, "find_ollama_executable", return_value=r"C:\Ollama\ollama.exe"), \
             patch.object(setup_router.requests, "get", return_value=self._tags_response(["qwen3:4b", "llama3:latest"])):
            data = self.client.get("/setup/ollama").json()
        self.assertTrue(data["installed"])
        self.assertEqual(data["path"], r"C:\Ollama\ollama.exe")
        self.assertTrue(data["running"])
        self.assertEqual(data["models"], ["qwen3:4b", "llama3:latest"])
        self.assertEqual(data["configured_model"], "qwen3:4b")
        self.assertTrue(data["configured_model_present"])

    def test_modelo_sin_tag_coincide_con_latest(self):
        self._override_config(ollama_model="phi3")
        with patch.object(setup_router, "find_ollama_executable", return_value="ollama"), \
             patch.object(setup_router.requests, "get", return_value=self._tags_response(["phi3:latest"])):
            data = self.client.get("/setup/ollama").json()
        self.assertTrue(data["configured_model_present"])

    def test_modelo_configurado_ausente(self):
        self._override_config(ollama_model="qwen3:4b")
        with patch.object(setup_router, "find_ollama_executable", return_value="ollama"), \
             patch.object(setup_router.requests, "get", return_value=self._tags_response(["llama3:latest"])):
            data = self.client.get("/setup/ollama").json()
        self.assertTrue(data["running"])
        self.assertFalse(data["configured_model_present"])

    def test_instalado_pero_detenido(self):
        self._override_config(ollama_model="qwen3:4b")
        with patch.object(setup_router, "find_ollama_executable", return_value="ollama"), \
             patch.object(setup_router.requests, "get", side_effect=requests.exceptions.ConnectionError()):
            data = self.client.get("/setup/ollama").json()
        self.assertTrue(data["installed"])
        self.assertFalse(data["running"])
        self.assertEqual(data["models"], [])
        self.assertFalse(data["configured_model_present"])

    def test_no_instalado(self):
        self._override_config(ollama_model="qwen3:4b")
        with patch.object(setup_router, "find_ollama_executable", return_value=None), \
             patch.object(setup_router.requests, "get", side_effect=requests.exceptions.ConnectionError()):
            data = self.client.get("/setup/ollama").json()
        self.assertFalse(data["installed"])
        self.assertIsNone(data["path"])
        self.assertFalse(data["running"])

    def test_find_ollama_usa_path_y_ubicacion_tipica(self):
        with patch.object(setup_router.shutil, "which", return_value=r"C:\bin\ollama.exe"):
            self.assertEqual(setup_router.find_ollama_executable(), r"C:\bin\ollama.exe")

        with patch.object(setup_router.shutil, "which", return_value=None), \
             patch.dict(os.environ, {"LOCALAPPDATA": r"C:\Users\x\AppData\Local"}, clear=False), \
             patch.object(setup_router.os.path, "isfile", side_effect=lambda p: p.endswith(os.path.join("Programs", "Ollama", "ollama.exe"))):
            found = setup_router.find_ollama_executable()
        self.assertTrue(found.endswith(os.path.join("Programs", "Ollama", "ollama.exe")))


class TestSetupOllamaStart(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        setup_router._ollama_proc = None
        setup_router._ollama_proc_started_at = 0.0
        self.addCleanup(setattr, setup_router, "_ollama_proc", None)

    def test_no_instalado_devuelve_404(self):
        with patch.object(setup_router, "find_ollama_executable", return_value=None), \
             patch.object(setup_router.subprocess, "Popen") as popen:
            res = self.client.post("/setup/ollama/start")
        self.assertEqual(res.status_code, 404)
        popen.assert_not_called()

    def test_ya_en_ejecucion_no_lanza_otro_proceso(self):
        with patch.object(setup_router, "find_ollama_executable", return_value="ollama"), \
             patch.object(setup_router, "query_ollama", return_value=(True, [])), \
             patch.object(setup_router.subprocess, "Popen") as popen:
            res = self.client.post("/setup/ollama/start")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "already_running")
        popen.assert_not_called()

    def test_lanza_ollama_serve_oculto(self):
        fake_proc = MagicMock()
        fake_proc.poll.return_value = None
        with patch.object(setup_router, "find_ollama_executable", return_value=r"C:\Ollama\ollama.exe"), \
             patch.object(setup_router, "query_ollama", return_value=(False, [])), \
             patch.object(setup_router.subprocess, "Popen", return_value=fake_proc) as popen:
            res = self.client.post("/setup/ollama/start")
            # Segunda pulsación inmediata: no debe lanzar otra instancia
            res2 = self.client.post("/setup/ollama/start")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "starting")
        self.assertEqual(res2.json()["status"], "starting")
        self.assertEqual(popen.call_count, 1)
        args, kwargs = popen.call_args
        self.assertEqual(args[0], [r"C:\Ollama\ollama.exe", "serve"])
        if sys.platform == "win32":
            self.assertTrue(kwargs["creationflags"] & subprocess.CREATE_NO_WINDOW)

    def test_error_al_lanzar_devuelve_500(self):
        with patch.object(setup_router, "find_ollama_executable", return_value="ollama"), \
             patch.object(setup_router, "query_ollama", return_value=(False, [])), \
             patch.object(setup_router.subprocess, "Popen", side_effect=OSError("boom")):
            res = self.client.post("/setup/ollama/start")
        self.assertEqual(res.status_code, 500)


def _fake_pull_response(lines, status=200):
    resp = MagicMock()
    resp.status_code = status
    resp.iter_lines.return_value = iter(lines)
    resp.__enter__.return_value = resp
    resp.__exit__.return_value = False
    return resp


class TestSetupOllamaPull(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def _pull(self, post_mock, model="qwen3:4b"):
        with patch.object(setup_router, "query_ollama", return_value=(True, [])), \
             patch.object(setup_router.requests, "post", post_mock):
            res = self.client.post("/setup/ollama/pull", json={"model": model})
        return res, [json.loads(line) for line in res.text.splitlines() if line.strip()]

    def test_reenvia_progreso_ndjson_y_termina_en_success(self):
        lines = [
            b'{"status": "pulling manifest"}',
            b'{"status": "pulling abc123", "digest": "sha256:abc123", "total": 2000, "completed": 500}',
            b'{"status": "pulling abc123", "digest": "sha256:abc123", "total": 2000, "completed": 2000}',
            b'{"status": "success"}',
        ]
        post = MagicMock(return_value=_fake_pull_response(lines))
        res, events = self._pull(post)
        self.assertEqual(res.status_code, 200)
        self.assertIn("ndjson", res.headers["content-type"])
        self.assertEqual([e["status"] for e in events][0], "pulling manifest")
        self.assertEqual(events[1]["percent"], 25.0)
        self.assertEqual(events[2]["percent"], 100.0)
        self.assertEqual(events[-1]["status"], "success")
        sent = post.call_args.kwargs["json"]
        self.assertEqual(sent, {"model": "qwen3:4b", "stream": True})

    def test_error_de_ollama_viaja_en_el_stream(self):
        lines = [b'{"status": "pulling manifest"}', b'{"error": "pull model manifest: file does not exist"}']
        _, events = self._pull(MagicMock(return_value=_fake_pull_response(lines)))
        self.assertEqual(events[-1]["status"], "error")
        self.assertIn("file does not exist", events[-1]["error"])

    def test_stream_cortado_sin_success_es_error(self):
        lines = [b'{"status": "pulling manifest"}', b'{"status": "pulling abc", "total": 10, "completed": 3}']
        _, events = self._pull(MagicMock(return_value=_fake_pull_response(lines)))
        self.assertEqual(events[-1]["status"], "error")

    def test_estado_http_distinto_de_200(self):
        _, events = self._pull(MagicMock(return_value=_fake_pull_response([], status=500)))
        self.assertEqual(events[-1]["status"], "error")
        self.assertIn("500", events[-1]["error"])

    def test_conexion_perdida_se_reporta_en_el_stream(self):
        post = MagicMock(side_effect=requests.exceptions.ConnectionError())
        res, events = self._pull(post)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(events[-1]["status"], "error")

    def test_nombre_de_modelo_invalido_400(self):
        with patch.object(setup_router.requests, "post") as post:
            for bad in ("", "../etc/passwd", "a b", "x;rm -rf", "-flag"):
                res = self.client.post("/setup/ollama/pull", json={"model": bad})
                self.assertEqual(res.status_code, 400, bad)
        post.assert_not_called()

    def test_ollama_detenido_503(self):
        with patch.object(setup_router, "query_ollama", return_value=(False, [])), \
             patch.object(setup_router.requests, "post") as post:
            res = self.client.post("/setup/ollama/pull", json={"model": "qwen3:4b"})
        self.assertEqual(res.status_code, 503)
        post.assert_not_called()


class TestSetupWhisper(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        setup_router._whisper_jobs.clear()
        self.addCleanup(setup_router._whisper_jobs.clear)

    def _wait_for(self, model, expected, timeout=3.0):
        deadline = time.time() + timeout
        while time.time() < deadline:
            job = setup_router._whisper_jobs.get(model)
            if job and job["status"] == expected:
                return True
            time.sleep(0.02)
        return False

    def test_modelo_invalido_400(self):
        res = self.client.post("/setup/whisper/download", json={"model": "../../evil"})
        self.assertEqual(res.status_code, 400)
        res = self.client.get("/setup/whisper/status/no-existe")
        self.assertEqual(res.status_code, 400)

    def test_descarga_en_segundo_plano_hasta_downloaded(self):
        calls = []
        with patch.object(setup_router, "_whisper_is_cached", return_value=False), \
             patch.object(setup_router, "_whisper_download", side_effect=lambda m: calls.append(m)):
            res = self.client.post("/setup/whisper/download", json={"model": "base"})
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.json()["status"], "downloading")
            self.assertTrue(self._wait_for("base", "downloaded"))
            status = self.client.get("/setup/whisper/status/base").json()
        self.assertEqual(calls, ["base"])
        self.assertEqual(status["model"], "base")
        self.assertEqual(status["status"], "downloaded")

    def test_status_downloaded_si_esta_en_cache(self):
        with patch.object(setup_router, "_whisper_is_cached", return_value=True):
            self.assertEqual(self.client.get("/setup/whisper/status/small").json()["status"], "downloaded")
            res = self.client.post("/setup/whisper/download", json={"model": "small"})
        self.assertEqual(res.json()["status"], "downloaded")

    def test_status_not_downloaded(self):
        with patch.object(setup_router, "_whisper_is_cached", return_value=False):
            self.assertEqual(self.client.get("/setup/whisper/status/tiny").json()["status"], "not_downloaded")

    def test_error_de_descarga_se_reporta(self):
        with patch.object(setup_router, "_whisper_is_cached", return_value=False), \
             patch.object(setup_router, "_whisper_download", side_effect=RuntimeError("sin red")):
            self.client.post("/setup/whisper/download", json={"model": "small"})
            self.assertTrue(self._wait_for("small", "error"))
            status = self.client.get("/setup/whisper/status/small").json()
        self.assertEqual(status["status"], "error")
        self.assertTrue(status["error"])

    def test_no_lanza_dos_hilos_para_el_mismo_modelo(self):
        gate = []

        def slow_download(model):
            deadline = time.time() + 2
            while not gate and time.time() < deadline:
                time.sleep(0.01)

        with patch.object(setup_router, "_whisper_is_cached", return_value=False), \
             patch.object(setup_router, "_whisper_download", side_effect=slow_download) as dl:
            first = self.client.post("/setup/whisper/download", json={"model": "tiny"}).json()
            second = self.client.post("/setup/whisper/download", json={"model": "tiny"}).json()
            status = self.client.get("/setup/whisper/status/tiny").json()
            gate.append(True)
            self.assertTrue(self._wait_for("tiny", "downloaded"))
        self.assertEqual(first["status"], "downloading")
        self.assertEqual(second["status"], "downloading")
        self.assertEqual(status["status"], "downloading")
        self.assertEqual(dl.call_count, 1)


if __name__ == "__main__":
    unittest.main()
