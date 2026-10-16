"""
backend/services/dictation_service.py
Servicio de Dictado Global de Baja Latencia con Inyección en Cursor
y Auditoría Completa de Voz.

Características:
- Captura de audio directa en RAM a 16kHz mono con soundcard (0 latencia de disco).
- Medición de RMS en tiempo real para visualización fluida de la píldora.
- STT ultra-rápido: Groq Cloud (whisper-large-v3-turbo, ~250ms), OpenAI Whisper-1 y Faster-Whisper local.
- Modo "Ideas Claras / Pulido con LLM": Groq llama-3.1-8b-instant / OpenAI gpt-4o-mini.
- Inyección nativa en cursor vía win32_injector.
- Auditoría asíncrona desacoplada en segundo plano: Audio comprimido + JSON estructurado.
"""

import os
import sys
import io
import time
import json
import wave
import glob
import re
import threading
import subprocess
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional

import numpy as np
import requests
import soundcard as sc

from core.config import system_config
from core.paths import get_dictations_dir, get_ffmpeg_path
from services.win32_injector import win32_injector

logger = logging.getLogger("dictation_service")

# Hotfix para soundcard en Windows (si no fue importado antes)
try:
    from services.audio_service import _apply_soundcard_hotfix
    _apply_soundcard_hotfix()
except Exception:
    pass

SYSTEM_PROMPT_POLISH = """Eres un asistente de redacción y dictado profesional en tiempo real.
Tu tarea es convertir el texto transcrito por voz en un texto limpio, fluido y profesional, manteniendo estrictamente el tono original, la persona gramatical y la intención del hablante.

REGLAS ESTRICTAS:
1. Elimina muletillas verbales, vacilaciones y tartamudeos ("eh", "este", "o sea", "bueno", "tipo", "mmm", repeticiones involuntarias).
2. Resuelve autocorrecciones y titubeos ("vamos a enviar tres, no, cuatro reportes" -> "Vamos a enviar cuatro reportes").
3. Aplica mayúsculas, comas, puntos y acentuación correcta.
4. Interpreta comandos de formato por voz:
   - "punto y aparte" -> punto seguido de doble salto de línea (\\n\\n).
   - "punto y seguido" -> punto seguido de espacio (. ).
   - "nueva línea" o "salto de línea" -> salto de línea (\\n).
   - "dos puntos" -> dos puntos (:).
   - "abrir comillas" / "cerrar comillas" -> comillas (" ").
   - "abrir paréntesis" / "cerrar paréntesis" -> paréntesis (( )).
   - "signo de interrogación" -> interrogación (¿ ?).
   - "signo de exclamación" -> exclamación (¡ !).
5. NO agregues introducciones, explicaciones, comentarios, saludos ni comillas envolviendo la totalidad del texto.
6. Devuelve ÚNICAMENTE el texto procesado final listo para ser insertado directamente en el cursor del usuario."""


def apply_voice_formatting_fallback(text: str) -> str:
    """Aplica reemplazos básicos de comandos de voz si el LLM no está activo o falló."""
    if not text:
        return ""
    t = text
    # Comandos de formato comunes
    t = re.sub(r"(?i)\bpunto y aparte\b", ".\n\n", t)
    t = re.sub(r"(?i)\bpunto y seguido\b", ". ", t)
    t = re.sub(r"(?i)\b(nueva l[ií]nea|salto de l[ií]nea)\b", "\n", t)
    t = re.sub(r"(?i)\bdos puntos\b", ": ", t)
    t = re.sub(r"(?i)\bcoma\b", ", ", t)
    # Limpiar espacios repetidos antes de signos
    t = re.sub(r"\s+([.,:;])", r"\1", t)
    # Primera letra mayúscula
    t = t.strip()
    if t and len(t) > 0:
        t = t[0].upper() + t[1:]
    return t


