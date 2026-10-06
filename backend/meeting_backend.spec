# -*- mode: python ; coding: utf-8 -*-
"""
meeting_backend.spec
Congela el backend FastAPI con PyInstaller en modo onedir:
    backend/dist/meeting-backend/meeting-backend.exe  (+ _internal/)

Uso recomendado (desde la raíz del repo):
    node scripts/build-backend.js
Uso directo (desde backend/):
    venv\\Scripts\\python -m PyInstaller meeting_backend.spec --noconfirm --clean

Notas:
- console=True a propósito: Electron lo lanza con windowsHide (CREATE_NO_WINDOW), así que no
  aparece ninguna ventana, y stdout/stderr siguen llegando por pipes a Electron. Con
  console=False sys.stdout sería None y el logging de uvicorn fallaría.
- Los modelos de Whisper NO se empaquetan: faster-whisper los descarga de Hugging Face
  la primera vez que se usan.
- torch, openai-whisper, numba, etc. pueden estar instalados en el venv de desarrollo pero el
  código vivo no los usa: se excluyen para no añadir varios GB.
"""

import glob
import os
import sys

from PyInstaller.utils.hooks import (
    collect_data_files,
    collect_dynamic_libs,
    collect_submodules,
    copy_metadata,
)

BACKEND_DIR = os.path.abspath(SPECPATH)
REPO_DIR = os.path.dirname(BACKEND_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# ─────────────────────────────────────────
# Hotfix de soundcard ANTES de congelar
# ─────────────────────────────────────────
# services/audio_service.py parchea soundcard/mediafoundation.py al importarse. En la app
# instalada la carpeta es de solo lectura (MSIX), así que el parche debe quedar aplicado en el
# venv de build. Importar el módulo lo aplica (idempotente).
import services.audio_service  # noqa: E402,F401
import soundcard.mediafoundation as _mf  # noqa: E402

with open(_mf.__file__, "r", encoding="utf-8") as _f:
    if "# HOTFIX" not in _f.read():
        print("[spec] ADVERTENCIA: soundcard.mediafoundation no contiene el hotfix; revisa la versión de soundcard.")


def _local_modules(*packages):
    """Módulos propios (paquetes namespace sin __init__.py) para incluirlos explícitamente."""
    mods = []
    for pkg in packages:
        for path in glob.glob(os.path.join(BACKEND_DIR, pkg, "**", "*.py"), recursive=True):
            rel = os.path.relpath(path, BACKEND_DIR)[:-3]
            mods.append(rel.replace(os.sep, "."))
    return mods


def _safe_metadata(*dists):
    datas = []
    for dist in dists:
        try:
            datas += copy_metadata(dist)
        except Exception:
            print(f"[spec] Sin metadata para {dist} (no instalado), se omite.")
    return datas


hiddenimports = (
    _local_modules("api", "core", "domain", "services")
    + collect_submodules("uvicorn")
    + [
        "python_multipart",
        "onnxruntime",  # VAD de faster-whisper (import perezoso)
        "hf_xet",       # descargas de Hugging Face más rápidas si está instalado
    ]
)

datas = (
    collect_data_files("faster_whisper")  # assets/silero_vad_v6.onnx
    + collect_data_files("soundcard")     # *.py.h que cffi lee en runtime
    + _safe_metadata(
        "fastapi", "starlette", "pydantic", "uvicorn", "openai", "httpx", "requests",
        "numpy", "tqdm", "huggingface_hub", "tokenizers", "filelock", "packaging",
        "ctranslate2", "faster_whisper", "av", "onnxruntime", "python_multipart",
    )
)

binaries = collect_dynamic_libs("ctranslate2")

excludes = [
    # Instalados en el venv de desarrollo pero no usados por el backend
    "torch", "torchgen", "functorch", "torchvision", "torchaudio",
    "whisper", "numba", "llvmlite", "tiktoken", "pydub", "dotenv",
    "sympy", "mpmath", "networkx",
    # Herramientas / GUI que nunca se usan en runtime
    "tkinter", "_tkinter", "matplotlib", "IPython", "pytest", "_pytest", "PyInstaller",
    "pandas", "scipy", "tensorflow", "transformers",
]

icon_path = os.path.join(REPO_DIR, "frontend", "build", "icon.ico")

a = Analysis(
    [os.path.join(BACKEND_DIR, "main.py")],
    pathex=[BACKEND_DIR],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=excludes,
    noarchive=False,
    optimize=0,
    # soundcard se guarda como .py en disco: su hotfix usa inspect.getsourcefile()
    module_collection_mode={"soundcard": "py"},
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    # Equivalente a "python -u -X utf8": logs sin buffer y en UTF-8 hacia Electron
    [("u", None, "OPTION"), ("X utf8", None, "OPTION")],
    exclude_binaries=True,
    name="meeting-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
    icon=icon_path if os.path.exists(icon_path) else None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name="meeting-backend",
)
