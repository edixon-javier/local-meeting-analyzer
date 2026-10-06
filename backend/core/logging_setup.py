"""
core/logging_setup.py
Registro (logs) local del backend. Nada se envía a ningún servidor: solo se escribe en
<carpeta de datos>/logs/backend.log (rotación 1 MB x 5 archivos).

- Captura sys.stdout / sys.stderr (los print() existentes y la salida de uvicorn) con un
  "tee": la salida sigue yendo a la consola si existe y además se copia al archivo.
- Enmascara claves de API (sk-...) en todo lo que se escribe.
- Registra las excepciones no controladas (sys.excepthook, hilos y manejador de FastAPI).
- NUNCA se registra texto de transcripciones ni claves.
"""

import io
import logging
import logging.handlers
import os
import platform
import re
import sys
import threading
from typing import Optional

from core.paths import get_data_dir, get_ffmpeg_path, get_logs_dir, is_frozen
from core.version import APP_NAME, APP_VERSION

LOG_FILE_NAME = "backend.log"
MAX_LOG_BYTES = 1024 * 1024  # 1 MB
BACKUP_COUNT = 5
LOG_FORMAT = "%(asctime)s %(levelname)-8s [%(name)s] %(message)s"

_SECRET_RE = re.compile(r"sk-[A-Za-z0-9_-]{8,}")
SECRET_MASK = "sk-***"
_ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")  # colores de uvicorn en consolas interactivas
_MAX_PENDING_CHARS = 8192

# Líneas de acceso de uvicorn por sondeo periódico de la UI (cada pocos segundos): se muestran
# en la consola pero no se guardan en el archivo, para que la rotación no borre el historial útil.
_NOISE_RE = re.compile(
    r'"(?:GET (?:/status|/session|/status/ollama-models|/recording/test/levels|/recording/bookmarks)'
    r'(?:\?\S*)?|OPTIONS \S+) HTTP/[\d.]+" 2\d\d'
)

# Librerías que registran una línea INFO por cada petición HTTP (el heartbeat de Ollama cada 12 s).
_NOISY_LOGGERS = ("httpx", "httpcore", "urllib3", "multipart", "asyncio")

# Loggers dedicados a la captura de stdout/stderr: no propagan al root para no duplicar
# la salida en la consola (el tee ya la escribe en el stream original).
_STDOUT_LOGGER = "stdout"
_STDERR_LOGGER = "stderr"

_state = {
    "configured": False,
    "file_handler": None,
    "console_handler": None,
    "orig_stdout": None,
    "orig_stderr": None,
    "orig_excepthook": None,
    "orig_threading_hook": None,
    "log_path": None,
}


def mask_secrets(text: str) -> str:
    """Reemplaza cualquier clave tipo sk-xxxxxxxx por sk-***."""
    if not text:
        return text
    return _SECRET_RE.sub(SECRET_MASK, text)


class SecretMaskingFilter(logging.Filter):
    """Filtro que enmascara claves de API en el mensaje y en sus argumentos."""

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            message = record.getMessage()
        except Exception:
            return True
        masked = mask_secrets(message)
        if masked != message:
            record.msg = masked
            record.args = None
        return True


class _MaskingFormatter(logging.Formatter):
    """Segunda barrera: enmascara también los tracebacks ya formateados."""

    def format(self, record: logging.LogRecord) -> str:
        return mask_secrets(super().format(record))


class _TeeStream(io.TextIOBase):
    """Reemplazo de sys.stdout / sys.stderr: copia cada línea al log y al stream original."""

    def __init__(self, original, logger_name: str):
        super().__init__()
        self._original = original
        self._logger = logging.getLogger(logger_name)
        self._buffer = ""
        self._lock = threading.Lock()

    # --- Delegación al stream original -------------------------------------------------
    @property
    def encoding(self):  # type: ignore[override]
        return getattr(self._original, "encoding", None) or "utf-8"

    @property
    def errors(self):  # type: ignore[override]
        return getattr(self._original, "errors", None) or "replace"

    def isatty(self) -> bool:
        try:
            return bool(self._original and self._original.isatty())
        except Exception:
            return False

    def fileno(self) -> int:
        if self._original is None:
            raise io.UnsupportedOperation("fileno")
        return self._original.fileno()

    def __getattr__(self, name):
        # Atributos que no definimos (buffer, reconfigure, name...) se resuelven en el stream original
        original = self.__dict__.get("_original")
        if original is None:
            raise AttributeError(name)
        return getattr(original, name)

    def writable(self) -> bool:
        return True

    def readable(self) -> bool:
        return False

    def flush(self) -> None:
        if self._original is not None:
            try:
                self._original.flush()
            except Exception:
                pass

    # --- Escritura ---------------------------------------------------------------------
    def write(self, data) -> int:
        if isinstance(data, (bytes, bytearray)):
            data = bytes(data).decode("utf-8", errors="replace")
        elif not isinstance(data, str):
            data = str(data)
        if not data:
            return 0

        if self._original is not None:
            try:
                self._original.write(data)
            except UnicodeEncodeError:
                try:
                    self._original.write(data.encode("ascii", errors="replace").decode("ascii"))
                except Exception:
                    pass
            except Exception:
                pass

        lines = []
        with self._lock:
            self._buffer += data
            while "\n" in self._buffer:
                line, self._buffer = self._buffer.split("\n", 1)
                # Barras de progreso (tqdm) reescriben la línea con "\r": solo cuenta el último estado
                line = line.rstrip("\r").rsplit("\r", 1)[-1]
                lines.append(_ANSI_RE.sub("", line))
            if len(self._buffer) > _MAX_PENDING_CHARS:
                # Sin salto de línea durante mucho rato (progreso continuo): no acumular sin límite
                lines.append(_ANSI_RE.sub("", self._buffer.rsplit("\r", 1)[-1]))
                self._buffer = ""
        for line in lines:
            if line.strip() and not _NOISE_RE.search(line):
                try:
                    self._logger.info(line)
                except Exception:
                    pass
        return len(data)


