from audio_capture import AudioCapture
from transcriber import Transcriber
from analyzer import Analyzer
from config_manager import load_config

# Cargar configuración inicial
system_config = load_config()

# Instancias globales (singleton)
audio_capture = AudioCapture()
transcriber = Transcriber(model_name=system_config["whisper_model"])
analyzer = Analyzer(model=system_config["ollama_model"])
analyzer.set_config(system_config)
transcriber.set_config(system_config)

# Estado global de la sesión actual
session_state = {
    "recording": False,
    "audio_path": None,
    "transcript": None,
    "analysis": None,
    "processing": False
}
