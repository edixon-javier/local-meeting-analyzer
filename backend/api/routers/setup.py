"""
api/routers/setup.py
Asistente de primer arranque (onboarding):
  - GET  /setup/requirements          Comprueba el hardware frente a docs/REQUISITOS.md
  - GET  /setup/ollama                Estado de Ollama (instalado, en ejecución, modelos)
  - POST /setup/ollama/start          Lanza `ollama serve` oculto (devuelve de inmediato)
  - POST /setup/ollama/pull           Descarga un modelo (proxy NDJSON del stream de Ollama)
  - POST /setup/whisper/download      Pre-descarga un modelo Whisper en segundo plano
  - GET  /setup/whisper/status/{m}    Estado de la descarga del modelo Whisper

No añade dependencias nuevas: solo ctypes/stdlib, requests (ya usado) y faster-whisper.
"""

import ctypes
import json
import os
import platform
import re
import shutil
import struct
import subprocess
import sys
import threading
import time
from typing import Any, Dict, Iterator, List, Optional, Tuple

import requests
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from core.config import Config, system_config
from core.paths import get_data_dir

router = APIRouter()

# 127.0.0.1 y no "localhost": en Windows "localhost" se resuelve primero a IPv6 (::1) y, como Ollama
# escucha solo en IPv4, cada petición esperaba ~2 s antes de reintentar por 127.0.0.1.
OLLAMA_BASE_URL = "http://127.0.0.1:11434"

# ── Umbrales (docs/REQUISITOS.md) ──────────────────────────────────────────
MIN_WINDOWS_BUILD = 17763  # Windows 10 1809
MIN_CORES, REC_CORES = 4, 6
MIN_RAM_GB, REC_RAM_GB = 8.0, 16.0
MIN_DISK_GB, REC_DISK_GB = 10.0, 20.0
# Windows descuenta memoria reservada (iGPU, firmware): 8 GB instalados suelen
# aparecer como ~7.4-7.8 GB y 16 GB como ~15.4-15.9 GB.
RAM_SLACK_GB = 0.75

GIB = 1024 ** 3

# Modelos Whisper aceptados (lista estática + los que reporte faster-whisper)
_STATIC_WHISPER_MODELS = {
    "tiny", "tiny.en", "base", "base.en", "small", "small.en", "medium", "medium.en",
    "large", "large-v1", "large-v2", "large-v3", "large-v3-turbo", "turbo",
    "distil-small.en", "distil-medium.en", "distil-large-v2", "distil-large-v3",
}

_OLLAMA_MODEL_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._\-/:]{0,127}$")


def get_config() -> Config:
    return system_config


# ═══════════════════════════════════════════════════════════════════════════
# Requisitos de hardware
# ═══════════════════════════════════════════════════════════════════════════

class _MemoryStatusEx(ctypes.Structure):
    _fields_ = [
        ("dwLength", ctypes.c_ulong),
        ("dwMemoryLoad", ctypes.c_ulong),
        ("ullTotalPhys", ctypes.c_ulonglong),
        ("ullAvailPhys", ctypes.c_ulonglong),
        ("ullTotalPageFile", ctypes.c_ulonglong),
        ("ullAvailPageFile", ctypes.c_ulonglong),
        ("ullTotalVirtual", ctypes.c_ulonglong),
        ("ullAvailVirtual", ctypes.c_ulonglong),
        ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
    ]


def get_memory_bytes() -> Tuple[Optional[int], Optional[int]]:
    """(RAM total, RAM disponible) en bytes. (None, None) si no se puede determinar."""
    if sys.platform == "win32":
        try:
            stat = _MemoryStatusEx()
            stat.dwLength = ctypes.sizeof(_MemoryStatusEx)
            if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat)):
                return int(stat.ullTotalPhys), int(stat.ullAvailPhys)
        except Exception as e:
            print(f"[Setup] GlobalMemoryStatusEx falló: {e}")
    # Fallback POSIX (desarrollo fuera de Windows)
    try:
        page = os.sysconf("SC_PAGE_SIZE")
        total = page * os.sysconf("SC_PHYS_PAGES")
        try:
            avail = page * os.sysconf("SC_AVPHYS_PAGES")
        except (ValueError, OSError):
            avail = None
        return int(total), (int(avail) if avail is not None else None)
    except (AttributeError, ValueError, OSError):
        return None, None


