"""
core/paths.py
Rutas centralizadas del backend: datos del usuario (config, grabaciones, logs)
y binarios empaquetados (ffmpeg).

Contrato:
- MEETING_ANALYZER_DATA_DIR: si está definida (Electron la fija a app.getPath('userData')
  en modo empaquetado), config.json, recordings/ y logs/ viven dentro de esa carpeta.
- Sin la variable, en desarrollo se conservan las ubicaciones históricas
  (backend/config.json, backend/recordings, backend/logs). Si el backend corre
  congelado (PyInstaller) sin la variable, se usa %APPDATA%/Local Meeting Analyzer,
  porque la carpeta de instalación puede ser de solo lectura (MSIX).
- MEETING_ANALYZER_BIN_DIR: carpeta opcional con ffmpeg.exe empaquetado. Si no está
  definida se usa <raíz>/bin, y en última instancia "ffmpeg" del PATH.

Las carpetas se crean bajo demanda al consultarlas.
"""

import os
import sys

DATA_DIR_ENV = "MEETING_ANALYZER_DATA_DIR"
BIN_DIR_ENV = "MEETING_ANALYZER_BIN_DIR"
APP_DIR_NAME = "Local Meeting Analyzer"


def is_frozen() -> bool:
    """True si el backend corre como ejecutable congelado (PyInstaller)."""
    return bool(getattr(sys, "frozen", False))


def _ensure_dir(path: str) -> str:
    try:
        os.makedirs(path, exist_ok=True)
    except OSError as e:
        print(f"[Paths] No se pudo crear la carpeta {path}: {e}")
    return path


def get_backend_dir() -> str:
    """Carpeta del código (desarrollo) o del ejecutable congelado."""
    if is_frozen():
        return os.path.dirname(os.path.abspath(sys.executable))
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def get_root_dir() -> str:
    """
    Raíz de la instalación o del repositorio.
    - Desarrollo: raíz del repo (padre de backend/).
    - Congelado: carpeta resources/ de Electron (padre de resources/backend/).
    """
    backend_dir = get_backend_dir()
    if is_frozen() and os.path.basename(backend_dir).lower() != "backend":
        return backend_dir
    return os.path.dirname(backend_dir)


def get_data_dir() -> str:
    """Carpeta escribible para los datos del usuario."""
    env_dir = os.environ.get(DATA_DIR_ENV, "").strip()
    if env_dir:
        return _ensure_dir(os.path.abspath(os.path.expanduser(env_dir)))
    if is_frozen():
        base = os.environ.get("APPDATA") or os.path.expanduser("~")
        return _ensure_dir(os.path.join(base, APP_DIR_NAME))
    return get_backend_dir()


def get_config_path() -> str:
    return os.path.join(get_data_dir(), "config.json")


def get_recordings_dir() -> str:
    return _ensure_dir(os.path.join(get_data_dir(), "recordings"))


def get_dictations_dir() -> str:
    """Carpeta para audios y metadatos de dictados en cursor."""
    return _ensure_dir(os.path.join(get_recordings_dir(), "dictations"))


def get_logs_dir() -> str:
    return _ensure_dir(os.path.join(get_data_dir(), "logs"))


def get_bin_dir() -> str:
    """Carpeta de binarios empaquetados (ffmpeg). Puede no existir."""
    env_dir = os.environ.get(BIN_DIR_ENV, "").strip()
    if env_dir:
        return os.path.abspath(env_dir)
    return os.path.join(get_root_dir(), "bin")


def get_ffmpeg_path() -> str:
    """Ruta a ffmpeg empaquetado; si no existe, se confía en el PATH del sistema."""
    exe_name = "ffmpeg.exe" if sys.platform == "win32" else "ffmpeg"
    local_ffmpeg = os.path.join(get_bin_dir(), exe_name)
    if os.path.exists(local_ffmpeg):
        return local_ffmpeg
    return "ffmpeg"
