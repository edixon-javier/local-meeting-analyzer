import os
from typing import Optional, Dict, Any
from faster_whisper import WhisperModel
from domain.interfaces import ITranscriber
from core.config import Config

# Variable global for tracking progress inside the process
_transcription_progress = 0.0

class TranscriptionService(ITranscriber):
    def __init__(self, config: Config):
        self._model_instance = None
        self._current_model_name = None
        self.ai_provider = config.get("ai_provider", "local")
        self.openai_api_key = config.get("openai_api_key", "")
        self.openai_client = None
        self._model_name = config.get("whisper_model", "small")
        self._setup_openai()
        # Defer loading: only load if ai_provider is local
        if self.ai_provider == "local":
            self._ensure_model_loaded()

    @property
    def model_name(self) -> str:
        return self._model_name

    def set_config(self, config: Config):
        self.ai_provider = config.get("ai_provider", self.ai_provider)
        self.openai_api_key = config.get("openai_api_key", self.openai_api_key)
        self._setup_openai()
        # If switched to local, make sure it gets loaded
        if self.ai_provider == "local":
            self._ensure_model_loaded()

    def set_model(self, model_name: str):
        if self._model_name != model_name:
            self._model_name = model_name
            if self.ai_provider == "local":
                self._ensure_model_loaded()

    def _setup_openai(self):
        if self.ai_provider == "openai" and self.openai_api_key:
            try:
                import openai
                self.openai_client = openai.OpenAI(api_key=self.openai_api_key)
            except ImportError:
                print("[TranscriptionService] Error: módulo openai no está instalado.")

    def _ensure_model_loaded(self):
        if self.ai_provider == "openai":
            return
        if self._model_instance is None or self._current_model_name != self._model_name:
            print(f"[TranscriptionService] Cargando modelo faster-whisper '{self._model_name}' en CPU (int8)...")
            self._model_instance = WhisperModel(self._model_name, device="cpu", compute_type="int8")
            self._current_model_name = self._model_name
            print(f"[TranscriptionService] Modelo '{self._model_name}' listo.")

    def get_progress(self) -> float:
        global _transcription_progress
        return _transcription_progress

    def transcribe(self, audio_path: str, language: Optional[str] = None) -> Dict[str, Any]:
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Archivo de audio no encontrado: {audio_path}")

        print(f"[TranscriptionService] Transcribiendo: {audio_path} usando {self.ai_provider}")
        
        global _transcription_progress
        _transcription_progress = 0.0

        if self.ai_provider == "openai":
            return self._transcribe_openai(audio_path, language)
        else:
            self._ensure_model_loaded()
            return self._transcribe_local(audio_path, language)

    def _transcribe_openai(self, audio_path: str, language: Optional[str]) -> Dict[str, Any]:
        if not self.openai_client:
            raise RuntimeError("El cliente de OpenAI no está configurado (API Key faltante).")
        
        global _transcription_progress
        with open(audio_path, "rb") as audio_file:
            response = self.openai_client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="verbose_json",
                language=language
            )
        
        _transcription_progress = 100.0
        text = response.text
        segments = []
        if hasattr(response, "segments") and response.segments:
            for seg in response.segments:
                segments.append({
                    "start": seg.start,
                    "end": seg.end,
                    "text": seg.text.strip()
                })
        else:
            segments = [{"start": 0.0, "end": 0.0, "text": text}]
            
        return {
            "text": text,
            "segments": segments,
            "language": getattr(response, "language", language or "es")
        }

    def _transcribe_local(self, audio_path: str, language: Optional[str]) -> Dict[str, Any]:
        global _transcription_progress
        segments_generator, info = self._model_instance.transcribe(
            audio_path, 
            language=language, 
            beam_size=5,
            vad_filter=True
        )

        total_duration = info.duration
        full_text = []
        result_segments = []

        print(f"[TranscriptionService] Duración total del audio detectada: {total_duration:.1f}s")

        for segment in segments_generator:
            result_segments.append({
                "start": segment.start,
                "end": segment.end,
                "text": segment.text.strip()
            })
            full_text.append(segment.text.strip())
            
            if total_duration > 0:
                _transcription_progress = min(99.0, (segment.end / total_duration) * 100.0)

        _transcription_progress = 100.0
        final_text = " ".join(full_text)
        print(f"[TranscriptionService] Transcripción completada. Palabras: {len(final_text.split())}")

        return {
            "text": final_text,
            "segments": result_segments,
            "language": info.language
        }