def has_avx2() -> Optional[bool]:
    """True/False si Windows puede informarlo (PF_AVX2_INSTRUCTIONS_AVAILABLE = 40), None si no."""
    if sys.platform != "win32":
        return None
    try:
        return bool(ctypes.windll.kernel32.IsProcessorFeaturePresent(40))
    except Exception:
        return None


def get_windows_build() -> Optional[Tuple[int, int, int]]:
    """(major, minor, build) en Windows; None en otros sistemas."""
    if sys.platform != "win32":
        return None
    try:
        v = sys.getwindowsversion()
        return int(v.major), int(v.minor), int(v.build)
    except Exception:
        return None


def _grade(value: float, minimum: float, recommended: float) -> str:
    if value < minimum:
        return "fail"
    if value < recommended:
        return "warn"
    return "ok"


def _fmt_gb(value: float) -> str:
    return f"{value:.1f}".rstrip("0").rstrip(".") + " GB"


def recommend_models(ram_gb: Optional[float], cores: Optional[int]) -> Dict[str, Any]:
    """Modelos sugeridos según RAM y núcleos (docs/REQUISITOS.md, sección 4)."""
    low_ram = ram_gb is not None and ram_gb + RAM_SLACK_GB < MIN_RAM_GB
    low_cpu = cores is not None and cores < MIN_CORES
    if low_ram:
        whisper, llm = "base", "qwen3:1.7b"
        llm_size, reason = "~1.4 GB", "Tu equipo tiene menos de 8 GB de RAM: te sugerimos modelos ligeros."
    else:
        whisper, llm = "small", "qwen3:4b"
        llm_size, reason = "~2.5 GB", "Tu equipo cumple el mínimo: estos modelos equilibran calidad y velocidad."
    if low_cpu:
        whisper = "base"
        reason = "Tu procesador tiene menos de 4 núcleos: te sugerimos Whisper base para ir más rápido."
    return {
        "whisper_model": whisper,
        "llm_model": llm,
        "live_whisper_model": "tiny",
        "whisper_size": {"tiny": "~75 MB", "base": "~140 MB", "small": "~460 MB"}.get(whisper, ""),
        "llm_size": llm_size,
        "reason": reason,
        "low_ram": low_ram,
    }


