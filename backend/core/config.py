import os
import json
from typing import Dict, Any

CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config.json")

class Config:
    def __init__(self):
        self._default_config = {
            "whisper_model": "small",
            "ollama_model": "phi3",
            "ai_provider": "local",
            "openai_api_key": "",
            "openai_model": "gpt-4o-mini",
            "analysis_focus": "",
            "record_mode": "both",
            "mic_device_id": "default",
            "diarize": False
        }
        self.settings: Dict[str, Any] = self._load_config()

    def _load_config(self) -> Dict[str, Any]:
        if not os.path.exists(CONFIG_PATH):
            self._save_to_disk(self._default_config)
            return self._default_config.copy()
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                config = json.load(f)
                # Ensure all default keys exist
                for k, v in self._default_config.items():
                    if k not in config:
                        config[k] = v
                return config
        except Exception as e:
            print(f"[Core Config] Error loading config.json: {e}")
            return self._default_config.copy()

    def _save_to_disk(self, config_dict: Dict[str, Any]):
        try:
            with open(CONFIG_PATH, "w", encoding="utf-8") as f:
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

# Singleton instance for app-wide configuration
system_config = Config()
