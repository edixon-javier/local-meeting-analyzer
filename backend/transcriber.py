"""
transcriber.py
Transcribe archivos de audio a texto usando faster-whisper.
Optimizado para menor consumo de RAM y mayor velocidad en CPU.
"""

import os
from typing import Optional
from faster_whisper import WhisperModel

# Asegurar que ffmpeg esté en el PATH de Windows para Whisper
if r"C:\ffmpeg\bin" not in os.environ["PATH"]:
    os.environ["PATH"] += os.pathsep + r"C:\ffmpeg\bin"

# Variable global para trackear el progreso de la transcripción actual
transcription_progress = 0.0

# Modelos disponibles: tiny, base, small, medium, large-v3
DEFAULT_MODEL = "small"

class Transcriber:
    _model_instance = None
    _current_model_name = None

    def __init__(self, model_name: str = DEFAULT_MODEL):
        self.model_name = model_name
        self.ai_provider = "local"
        self.openai_api_key = ""
        self.openai_client = None
        self._ensure_model_loaded()

    def set_config(self, config: dict):
        self.ai_provider = config.get("ai_provider", self.ai_provider)
        self.openai_api_key = config.get("openai_api_key", self.openai_api_key)
        
        if self.ai_provider == "openai" and self.openai_api_key:
            try:
                import openai
                self.openai_client = openai.OpenAI(api_key=self.openai_api_key)
            except ImportError:
                print("[Transcriber] Error: módulo openai no está instalado.")

    def set_model(self, model_name: str):
        """Cambia el modelo activo si es diferente."""
        if self.model_name != model_name:
            self.model_name = model_name
            self._ensure_model_loaded()

    def _ensure_model_loaded(self):
        """Carga el modelo de faster-whisper si no está cargado o si cambió."""
        if (Transcriber._model_instance is None or
            Transcriber._current_model_name != self.model_name):
            print(f"[Transcriber] Cargando modelo faster-whisper '{self.model_name}' en CPU (int8)...")
            Transcriber._model_instance = WhisperModel(self.model_name, device="cpu", compute_type="int8")
            Transcriber._current_model_name = self.model_name
            print(f"[Transcriber] Modelo '{self.model_name}' listo.")

    @classmethod
    def get_progress(cls) -> float:
        """Retorna el porcentaje de progreso de la transcripción actual."""
        global transcription_progress
        return transcription_progress

    def transcribe(self, audio_path: str, language: Optional[str] = None) -> dict:
        """
        Transcribe un archivo de audio iterando sobre los segmentos.
        
        Args:
            audio_path: Ruta al archivo WAV/MP3/etc.
            language: Código de idioma (ej: 'es', 'en').
        
        Returns:
            dict con 'text' y 'segments'.
        """
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Archivo de audio no encontrado: {audio_path}")

        print(f"[Transcriber] Transcribiendo: {audio_path} usando {self.ai_provider}")
        
        global transcription_progress
        transcription_progress = 0.0

        if self.ai_provider == "openai":
            if not self.openai_client:
                raise RuntimeError("El cliente de OpenAI no está configurado (API Key faltante).")
            
            with open(audio_path, "rb") as audio_file:
                # Se usa verbose_json para obtener los timestamps si es posible, 
                # aunque whisper-1 de OpenAI puede o no devolver segmentos detallados.
                # Lo solicitamos y procesamos si vienen.
                response = self.openai_client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    response_format="verbose_json",
                    language=language
                )
            
            transcription_progress = 100.0
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
                # Si no devuelve segmentos, crear uno falso que abarque todo
                segments = [{"start": 0.0, "end": 0.0, "text": text}]
                
            return {
                "text": text,
                "segments": segments,
                "language": getattr(response, "language", language or "es")
            }

        # Transcripción local usando faster-whisper
        
        global transcription_progress
        transcription_progress = 0.0

        segments_generator, info = Transcriber._model_instance.transcribe(
            audio_path, 
            language=language, 
            beam_size=5,
            vad_filter=True
        )

        total_duration = info.duration
        full_text = []
        result_segments = []

        print(f"[Transcriber] Duración total del audio detectada: {total_duration:.1f}s")

        for segment in segments_generator:
            result_segments.append({
                "start": segment.start,
                "end": segment.end,
                "text": segment.text.strip()
            })
            full_text.append(segment.text.strip())
            
            # Actualizar progreso en tiempo real
            if total_duration > 0:
                transcription_progress = min(99.0, (segment.end / total_duration) * 100.0)

        # Al completar, marcar 100% de progreso
        transcription_progress = 100.0
        final_text = " ".join(full_text)
        print(f"[Transcriber] Transcripción completada. Palabras: {len(final_text.split())}")

        return {
            "text": final_text,
            "segments": result_segments,
            "language": info.language
        }