def collect_requirements() -> Dict[str, Any]:
    items: List[Dict[str, Any]] = []

    # Sistema operativo
    win = get_windows_build()
    if win is None:
        items.append({
            "id": "os", "label": "Sistema operativo",
            "value": platform.system() or "Desconocido",
            "status": "fail",
            "detail": "La aplicación solo está soportada en Windows 10 (1809 o posterior) y Windows 11.",
        })
    else:
        major, _minor, build = win
        name = "Windows 11" if build >= 22000 else ("Windows 10" if major == 10 else f"Windows {major}")
        ok = build >= MIN_WINDOWS_BUILD
        items.append({
            "id": "os", "label": "Sistema operativo",
            "value": f"{name} (compilación {build})",
            "status": "ok" if ok else "fail",
            "detail": "Versión compatible." if ok else "Se requiere Windows 10 versión 1809 (compilación 17763) o posterior.",
        })

    # Arquitectura
    machine = platform.machine() or "desconocida"
    is_64 = struct.calcsize("P") * 8 == 64
    is_x64 = machine.lower() in ("amd64", "x86_64", "x64")
    arch_ok = is_64 and is_x64
    items.append({
        "id": "arch", "label": "Arquitectura",
        "value": machine,
        "status": "ok" if arch_ok else "fail",
        "detail": "x64 de 64 bits." if arch_ok else "Solo se soporta Windows x64 de 64 bits (no ARM ni 32 bits).",
    })

    # CPU
    cores = os.cpu_count()
    if cores:
        status = _grade(cores, MIN_CORES, REC_CORES)
        detail = {
            "ok": "Procesador adecuado.",
            "warn": f"Cumple el mínimo ({MIN_CORES} núcleos). Con {REC_CORES} o más irá más fluido.",
            "fail": f"Menos de {MIN_CORES} núcleos: la transcripción y el análisis serán lentos.",
        }[status]
        items.append({"id": "cpu", "label": "Procesador", "value": f"{cores} núcleos", "status": status, "detail": detail})

    avx2 = has_avx2()
    if avx2 is not None:
        items.append({
            "id": "avx2", "label": "Instrucciones AVX2",
            "value": "Disponible" if avx2 else "No disponible",
            "status": "ok" if avx2 else "warn",
            "detail": "Necesarias para una transcripción rápida." if avx2
            else "Sin AVX2 la transcripción local puede ir muy lenta o no iniciar. Valora usar OpenAI.",
        })

    # RAM
    total_b, avail_b = get_memory_bytes()
    ram_gb: Optional[float] = None
    if total_b:
        ram_gb = total_b / GIB
        status = _grade(ram_gb + RAM_SLACK_GB, MIN_RAM_GB, REC_RAM_GB)
        detail = {
            "ok": "Memoria suficiente.",
            "warn": f"Cumple el mínimo ({_fmt_gb(MIN_RAM_GB)}). Con {_fmt_gb(REC_RAM_GB)} irá con más holgura.",
            "fail": f"Menos de {_fmt_gb(MIN_RAM_GB)}: usa modelos ligeros y cierra otras aplicaciones.",
        }[status]
        value = _fmt_gb(ram_gb)
        if avail_b:
            value += f" ({_fmt_gb(avail_b / GIB)} libres)"
        items.append({"id": "ram", "label": "Memoria RAM", "value": value, "status": status, "detail": detail})
    else:
        items.append({
            "id": "ram", "label": "Memoria RAM", "value": "No se pudo determinar",
            "status": "warn", "detail": "No pudimos leer la memoria del equipo. Puedes continuar.",
        })

    # Disco
    disk_free_gb: Optional[float] = None
    try:
        disk_free_gb = shutil.disk_usage(get_data_dir()).free / GIB
        status = _grade(disk_free_gb, MIN_DISK_GB, REC_DISK_GB)
        detail = {
            "ok": "Espacio suficiente para modelos y grabaciones.",
            "warn": f"Cumple el mínimo ({_fmt_gb(MIN_DISK_GB)}). Se recomiendan {_fmt_gb(REC_DISK_GB)} libres.",
            "fail": f"Menos de {_fmt_gb(MIN_DISK_GB)} libres: la descarga de modelos puede fallar.",
        }[status]
        items.append({
            "id": "disk", "label": "Espacio libre en disco",
            "value": _fmt_gb(disk_free_gb), "status": status, "detail": detail,
        })
    except Exception as e:
        print(f"[Setup] No se pudo leer el espacio en disco: {e}")
        items.append({
            "id": "disk", "label": "Espacio libre en disco", "value": "No se pudo determinar",
            "status": "warn", "detail": "No pudimos leer el espacio libre. Puedes continuar.",
        })

    statuses = {i["status"] for i in items}
    overall = "fail" if "fail" in statuses else ("warn" if "warn" in statuses else "ok")

    return {
        "items": items,
        "overall": overall,
        "recommendations": recommend_models(ram_gb, cores),
        "hardware": {
            "ram_total_gb": round(ram_gb, 2) if ram_gb is not None else None,
            "cpu_cores": cores,
            "windows_build": win[2] if win else None,
            "disk_free_gb": round(disk_free_gb, 2) if disk_free_gb is not None else None,
            "machine": machine,
        },
    }


@router.get("/setup/requirements")
def get_requirements():
    """Comprueba el equipo frente a los requisitos y sugiere modelos."""
    return collect_requirements()


# ═══════════════════════════════════════════════════════════════════════════
# Ollama
# ═══════════════════════════════════════════════════════════════════════════

_ollama_proc: Optional[subprocess.Popen] = None
_ollama_proc_started_at = 0.0
_ollama_start_lock = threading.Lock()


def find_ollama_executable() -> Optional[str]:
    """Ruta a ollama.exe si está instalado (PATH o ubicaciones típicas de Windows)."""
    found = shutil.which("ollama")
    if found:
        return found
    candidates = []
    local = os.environ.get("LOCALAPPDATA")
    if local:
        candidates.append(os.path.join(local, "Programs", "Ollama", "ollama.exe"))
    for var in ("ProgramFiles", "ProgramFiles(x86)"):
        base = os.environ.get(var)
        if base:
            candidates.append(os.path.join(base, "Ollama", "ollama.exe"))
    for path in candidates:
        if os.path.isfile(path):
            return path
    return None


