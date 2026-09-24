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
        
        import os
        import subprocess
        import tempfile
        import glob
        
        file_size = os.path.getsize(audio_path)
        MAX_SIZE = 24 * 1024 * 1024  # 24 MB
        
        global _transcription_progress
        
        if file_size <= MAX_SIZE:
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
            
        # Chunking para archivos largos
        print(f"[TranscriptionService] Archivo de {file_size/1024/1024:.2f}MB supera el límite de OpenAI. Dividiendo en chunks...")
        from services.audio_service import _get_ffmpeg_path
        ffmpeg_path = _get_ffmpeg_path()
        
        temp_dir = tempfile.mkdtemp()
        chunk_pattern = os.path.join(temp_dir, "chunk_%03d.mp3")
        
        # 1200 segundos (20 min). A 64kbps, ~9.6 MB
        cmd = [
            ffmpeg_path, "-y", "-i", audio_path, 
            "-f", "segment", "-segment_time", "1200", 
            "-c", "copy", chunk_pattern
        ]
        
        try:
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            chunks = sorted(glob.glob(os.path.join(temp_dir, "chunk_*.mp3")))
            
            full_text = ""
            all_segments = []
            time_offset = 0.0
            last_lang = language or "es"
            
            for i, chunk_path in enumerate(chunks):
                _transcription_progress = (i / len(chunks)) * 100.0
                print(f"[TranscriptionService] Transcribiendo chunk {i+1}/{len(chunks)}...")
                
                with open(chunk_path, "rb") as audio_file:
                    response = self.openai_client.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio_file,
                        response_format="verbose_json",
                        language=language
                    )
                
                chunk_text = response.text
                full_text += chunk_text + " "
                chunk_duration = getattr(response, "duration", None)
                last_lang = getattr(response, "language", last_lang)
                
                if hasattr(response, "segments") and response.segments:
                    for seg in response.segments:
                        all_segments.append({
                            "start": seg.start + time_offset,
                            "end": seg.end + time_offset,
                            "text": seg.text.strip()
                        })
                    if chunk_duration is None:
                        chunk_duration = response.segments[-1].end
                else:
                    if chunk_duration is None:
                        chunk_duration = 1200.0
                    all_segments.append({
                        "start": time_offset,
                        "end": time_offset + chunk_duration,
                        "text": chunk_text.strip()
                    })
                    
                time_offset += chunk_duration
                
                try:
                    os.remove(chunk_path)
                except Exception:
                    pass
                    
            _transcription_progress = 100.0
            return {
                "text": full_text.strip(),
                "segments": all_segments,
                "language": last_lang
            }
        finally:
            # Limpiar directorio temporal
            for f in glob.glob(os.path.join(temp_dir, "chunk_*.mp3")):
                try: os.remove(f)
                except: pass
            try: os.rmdir(temp_dir)
            except: pass

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
            from services.session_manager import session_manager
            if not session_manager.is_processing():
                print("[TranscriptionService] Transcripción abortada por cancelación del usuario.")
                raise RuntimeError("Transcripción cancelada.")
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