class DictationService:
    def __init__(self):
        self._is_recording = False
        self._recording_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._audio_chunks: List[np.ndarray] = []
        self._current_rms: float = 0.0
        self._lock = threading.Lock()
        self._start_time: float = 0.0
        self._target_window: Dict[str, Any] = {}
        self._local_whisper_model = None
        self._local_model_lock = threading.Lock()

    @property
    def is_recording(self) -> bool:
        return self._is_recording

    @property
    def current_rms(self) -> float:
        return self._current_rms

    def _get_mic(self):
        mic_id = system_config.get("mic_device_id", "default")
        try:
            if mic_id in ("default", "", None):
                return sc.default_microphone()
            return sc.get_microphone(mic_id)
        except Exception as e:
            logger.warning(f"No se pudo obtener micrófono '{mic_id}', usando predeterminado: {e}")
            return sc.default_microphone()

    def start_dictation(self, mode: Optional[str] = None, provider: Optional[str] = None) -> Dict[str, Any]:
        """Inicia la captura en RAM a 16kHz mono."""
        with self._lock:
            if self._is_recording:
                return {
                    "status": "already_recording",
                    "started_at": self._start_time,
                }

            # Guardar la ventana activa que tiene el cursor justo al empezar a dictar
            self._target_window = win32_injector.get_foreground_window_info()
            self._audio_chunks = []
            self._current_rms = 0.0
            self._stop_event.clear()
            self._start_time = time.time()
            self._is_recording = True

            self._recording_thread = threading.Thread(
                target=self._record_loop,
                daemon=True,
                name="DictationRecordThread"
            )
            self._recording_thread.start()

            logger.info(f"Dictado iniciado. Ventana activa: '{self._target_window.get('title')}' ({self._target_window.get('exe_name')})")

            return {
                "status": "recording",
                "target_window": self._target_window,
                "started_at": self._start_time,
            }

    def _record_loop(self):
        """Bucle de grabación en RAM a 16kHz mono. Si el hardware no admite 16kHz directo, recurre a 48kHz con diezmado a 16kHz."""
        target_rate = 16000
        block_samples = 1600  # 100ms

        try:
            mic = self._get_mic()
            # 1. Intentar abrir el recorder a 16kHz directamente (0 latencia, 0 downsampling)
            recorder_ctx = None
            step = 1
            try:
                recorder_ctx = mic.recorder(samplerate=target_rate, channels=1, blocksize=block_samples)
            except Exception as e_16k:
                logger.warning(f"No se pudo abrir micrófono a 16kHz ({e_16k}). Intentando 48kHz...")
                try:
                    recorder_ctx = mic.recorder(samplerate=48000, channels=1, blocksize=4800)
                    step = 3
                except Exception as e_48k:
                    logger.warning(f"Fallo abriendo mic configurado a 48kHz ({e_48k}). Recurriendo a mic predeterminado...")
                    mic = sc.default_microphone()
                    recorder_ctx = mic.recorder(samplerate=48000, channels=1, blocksize=4800)
                    step = 3

            with recorder_ctx as rec:
                while not self._stop_event.is_set():
                    data = rec.record(block_samples if step == 1 else 4800)
                    if data is not None and len(data) > 0:
                        mono = data[:, 0] if data.ndim > 1 else data
                        # Calcular RMS instantáneo
                        rms = float(np.sqrt(np.mean(mono ** 2)))
                        self._current_rms = rms
                        if step > 1:
                            # Diezmar de 48kHz a 16kHz
                            n = (len(mono) // 3) * 3
                            mono_16k = (mono[0:n:3] + mono[1:n:3] + mono[2:n:3]) / 3.0
                            self._audio_chunks.append(mono_16k.astype(np.float32))
                        else:
                            self._audio_chunks.append(mono.astype(np.float32))
        except Exception as e:
            logger.error(f"Error en bucle de grabación de dictado: {e}")
        finally:
            self._current_rms = 0.0

    def cancel_dictation(self) -> Dict[str, Any]:
        """Cancela y descarta el dictado actual sin inyectar ni persistir."""
        with self._lock:
            if not self._is_recording:
                return {"status": "idle", "cancelled": True}

            self._stop_event.set()
            self._is_recording = False

        if self._recording_thread and self._recording_thread.is_alive():
            self._recording_thread.join(timeout=1.0)

        with self._lock:
            self._audio_chunks = []
            self._current_rms = 0.0

        logger.info("Dictado cancelado por el usuario.")
        return {"status": "idle", "cancelled": True}

    def stop_dictation(
        self,
        mode: Optional[str] = None,
        provider: Optional[str] = None,
        inject: bool = True
    ) -> Dict[str, Any]:
        """
        Detiene la grabación, procesa STT, pulido con LLM (si corresponde),
        inyecta en cursor y programa el guardado de auditoría en segundo plano.
        """
        stop_call_time = time.perf_counter()

        with self._lock:
            if not self._is_recording:
                return {
                    "status": "not_recording",
                    "text": "",
                    "raw_transcript": "",
                    "polished_transcript": "",
                }

            self._stop_event.set()
            self._is_recording = False
            target_window = dict(self._target_window)

        if self._recording_thread and self._recording_thread.is_alive():
            self._recording_thread.join(timeout=1.5)

        capture_duration_sec = time.time() - self._start_time
        capture_duration_ms = capture_duration_sec * 1000

        # Unificar chunks en memoria y liberar la lista inmediatamente para evitar retención de RAM
        if not self._audio_chunks:
            return {
                "id": "",
                "status": "empty_audio",
                "raw_transcript": "",
                "polished_transcript": "",
                "injected_text": "",
                "duration_seconds": capture_duration_sec,
                "metrics": {"total_latency_ms": 0.0},
            }

        audio_data = np.concatenate(self._audio_chunks, axis=0)
        self._audio_chunks = []
        # Si el audio es extremadamente corto (< 0.2s) o silencio total/micrófono silenciado
        max_amp = float(np.max(np.abs(audio_data))) if len(audio_data) > 0 else 0.0
        if len(audio_data) < 3200 or max_amp < 0.0001:
            status = "empty_audio" if len(audio_data) < 3200 else "silence_or_too_short"
            return {
                "id": "",
                "status": status,
                "max_amplitude": max_amp,
                "message": "No se detectó audio en el micrófono. Verifica que esté conectado y no silenciado.",
                "raw_transcript": "",
                "polished_transcript": "",
                "injected_text": "",
                "duration_seconds": capture_duration_sec,
                "metrics": {"total_latency_ms": (time.perf_counter() - stop_call_time) * 1000},
            }

        # Empaquetar a WAV en memoria
        wav_bytes = self._audio_to_wav_bytes(audio_data, sample_rate=16000)

        # Resolver modo y proveedor
        active_mode = mode or system_config.get("dictation_mode", "smart_polish")
        active_provider = provider or system_config.get("dictation_provider", "local")

        # ── 1. Transcripción STT ──
        stt_start = time.perf_counter()
        raw_transcript, used_stt_provider = self._transcribe_audio(wav_bytes, active_provider)
        stt_latency_ms = (time.perf_counter() - stt_start) * 1000

        raw_transcript = raw_transcript.strip()
        if not raw_transcript:
            return {
                "id": "",
                "status": "no_speech_detected",
                "raw_transcript": "",
                "polished_transcript": "",
                "injected_text": "",
                "duration_seconds": capture_duration_sec,
                "metrics": {
                    "stt_latency_ms": stt_latency_ms,
                    "total_latency_ms": (time.perf_counter() - stop_call_time) * 1000,
                },
            }

        # ── 2. Pulido con LLM (si el modo es smart_polish) ──
        llm_start = time.perf_counter()
        if active_mode == "smart_polish":
            polished_transcript, used_llm_model = self._polish_transcript(raw_transcript, active_provider)
        else:
            polished_transcript = apply_voice_formatting_fallback(raw_transcript)
            used_llm_model = "literal"
        llm_latency_ms = (time.perf_counter() - llm_start) * 1000

        final_text = polished_transcript if active_mode == "smart_polish" else raw_transcript
        if not final_text:
            final_text = raw_transcript

        # ── 3. Inyección en Cursor ──
        injection_start = time.perf_counter()
        injection_result: Dict[str, Any] = {}
        if inject:
            injection_result = win32_injector.inject_text(final_text)
        injection_latency_ms = (time.perf_counter() - injection_start) * 1000

        total_latency_ms = (time.perf_counter() - stop_call_time) * 1000

        dictation_id = datetime.now().strftime("dict_%Y%m%d_%H%M%S")

        # ── 4. Persistencia Asíncrona de Auditoría (Worker en segundo plano) ──
        metrics = {
            "capture_duration_ms": capture_duration_ms,
            "stt_latency_ms": stt_latency_ms,
            "llm_latency_ms": llm_latency_ms,
            "injection_latency_ms": injection_latency_ms,
            "total_latency_ms": total_latency_ms,
        }

        dictation_payload = {
            "id": dictation_id,
            "timestamp": datetime.now().isoformat(),
            "duration_seconds": round(capture_duration_sec, 2),
            "target_app": target_window,
            "raw_transcript": raw_transcript,
            "polished_transcript": polished_transcript,
            "injected_text": final_text,
            "mode": active_mode,
            "provider": used_stt_provider,
            "llm_model": used_llm_model,
            "injection_result": injection_result,
            "metrics": metrics,
            "audio_file": f"{dictation_id}.mp3",
        }

        # Lanzar guardado en hilo desacoplado
        threading.Thread(
            target=self._save_audit_worker,
            args=(dictation_id, wav_bytes, dictation_payload),
            daemon=True,
            name=f"AuditSave-{dictation_id}"
        ).start()

        return dictation_payload

    def _audio_to_wav_bytes(self, audio: np.ndarray, sample_rate: int = 16000) -> bytes:
        """Convierte un array float32 mono (-1.0 a 1.0) a bytes WAV PCM de 16 bits."""
        clipped = np.clip(audio * 32767.0, -32768.0, 32767.0).astype(np.int16)
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes(clipped.tobytes())
        buf.seek(0)
        return buf.read()

    def _transcribe_audio(self, wav_bytes: bytes, preferred_provider: str) -> tuple[str, str]:
        """
        Orquesta la transcripción con cascada de fallbacks:
        Groq -> OpenAI -> Local Faster-Whisper.
        Retorna (texto_transcrito, proveedor_utilizado).
        """
        groq_key = system_config.get("groq_api_key", "").strip()
        openai_key = system_config.get("openai_api_key", "").strip()

        # Privacidad: el audio solo va a la nube que el usuario eligió explícitamente como proveedor
        # de dictado. Nunca se salta de un servicio en la nube a otro (p. ej. de Groq a OpenAI) ni de
        # "local" a la nube: si la nube elegida no está disponible, se transcribe en el equipo.
        providers_to_try = []
        if preferred_provider == "groq" and groq_key:
            providers_to_try.append("groq")
        elif preferred_provider == "openai" and openai_key:
            providers_to_try.append("openai")
        providers_to_try.append("local")

        for prov in providers_to_try:
            try:
                if prov == "groq" and groq_key:
                    logger.info("Transcribiendo con Groq (whisper-large-v3-turbo)...")
                    text = self._stt_groq(wav_bytes, groq_key)
                    return text, "groq"
                elif prov == "openai" and openai_key:
                    logger.info("Transcribiendo con OpenAI (whisper-1)...")
                    text = self._stt_openai(wav_bytes, openai_key)
                    return text, "openai"
                elif prov == "local":
                    logger.info("Transcribiendo con Faster-Whisper local...")
                    text = self._stt_local(wav_bytes)
                    return text, "local"
            except Exception as e:
                logger.warning(f"Fallo en STT con proveedor '{prov}': {e}. Probando siguiente...")

        return "", "none"

    def _stt_groq(self, wav_bytes: bytes, api_key: str) -> str:
        url = "https://api.groq.com/openai/v1/audio/transcriptions"
        headers = {"Authorization": f"Bearer {api_key}"}
        files = {"file": ("dictation.wav", wav_bytes, "audio/wav")}
        data = {
            "model": "whisper-large-v3-turbo",
            "language": "es",
            "response_format": "json",
            "temperature": 0.0,
        }
        res = requests.post(url, headers=headers, files=files, data=data, timeout=12)
        if res.status_code == 200:
            return res.json().get("text", "").strip()
        raise RuntimeError(f"Groq STT HTTP {res.status_code}: {res.text}")

    def _stt_openai(self, wav_bytes: bytes, api_key: str) -> str:
        url = "https://api.openai.com/v1/audio/transcriptions"
        headers = {"Authorization": f"Bearer {api_key}"}
        files = {"file": ("dictation.wav", wav_bytes, "audio/wav")}
        data = {
            "model": "whisper-1",
            "language": "es",
            "response_format": "json",
            "temperature": 0.0,
        }
        res = requests.post(url, headers=headers, files=files, data=data, timeout=15)
        if res.status_code == 200:
            return res.json().get("text", "").strip()
        raise RuntimeError(f"OpenAI STT HTTP {res.status_code}: {res.text}")

    def _stt_local(self, wav_bytes: bytes) -> str:
        with self._local_model_lock:
            if self._local_whisper_model is None:
                from faster_whisper import WhisperModel
                # Modelo base int8 en CPU para respuesta en ~600ms
                self._local_whisper_model = WhisperModel("base", device="cpu", compute_type="int8")

            segments, _ = self._local_whisper_model.transcribe(
                io.BytesIO(wav_bytes),
                language="es",
                beam_size=1,
                vad_filter=True
            )
            texts = [seg.text.strip() for seg in segments]
            return " ".join(texts).strip()

    def _polish_transcript(self, raw_text: str, provider: Optional[str] = None) -> tuple[str, str]:
        """
        Pule el texto con LLM (Groq Llama 3.1 8B Instant o OpenAI gpt-4o-mini).
        Retorna (texto_pulido, modelo_utilizado).

        Privacidad: solo se usa el LLM del servicio en la nube elegido como proveedor de dictado.
        Con el proveedor local el texto no sale del equipo y se usa el formateador por reglas.
        """
        active = provider or system_config.get("dictation_provider", "local")
        groq_key = system_config.get("groq_api_key", "").strip() if active == "groq" else ""
        openai_key = system_config.get("openai_api_key", "").strip() if active == "openai" else ""

        # 1. Intentar Groq Llama 3.1 8B Instant (~140ms)
        if groq_key:
            try:
                url = "https://api.groq.com/openai/v1/chat/completions"
                headers = {
                    "Authorization": f"Bearer {groq_key}",
                    "Content-Type": "application/json",
                }
                body = {
                    "model": "llama-3.1-8b-instant",
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT_POLISH},
                        {"role": "user", "content": raw_text},
                    ],
                    "temperature": 0.1,
                    "max_tokens": 1024,
                }
                res = requests.post(url, headers=headers, json=body, timeout=10)
                if res.status_code == 200:
                    content = res.json()["choices"][0]["message"]["content"].strip()
                    # Quitar comillas envolventes si el LLM las agregó
                    if content.startswith('"') and content.endswith('"') and len(content) > 1:
                        content = content[1:-1].strip()
                    # Normalizar saltos de línea escapados si el LLM los devolvió como texto literal
                    content = content.replace("\\n", "\n")
                    return content, "llama-3.1-8b-instant"
                else:
                    logger.warning(f"Groq polish HTTP {res.status_code}: {res.text}")
            except Exception as e:
                logger.warning(f"Error en pulido con Groq Llama: {e}")

        # 2. Fallback a OpenAI gpt-4o-mini
        if openai_key:
            try:
                url = "https://api.openai.com/v1/chat/completions"
                headers = {
                    "Authorization": f"Bearer {openai_key}",
                    "Content-Type": "application/json",
                }
                body = {
                    "model": "gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT_POLISH},
                        {"role": "user", "content": raw_text},
                    ],
                    "temperature": 0.1,
                    "max_tokens": 1024,
                }
                res = requests.post(url, headers=headers, json=body, timeout=10)
                if res.status_code == 200:
                    content = res.json()["choices"][0]["message"]["content"].strip()
                    if content.startswith('"') and content.endswith('"') and len(content) > 1:
                        content = content[1:-1].strip()
                    content = content.replace("\\n", "\n")
                    return content, "gpt-4o-mini"
                else:
                    logger.warning(f"OpenAI polish HTTP {res.status_code}: {res.text}")
            except Exception as e:
                logger.warning(f"Error en pulido con OpenAI: {e}")

        # 3. Fallback sin LLM: formateador por reglas
        return apply_voice_formatting_fallback(raw_text), "rule_based_fallback"

    def _save_audit_worker(self, dictation_id: str, wav_bytes: bytes, payload: Dict[str, Any]):
        """Guarda en disco los archivos de auditoría: audio comprimido (.mp3 o .wav) y metadatos JSON."""
        try:
            dict_dir = get_dictations_dir()
            wav_path = os.path.join(dict_dir, f"{dictation_id}.wav")
            mp3_path = os.path.join(dict_dir, f"{dictation_id}.mp3")
            json_path = os.path.join(dict_dir, f"{dictation_id}.json")

            # Escribir WAV temporal
            with open(wav_path, "wb") as f:
                f.write(wav_bytes)

            audio_saved_file = f"{dictation_id}.wav"

            # Intentar comprimir a MP3 con FFmpeg
            ffmpeg_exe = get_ffmpeg_path()
            try:
                cmd = [
                    ffmpeg_exe, "-y",
                    "-i", wav_path,
                    "-codec:a", "libmp3lame",
                    "-b:a", "64k",
                    "-ar", "16000",
                    "-ac", "1",
                    mp3_path
                ]
                kwargs = {
                    "stdout": subprocess.DEVNULL,
                    "stderr": subprocess.DEVNULL,
                    "check": True,
                    "timeout": 30
                }
                if os.name == "nt":
                    kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW
                subprocess.run(cmd, **kwargs)

                if os.path.exists(mp3_path) and os.path.getsize(mp3_path) > 0:
                    audio_saved_file = f"{dictation_id}.mp3"
                    if os.path.exists(wav_path):
                        os.remove(wav_path)
            except Exception as e:
                logger.warning(f"No se pudo comprimir dictado con FFmpeg ({e}). Se conserva WAV.")

            payload["audio_file"] = audio_saved_file

            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)

            logger.info(f"Auditoría de dictado guardada: {dictation_id} -> {audio_saved_file}")
        except Exception as e:
            logger.error(f"Error guardando auditoría de dictado {dictation_id}: {e}")

    def get_status(self) -> Dict[str, Any]:
        """Retorna el estado en tiempo real del dictado."""
        duration = 0.0
        if self._is_recording and self._start_time > 0:
            duration = time.time() - self._start_time

        return {
            "is_recording": self._is_recording,
            "duration_seconds": round(duration, 2),
            "rms_level": self._current_rms,
            "mode": system_config.get("dictation_mode", "smart_polish"),
            "provider": system_config.get("dictation_provider", "local"),
        }

    def get_history(self, limit: int = 50, search: str = "") -> List[Dict[str, Any]]:
        """Lee y lista el historial de dictados ordenados por fecha descendente."""
        dict_dir = get_dictations_dir()
        json_files = glob.glob(os.path.join(dict_dir, "*.json"))

        items = []
        search_lower = search.strip().lower()

        for jf in json_files:
            try:
                with open(jf, "r", encoding="utf-8") as f:
                    data = json.load(f)

                if search_lower:
                    raw = data.get("raw_transcript", "").lower()
                    polished = data.get("polished_transcript", "").lower()
                    app_title = data.get("target_app", {}).get("title", "").lower()
                    app_exe = data.get("target_app", {}).get("exe_name", "").lower()
                    if (search_lower not in raw and
                        search_lower not in polished and
                        search_lower not in app_title and
                        search_lower not in app_exe):
                        continue

                items.append(data)
            except Exception as e:
                logger.warning(f"Error leyendo dictado {jf}: {e}")

        # Ordenar por timestamp descendente
        items.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        return items[:limit]

    def delete_dictation(self, dictation_id: str) -> bool:
        """Elimina los archivos de audio y JSON de un dictado."""
        dict_dir = get_dictations_dir()
        safe_id = os.path.splitext(os.path.basename(dictation_id))[0]
        json_path = os.path.join(dict_dir, f"{safe_id}.json")
        deleted = False

        if os.path.exists(json_path):
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                audio_file = data.get("audio_file")
                if audio_file:
                    audio_path = os.path.join(dict_dir, os.path.basename(audio_file))
                    if os.path.exists(audio_path):
                        os.remove(audio_path)
            except Exception:
                pass
            try:
                os.remove(json_path)
                deleted = True
            except Exception as e:
                logger.error(f"Error eliminando {json_path}: {e}")

        # También verificar si existen wav o mp3 con ese id
        for ext in (".mp3", ".wav"):
            p = os.path.join(dict_dir, f"{safe_id}{ext}")
            if os.path.exists(p):
                try:
                    os.remove(p)
                    deleted = True
                except Exception:
                    pass

        return deleted

    def reinject(self, dictation_id: str) -> Dict[str, Any]:
        """Re-inyecta en el cursor el texto de un dictado previo del historial."""
        dict_dir = get_dictations_dir()
        safe_id = os.path.splitext(os.path.basename(dictation_id))[0]
        json_path = os.path.join(dict_dir, f"{safe_id}.json")
        if not os.path.exists(json_path):
            raise FileNotFoundError(f"Dictado '{dictation_id}' no encontrado.")

        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        text = data.get("injected_text") or data.get("polished_transcript") or data.get("raw_transcript")
        if not text:
            raise ValueError("El dictado no contiene texto.")

        return win32_injector.inject_text(text)


# Singleton
dictation_service = DictationService()