def _normalize_model(name: str) -> str:
    name = (name or "").strip().lower()
    return name if ":" in name else f"{name}:latest"


def query_ollama() -> Tuple[bool, List[str]]:
    """(en ejecución, modelos instalados) consultando /api/tags con timeout corto."""
    try:
        res = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=1.5)
        if res.status_code != 200:
            return False, []
        models = [m["name"] for m in res.json().get("models", []) if isinstance(m, dict) and "name" in m]
        return True, models
    except Exception:
        return False, []


@router.get("/setup/ollama")
def get_ollama_state(config: Config = Depends(get_config)):
    """Estado de Ollama y del modelo configurado."""
    path = find_ollama_executable()
    running, models = query_ollama()
    configured = str(config.get("ollama_model", "") or "")
    present = bool(configured) and _normalize_model(configured) in {_normalize_model(m) for m in models}
    return {
        "installed": bool(path) or running,
        "path": path,
        "running": running,
        "models": models,
        "configured_model": configured,
        "configured_model_present": present,
        "ai_provider": config.get("ai_provider", "local"),
    }


@router.post("/setup/ollama/start")
def start_ollama():
    """Lanza `ollama serve` oculto si está instalado y no está en ejecución. Retorna de inmediato."""
    global _ollama_proc, _ollama_proc_started_at

    path = find_ollama_executable()
    if not path:
        raise HTTPException(status_code=404, detail="Ollama no está instalado en este equipo.")

    running, _ = query_ollama()
    if running:
        return {"status": "already_running", "path": path}

    with _ollama_start_lock:
        # Evita lanzar varias instancias si el usuario pulsa el botón repetidamente
        if _ollama_proc is not None and _ollama_proc.poll() is None and (time.time() - _ollama_proc_started_at) < 30:
            return {"status": "starting", "path": path}

        kwargs: Dict[str, Any] = {
            "stdin": subprocess.DEVNULL,
            "stdout": subprocess.DEVNULL,
            "stderr": subprocess.DEVNULL,
            "close_fds": True,
        }
        if sys.platform == "win32":
            kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW | subprocess.CREATE_NEW_PROCESS_GROUP
        try:
            _ollama_proc = subprocess.Popen([path, "serve"], **kwargs)
            _ollama_proc_started_at = time.time()
        except OSError as e:
            raise HTTPException(status_code=500, detail=f"No se pudo iniciar Ollama: {e}")
    return {"status": "starting", "path": path}


class PullRequest(BaseModel):
    model: str


def _ndjson(obj: Dict[str, Any]) -> str:
    return json.dumps(obj, ensure_ascii=False) + "\n"


def _pull_stream(model: str) -> Iterator[str]:
    """Proxy del stream NDJSON de /api/pull. Los errores viajan dentro del stream."""
    saw_success = False
    try:
        with requests.post(
            f"{OLLAMA_BASE_URL}/api/pull",
            json={"model": model, "stream": True},
            stream=True,
            timeout=(5, 300),
        ) as resp:
            if resp.status_code != 200:
                yield _ndjson({"status": "error", "error": f"Ollama respondió con error {resp.status_code} al descargar '{model}'."})
                return
            for raw in resp.iter_lines():
                if not raw:
                    continue
                line = raw.decode("utf-8", errors="replace") if isinstance(raw, (bytes, bytearray)) else str(raw)
                try:
                    data = json.loads(line)
                except ValueError:
                    continue
                if not isinstance(data, dict):
                    continue
                if data.get("error"):
                    yield _ndjson({"status": "error", "error": str(data["error"])})
                    return
                total, completed = data.get("total"), data.get("completed")
                if isinstance(total, (int, float)) and total > 0 and isinstance(completed, (int, float)):
                    data["percent"] = max(0.0, min(100.0, round(completed * 100.0 / total, 1)))
                if data.get("status") == "success":
                    saw_success = True
                yield _ndjson(data)
        if not saw_success:
            yield _ndjson({"status": "error", "error": "La descarga se interrumpió antes de terminar. Inténtalo de nuevo."})
    except requests.exceptions.ConnectionError:
        yield _ndjson({"status": "error", "error": "Se perdió la conexión con Ollama (127.0.0.1:11434)."})
    except requests.exceptions.Timeout:
        yield _ndjson({"status": "error", "error": "Ollama dejó de responder durante la descarga."})
    except Exception as e:
        yield _ndjson({"status": "error", "error": f"Error inesperado al descargar el modelo: {e}"})