def _install_excepthooks() -> None:
    unhandled = logging.getLogger("unhandled")

    def _excepthook(exc_type, exc_value, exc_tb):
        if issubclass(exc_type, KeyboardInterrupt):
            sys.__excepthook__(exc_type, exc_value, exc_tb)
            return
        unhandled.critical("Excepción no controlada", exc_info=(exc_type, exc_value, exc_tb))

    def _thread_hook(args):
        if args.exc_type is SystemExit:
            return
        name = args.thread.name if args.thread else "desconocido"
        unhandled.error(
            "Excepción no controlada en el hilo '%s'", name,
            exc_info=(args.exc_type, args.exc_value, args.exc_traceback),
        )

    _state["orig_excepthook"] = sys.excepthook
    _state["orig_threading_hook"] = getattr(threading, "excepthook", None)
    sys.excepthook = _excepthook
    threading.excepthook = _thread_hook


def setup_logging(
    log_dir: Optional[str] = None,
    capture_streams: bool = True,
    level: int = logging.INFO,
) -> str:
    """
    Configura el log rotativo del backend. Es idempotente.
    Devuelve la ruta del archivo de log.
    """
    if _state["configured"]:
        return _state["log_path"]

    directory = log_dir or get_logs_dir()
    os.makedirs(directory, exist_ok=True)
    log_path = os.path.join(directory, LOG_FILE_NAME)

    mask_filter = SecretMaskingFilter()
    formatter = _MaskingFormatter(LOG_FORMAT)

    file_handler = logging.handlers.RotatingFileHandler(
        log_path, maxBytes=MAX_LOG_BYTES, backupCount=BACKUP_COUNT, encoding="utf-8"
    )
    file_handler.setFormatter(formatter)
    file_handler.addFilter(mask_filter)

    root = logging.getLogger()
    root.setLevel(level)
    root.addHandler(file_handler)
    for noisy in _NOISY_LOGGERS:
        logging.getLogger(noisy).setLevel(logging.WARNING)

    orig_stdout, orig_stderr = sys.stdout, sys.stderr
    _state.update(
        configured=True,
        file_handler=file_handler,
        orig_stdout=orig_stdout,
        orig_stderr=orig_stderr,
        log_path=log_path,
    )

    # Con consola: los logs de librerías (root) también se ven en la consola.
    # Escribe en el stream original, no en el tee, para no duplicar líneas.
    if orig_stderr is not None:
        console_handler = logging.StreamHandler(orig_stderr)
        console_handler.setFormatter(_MaskingFormatter("%(levelname)s [%(name)s] %(message)s"))
        console_handler.addFilter(mask_filter)
        root.addHandler(console_handler)
        _state["console_handler"] = console_handler

    if capture_streams:
        for name in (_STDOUT_LOGGER, _STDERR_LOGGER):
            stream_logger = logging.getLogger(name)
            stream_logger.setLevel(logging.INFO)
            stream_logger.propagate = False
            stream_logger.addHandler(file_handler)
        sys.stdout = _TeeStream(orig_stdout, _STDOUT_LOGGER)
        sys.stderr = _TeeStream(orig_stderr, _STDERR_LOGGER)

    _install_excepthooks()
    return log_path


def teardown_logging() -> None:
    """Revierte setup_logging (pensado para las pruebas)."""
    if not _state["configured"]:
        return
    root = logging.getLogger()
    for key in ("file_handler", "console_handler"):
        handler = _state.get(key)
        if handler is not None:
            root.removeHandler(handler)
            for name in (_STDOUT_LOGGER, _STDERR_LOGGER):
                logging.getLogger(name).removeHandler(handler)
            if key == "file_handler":
                handler.close()
    if isinstance(sys.stdout, _TeeStream):
        sys.stdout = _state["orig_stdout"]
    if isinstance(sys.stderr, _TeeStream):
        sys.stderr = _state["orig_stderr"]
    if _state["orig_excepthook"] is not None:
        sys.excepthook = _state["orig_excepthook"]
    if _state["orig_threading_hook"] is not None:
        threading.excepthook = _state["orig_threading_hook"]
    _state.update(
        configured=False, file_handler=None, console_handler=None, log_path=None,
        orig_stdout=None, orig_stderr=None, orig_excepthook=None, orig_threading_hook=None,
    )


def log_startup_banner() -> None:
    """Cabecera de arranque: versión, modo empaquetado, carpeta de datos y ffmpeg."""
    log = logging.getLogger("startup")
    log.info("=" * 60)
    log.info("%s - backend v%s", APP_NAME, APP_VERSION)
    log.info("Empaquetado (frozen): %s", is_frozen())
    log.info("Python %s en %s", platform.python_version(), platform.platform())
    log.info("Carpeta de datos: %s", get_data_dir())
    log.info("ffmpeg: %s", get_ffmpeg_path())
    log.info("=" * 60)
