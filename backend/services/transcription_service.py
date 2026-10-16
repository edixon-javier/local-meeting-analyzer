import os
import glob
import subprocess
import tempfile
import base64
import requests
from typing import Optional, Dict, Any
from faster_whisper import WhisperModel
from domain.interfaces import ITranscriber
from core.config import Config
from services.analysis_service import parse_json_response

# Variable global para tracking del progreso en el proceso
_transcription_progress = 0.0


class TranscriptionService(ITranscriber):
    def __init__(self, config: Config):
        self._model_instance = None
        self._current_model_name = None
        self.ai_provider = config.get("ai_provider", "local")
        self.openai_api_key = config.get("openai_api_key", "")
        self.gemini_api_key = config.get("gemini_api_key", "")
        self.gemini_model = config.get("gemini_model", "gemini-2.0-flash") or "gemini-2.0-flash"
        self.openai_client = None
        self._model_name = config.get("whisper_model", "small")
        self._setup_openai()
        # Carga diferida: el modelo Whisper se carga en la primera transcripción local
        # (transcribe -> _ensure_model_loaded).

    @property
    def model_name(self) -> str:
        return self._model_name

    def set_config(self, config: Config):
        self.ai_provider = config.get("ai_provider", self.ai_provider)
        self.openai_api_key = config.get("openai_api_key", self.openai_api_key)
        self.gemini_api_key = config.get("gemini_api_key", getattr(self, "gemini_api_key", ""))
        self.gemini_model = config.get("gemini_model", getattr(self, "gemini_model", "gemini-2.0-flash")) or "gemini-2.0-flash"
        self._setup_openai()

    def set_model(self, model_name: str):
        self._model_name = model_name

    def _setup_openai(self):
        # Privacidad: el cliente de OpenAI solo existe si el usuario eligió explícitamente
        # el proveedor "openai". En modo local o con otros proveedores el audio no se envía a OpenAI.
        if self.ai_provider != "openai" or not self.openai_api_key:
            self.openai_client = None
            return
        try:
            import openai
            self.openai_client = openai.OpenAI(api_key=self.openai_api_key)
        except ImportError:
            print("[TranscriptionService] Error: módulo openai no está instalado.")

    def _ensure_model_loaded(self):
        if self.ai_provider in ("openai", "gemini"):
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

        print(f"[TranscriptionService] Transcribiendo: {audio_path} usando proveedor {self.ai_provider}")
        
        global _transcription_progress
        _transcription_progress = 0.0

        if self.ai_provider == "openai":
            return self._transcribe_openai(audio_path, language)
        elif self.ai_provider == "gemini":
            return self._transcribe_gemini(audio_path, language)
        elif self.ai_provider == "claude":
            # Anthropic no ofrece API de STT; Whisper local extrae el audio y Claude procesa diarización/análisis
            self._ensure_model_loaded()
            return self._transcribe_local(audio_path, language)
        else:
            self._ensure_model_loaded()
            return self._transcribe_local(audio_path, language)

    def _transcribe_openai(self, audio_path: str, language: Optional[str]) -> Dict[str, Any]:
        # Guarda de privacidad: nunca enviar audio a OpenAI si el proveedor no es "openai"
        if self.ai_provider != "openai":
            raise RuntimeError("La transcripción en la nube solo está permitida con el proveedor OpenAI.")
        if not self.openai_client:
            raise RuntimeError("El cliente de OpenAI no está configurado (API Key faltante).")
        
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
            
        # Chunking para archivos largos con FFmpeg
        print(f"[TranscriptionService] Archivo de {file_size/1024/1024:.2f}MB supera el límite de OpenAI. Dividiendo en chunks...")
        from services.audio_service import _get_ffmpeg_path
        ffmpeg_path = _get_ffmpeg_path()
        
        temp_dir = tempfile.mkdtemp()
        chunk_pattern = os.path.join(temp_dir, "chunk_%03d.mp3")
        
        cmd = [
            ffmpeg_path, "-y", "-i", audio_path, 
            "-f", "segment", "-segment_time", "1200", 
            "-c", "copy", chunk_pattern
        ]
        try:
            kwargs = {"stdout": subprocess.DEVNULL, "stderr": subprocess.DEVNULL, "check": True}
            if os.name == "nt":
                kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW
            subprocess.run(cmd, **kwargs)
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
            for f in glob.glob(os.path.join(temp_dir, "chunk_*.mp3")):
                try: os.remove(f)
                except Exception: pass
            try: os.rmdir(temp_dir)
            except Exception: pass

    def _transcribe_gemini(self, audio_path: str, language: Optional[str]) -> Dict[str, Any]:
        """Transcripción multimodal nativa utilizando la API de Google Gemini."""
        if self.ai_provider != "gemini":
            raise RuntimeError("La transcripción con Gemini solo está permitida cuando el proveedor es Gemini.")
        if not self.gemini_api_key:
            raise RuntimeError("La clave API de Google Gemini no está configurada.")

        global _transcription_progress
        _transcription_progress = 10.0

        file_size = os.path.getsize(audio_path)
        MAX_INLINE_SIZE = 19 * 1024 * 1024  # 19 MB
        lower_path = audio_path.lower()

        if lower_path.endswith(".wav"):
            mime_type = "audio/wav"
        elif lower_path.endswith(".mp3"):
            mime_type = "audio/mp3"
        elif lower_path.endswith((".m4a", ".aac")):
            mime_type = "audio/aac"
        elif lower_path.endswith(".ogg"):
            mime_type = "audio/ogg"
        elif lower_path.endswith(".flac"):
            mime_type = "audio/flac"
        else:
            mime_type = "audio/wav"

        target_path = audio_path
        cleanup_file = None

        if file_size > MAX_INLINE_SIZE and lower_path.endswith(".wav"):
            try:
                from services.audio_service import _get_ffmpeg_path
                ffmpeg_path = _get_ffmpeg_path()
                tmp_mp3 = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
                tmp_mp3.close()
                cleanup_file = tmp_mp3.name
                cmd = [ffmpeg_path, "-y", "-i", audio_path, "-b:a", "64k", tmp_mp3.name]
                kwargs = {"stdout": subprocess.DEVNULL, "stderr": subprocess.DEVNULL, "check": True}
                if os.name == "nt":
                    kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW
                subprocess.run(cmd, **kwargs)
                target_path = tmp_mp3.name
                mime_type = "audio/mp3"
                file_size = os.path.getsize(target_path)
            except Exception as e:
                print(f"[TranscriptionService] Fallo compresión para Gemini: {e}")
                target_path = audio_path

        try:
            if file_size > MAX_INLINE_SIZE:
                # Subir vía Gemini Files API para archivos grandes (>19MB)
                _transcription_progress = 25.0
                print(f"[TranscriptionService] Subiendo audio a Gemini Files API ({file_size/1024/1024:.1f}MB)...")
                upload_url = f"https://generativelanguage.googleapis.com/upload/v1beta/files?key={self.gemini_api_key}"
                with open(target_path, "rb") as f:
                    audio_bytes = f.read()
                headers = {
                    "X-Goog-Upload-Command": "start, upload, finalize",
                    "X-Goog-Upload-Header-Content-Length": str(len(audio_bytes)),
                    "X-Goog-Upload-Header-Content-Type": mime_type,
                    "Content-Type": mime_type
                }
                upload_res = requests.post(upload_url, headers=headers, data=audio_bytes, timeout=180)
                if upload_res.status_code != 200:
                    raise RuntimeError(f"Error al subir audio a Gemini Files API ({upload_res.status_code}): {upload_res.text}")
                file_uri = upload_res.json().get("file", {}).get("uri")
                if not file_uri:
                    raise RuntimeError("No se obtuvo la URI del archivo subido a Gemini.")
                audio_part = {
                    "fileData": {
                        "mimeType": mime_type,
                        "fileUri": file_uri
                    }
                }
            else:
                _transcription_progress = 30.0
                with open(target_path, "rb") as f:
                    b64_data = base64.b64encode(f.read()).decode("utf-8")
                audio_part = {
                    "inlineData": {
                        "mimeType": mime_type,
                        "data": b64_data
                    }
                }

            _transcription_progress = 50.0
            lang_prompt = f"El idioma del audio es {language or 'español'}."
            prompt_text = (
                f"Transcribe con alta precisión el audio de esta reunión. {lang_prompt}\n"
                "Genera el texto completo y los segmentos temporales en segundos.\n"
                "Responde EXCLUSIVAMENTE con este formato JSON (sin texto adicional):\n"
                "{\n"
                '  "text": "Texto completo transcrito",\n'
                '  "language": "es",\n'
                '  "segments": [\n'
                '    {"start": 0.0, "end": 4.5, "text": "Texto del segmento"}\n'
                "  ]\n"
                "}"
            )

            gen_url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.gemini_model}:generateContent?key={self.gemini_api_key}"
            payload = {
                "contents": [
                    {
                        "role": "user",
                        "parts": [
                            audio_part,
                            {"text": prompt_text}
                        ]
                    }
                ],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "temperature": 0.2
                }
            }

            _transcription_progress = 75.0
            gen_res = requests.post(gen_url, json=payload, timeout=240)
            if gen_res.status_code != 200:
                raise RuntimeError(f"Error de Gemini al transcribir ({gen_res.status_code}): {gen_res.text}")

            res_json = gen_res.json()
            candidates = res_json.get("candidates", [])
            if not candidates or "content" not in candidates[0]:
                raise RuntimeError("Gemini no devolvió contenido de transcripción.")

            raw_text = candidates[0]["content"]["parts"][0].get("text", "")
            data = parse_json_response(raw_text, {})

            text = data.get("text", "")
            segments = data.get("segments", [])
            lang = data.get("language", language or "es")

            if not text and segments:
                text = " ".join([s.get("text", "") for s in segments])
            if text and not segments:
                segments = [{"start": 0.0, "end": 0.0, "text": text}]

            _transcription_progress = 100.0
            return {
                "text": text.strip(),
                "segments": segments,
                "language": lang
            }
        finally:
            if cleanup_file and os.path.exists(cleanup_file):
                try:
                    os.remove(cleanup_file)
                except Exception:
                    pass

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