@router.post("/setup/ollama/pull")
def pull_ollama_model(request: PullRequest):
    """Descarga un modelo en Ollama y reenvía el progreso como NDJSON ({status,total,completed,percent})."""
    model = (request.model or "").strip()
    if not _OLLAMA_MODEL_RE.match(model):
        raise HTTPException(status_code=400, detail="Nombre de modelo no válido.")
    running, _ = query_ollama()
    if not running:
        raise HTTPException(status_code=503, detail="Ollama no está en ejecución. Inícialo antes de descargar modelos.")
    return StreamingResponse(_pull_stream(model), media_type="application/x-ndjson")


# ═══════════════════════════════════════════════════════════════════════════
# Whisper (pre-descarga)
# ═══════════════════════════════════════════════════════════════════════════

_whisper_jobs: Dict[str, Dict[str, Any]] = {}
_whisper_lock = threading.Lock()


def _valid_whisper_models() -> set:
    models = set(_STATIC_WHISPER_MODELS)
    try:
        from faster_whisper.utils import available_models
        models.update(available_models())
    except Exception:
        pass
    return models


def _check_whisper_model(model: str) -> str:
    model = (model or "").strip()
    if model not in _valid_whisper_models():
        raise HTTPException(status_code=400, detail=f"Modelo Whisper no válido: '{model}'.")
    return model


def _whisper_is_cached(model: str) -> bool:
    try:
        from faster_whisper.utils import download_model
        download_model(model, local_files_only=True)
        return True
    except Exception:
        return False


def _whisper_download(model: str) -> None:
    from faster_whisper.utils import download_model
    download_model(model)


def _whisper_worker(model: str) -> None:
    try:
        _whisper_download(model)
        with _whisper_lock:
            _whisper_jobs[model] = {"status": "downloaded", "error": None}
    except Exception as e:
        print(f"[Setup] Error al descargar el modelo Whisper '{model}': {e}")
        with _whisper_lock:
            _whisper_jobs[model] = {
                "status": "error",
                "error": "No se pudo descargar el modelo. Comprueba tu conexión a internet y el espacio en disco.",
            }


class WhisperDownloadRequest(BaseModel):
    model: str


def _whisper_status(model: str) -> Dict[str, Any]:
    with _whisper_lock:
        job = _whisper_jobs.get(model)
        if job:
            return {"model": model, "status": job["status"], "error": job.get("error")}
    if _whisper_is_cached(model):
        return {"model": model, "status": "downloaded", "error": None}
    return {"model": model, "status": "not_downloaded", "error": None}


@router.post("/setup/whisper/download")
def download_whisper_model(request: WhisperDownloadRequest):
    """Inicia la pre-descarga del modelo Whisper en un hilo y retorna de inmediato."""
    model = _check_whisper_model(request.model)

    with _whisper_lock:
        job = _whisper_jobs.get(model)
        if job and job["status"] == "downloading":
            return {"model": model, "status": "downloading", "error": None}

    if _whisper_is_cached(model):
        return {"model": model, "status": "downloaded", "error": None}

    with _whisper_lock:
        job = _whisper_jobs.get(model)
        if job and job["status"] == "downloading":
            return {"model": model, "status": "downloading", "error": None}
        _whisper_jobs[model] = {"status": "downloading", "error": None}

    threading.Thread(target=_whisper_worker, args=(model,), name=f"whisper-dl-{model}", daemon=True).start()
    return {"model": model, "status": "downloading", "error": None}


@router.get("/setup/whisper/status/{model}")
def get_whisper_status(model: str):
    """downloaded | downloading | not_downloaded | error."""
    return _whisper_status(_check_whisper_model(model))
