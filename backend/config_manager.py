import os
import json

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.json")

def load_config():
    default_config = {
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
    if not os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "w", encoding="utf-8") as f:
                json.dump(default_config, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[Backend] Error escribiendo config por defecto: {e}")
        return default_config
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            config = json.load(f)
            # Asegurar claves existentes
            for k, v in default_config.items():
                if k not in config:
                    config[k] = v
            return config
    except Exception as e:
        print(f"[Backend] Error cargando config.json: {e}")
        return default_config

def save_config(config):
    try:
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[Backend] Error al guardar config: {e}")

def save_meeting_metadata(audio_path, transcript, analysis, language=None, segments=None):
    if not audio_path:
        return
    json_path = audio_path.replace(".wav", ".json")
    metadata = {
        "filename": os.path.basename(audio_path),
        "audio_path": audio_path,
        "transcript": transcript,
        "analysis": analysis,
        "language": language,
        "segments": segments,
        "created": os.path.getctime(audio_path) if os.path.exists(audio_path) else None
    }
    try:
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
        print(f"[Backend] Metadatos guardados en {json_path}")
    except Exception as e:
        print(f"[Backend] Error al guardar metadatos: {e}")
