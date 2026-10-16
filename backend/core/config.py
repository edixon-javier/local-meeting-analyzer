import os
import json
from typing import Dict, Any

from core.paths import get_config_path

# En desarrollo: backend/config.json. Empaquetado: <MEETING_ANALYZER_DATA_DIR>/config.json
CONFIG_PATH = get_config_path()

# Modelo de Ollama por defecto: Apache-2.0, buen español, ~2.5 GB
DEFAULT_OLLAMA_MODEL = "qwen3:4b"

# Carácter usado para ocultar la clave de API en las respuestas de la API
API_KEY_MASK_CHAR = "•"


def mask_api_key(key: Any) -> str:
    """'sk-abc...wxyz' -> '••••••••wxyz'. Cadena vacía si no hay clave."""
    if not key or not isinstance(key, str):
        return ""
    key = key.strip()
    if not key:
        return ""
    tail = key[-4:] if len(key) >= 12 else ""
    return API_KEY_MASK_CHAR * 8 + tail


def is_masked_api_key(value: Any) -> bool:
    """True si el valor es un enmascarado devuelto por GET /config (nunca una clave real)."""
    return isinstance(value, str) and API_KEY_MASK_CHAR in value


class Config:
    def __init__(self, config_path: str = None):
        self._config_path = config_path or CONFIG_PATH
        self._default_config = {
            "whisper_model": "small",
            "ollama_model": DEFAULT_OLLAMA_MODEL,
            "ai_provider": "local",
            "openai_api_key": "",
            "openai_model": "gpt-4o",
            "anthropic_api_key": "",
            "claude_model": "claude-3-5-haiku-20241022",
            "gemini_api_key": "",
            "gemini_model": "gemini-2.0-flash",
            # Privacidad: solo se usa la nube si el usuario lo eligió (ai_provider in ["openai", "claude", "gemini"])
            # o activó explícitamente este respaldo cuando Ollama no está disponible.
            "allow_cloud_fallback": False,
            "analysis_focus": "",
            "record_mode": "both",
            "mic_device_id": "default",
            "diarize": False,
            "groq_api_key": "",
            "dictation_mode": "smart_polish",
            "dictation_shortcut": "CommandOrControl+Shift+D",
            # Privacidad: el dictado se transcribe en el equipo salvo que el usuario elija Groq u OpenAI
            "dictation_provider": "local",
        }
        self.settings: Dict[str, Any] = self._load_config()

    def _load_config(self) -> Dict[str, Any]:
        if not os.path.exists(self._config_path):
            self._save_to_disk(self._default_config)
            return self._default_config.copy()
        try:
            with open(self._config_path, "r", encoding="utf-8") as f:
                config = json.load(f)
                # Ensure all default keys exist (claves nuevas en configuraciones antiguas)
                for k, v in self._default_config.items():
                    if k not in config:
                        config[k] = v
                return config
        except Exception as e:
            print(f"[Core Config] Error loading config.json: {e}")
            return self._default_config.copy()

    def _save_to_disk(self, config_dict: Dict[str, Any]):
        try:
            with open(self._config_path, "w", encoding="utf-8") as f:
                json.dump(config_dict, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[Core Config] Error saving config: {e}")

    def get(self, key: str, default: Any = None) -> Any:
        return self.settings.get(key, default)

    def set(self, key: str, value: Any):
        self.settings[key] = value

    def update(self, new_config: Dict[str, Any]):
        self.settings.update(new_config)

    def save(self):
        self._save_to_disk(self.settings)

    def public_settings(self) -> Dict[str, Any]:
        """Copia de la configuración apta para enviar a la UI: las claves de API van enmascaradas."""
        public = dict(self.settings)
        # OpenAI
        open_key = public.get("openai_api_key", "")
        public["has_api_key"] = bool(open_key)
        public["has_openai_key"] = bool(open_key)
        public["openai_api_key"] = mask_api_key(open_key)
        # Claude (Anthropic)
        claude_key = public.get("anthropic_api_key", "")
        public["has_claude_key"] = bool(claude_key)
        public["anthropic_api_key"] = mask_api_key(claude_key)
        # Gemini (Google)
        gemini_key = public.get("gemini_api_key", "")
        public["has_gemini_key"] = bool(gemini_key)
        public["gemini_api_key"] = mask_api_key(gemini_key)
        # Groq
        groq_key = public.get("groq_api_key", "")
        public["has_groq_key"] = bool(groq_key)
        public["groq_api_key"] = mask_api_key(groq_key)
        return public

# Singleton instance for app-wide configuration
system_config = Config()
