import asyncio
import logging
import queue
import threading
import time
from typing import Dict, Any, List, Optional, Tuple
import numpy as np

try:
    from faster_whisper import WhisperModel
except ImportError:
    WhisperModel = None

logger = logging.getLogger("live_transcription")
logger.setLevel(logging.INFO)

# Configuración de detección de voz y segmentación
SAMPLE_RATE = 16000  # Faster-Whisper requiere 16 kHz
SILENCE_RMS_THRESHOLD = 0.0035  # Umbral RMS para considerar silencio
SILENCE_CONSECUTIVE_FRAMES = 3  # ~600ms de silencio para cerrar un segmento (a 200ms por chunk)
MIN_SEGMENT_DURATION_SEC = 0.8  # Mínimo de audio para transcribir
MAX_SEGMENT_DURATION_SEC = 6.0  # Máximo de audio antes de forzar cierre de segmento
MIN_PARTIAL_INTERVAL_SEC = 0.7  # Intervalo mínimo entre actualizaciones parciales


class LiveTranscriptionService:
    """
    Servicio singleton para la transcripción en tiempo real (streaming palabra por palabra)
    utilizando Faster-Whisper sobre CPU en modo de baja latencia con timestamps de palabra.
    """

    def __init__(self, model_name: str = "tiny"):
        self._model_name = model_name
        self._model: Optional[WhisperModel] = None
        self._model_lock = threading.Lock()

        self._active_session_id: Optional[str] = None
        self._is_recording = False
        self._is_paused = False
        self._is_cancelled = False

        self._audio_queue: queue.Queue = queue.Queue(maxsize=500)
        self._worker_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

        self._listeners: List[Tuple[asyncio.Queue, Optional[asyncio.AbstractEventLoop]]] = []
        self._listeners_lock = threading.Lock()

        # Almacén de segmentos confirmados por sesión
        self._confirmed_segments: List[Dict[str, Any]] = []
        self._seq_counter = 0
        self._session_lock = threading.Lock()

    def _ensure_model(self):
        if self._model is None and WhisperModel is not None:
            with self._model_lock:
                if self._model is None:
                    logger.info(f"[LiveTranscription] Inicializando Faster-Whisper '{self._model_name}' (CPU, int8)...")
                    self._model = WhisperModel(self._model_name, device="cpu", compute_type="int8")
                    logger.info(f"[LiveTranscription] Modelo '{self._model_name}' preparado.")

    @property
    def is_active(self) -> bool:
        return self._is_recording and not self._is_cancelled

    @property
    def active_session_id(self) -> Optional[str]:
        return self._active_session_id

    def get_confirmed_segments(self) -> List[Dict[str, Any]]:
        with self._session_lock:
            return list(self._confirmed_segments)

    def get_full_transcript(self) -> str:
        with self._session_lock:
            return " ".join(seg["text"] for seg in self._confirmed_segments if seg.get("text")).strip()

    # ─────────────────────────────────────────
    # Gestión de Listeners SSE
    # ─────────────────────────────────────────
    def register_listener(self, event_queue: asyncio.Queue, loop: asyncio.AbstractEventLoop):
        with self._listeners_lock:
            self._listeners.append((event_queue, loop))
            logger.info(f"[LiveTranscription] Listener SSE registrado. Total: {len(self._listeners)}")

    def unregister_listener(self, event_queue: asyncio.Queue):
        with self._listeners_lock:
            self._listeners = [(q, l) for (q, l) in self._listeners if q is not event_queue]
            logger.info(f"[LiveTranscription] Listener SSE removido. Total: {len(self._listeners)}")

    def _broadcast_event(self, event_type: str, data: Dict[str, Any]):
        """Envía un evento SSE a todos los listeners activos de forma segura entre hilos."""
        import json
        payload = {"event": event_type, **data}
        event_str = f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

        with self._listeners_lock:
            for q, loop in list(self._listeners):
                try:
                    if loop and loop.is_running():
                        loop.call_soon_threadsafe(q.put_nowait, event_str)
                    else:
                        q.put_nowait(event_str)
                except Exception as e:
                    logger.debug(f"[LiveTranscription] Error enviando evento a listener: {e}")

    # ─────────────────────────────────────────
    # Ciclo de Vida de Grabación
    # ─────────────────────────────────────────
    def start_session(self, session_id: str, language: Optional[str] = "es"):
        """Inicia una nueva sesión de transcripción en vivo."""
        self._ensure_model()

        # Detener sesión anterior si existía
        if self._worker_thread and self._worker_thread.is_alive():
            self.stop_session()

        with self._session_lock:
            self._active_session_id = session_id
            self._is_recording = True
            self._is_paused = False
            self._is_cancelled = False
            self._confirmed_segments = []
            self._seq_counter = 0

        # Vaciar cola de audio
        while not self._audio_queue.empty():
            try:
                self._audio_queue.get_nowait()
            except queue.Empty:
                break

        self._stop_event.clear()
        self._worker_thread = threading.Thread(
            target=self._transcription_worker,
            args=(session_id, language),
            daemon=True,
            name=f"live-transcribe-{session_id}"
        )
        self._worker_thread.start()

        self._broadcast_event("session_started", {
            "session_id": session_id,
            "status": "recording"
        })
        logger.info(f"[LiveTranscription] Sesión {session_id} iniciada.")

    def pause_session(self):
        self._is_paused = True
        self._broadcast_event("paused", {
            "session_id": self._active_session_id
        })
        logger.info("[LiveTranscription] Sesión pausada.")

    def resume_session(self):
        self._is_paused = False
        self._broadcast_event("resumed", {
            "session_id": self._active_session_id
        })
        logger.info("[LiveTranscription] Sesión reanudada.")

    def feed_audio_chunk(self, chunk_16k: np.ndarray):
        """
        Recibe un fragmento de audio float32 muestreado a 16 kHz.
        Llamado por AudioService cada 200 ms.
        """
        if not self._is_recording or self._is_paused or self._is_cancelled:
            return

        if chunk_16k is None or len(chunk_16k) == 0:
            return

        try:
            self._audio_queue.put_nowait(chunk_16k)
        except queue.Full:
            # Si el buffer se llena por sobrecarga, descartamos el más viejo para evitar lag acumulado
            try:
                self._audio_queue.get_nowait()
                self._audio_queue.put_nowait(chunk_16k)
            except Exception:
                pass

    def stop_session(self) -> str:
        """Detiene limpiamente la sesión y procesa el audio residual."""
        if not self._is_recording and not self._worker_thread:
            return self.get_full_transcript()

        self._is_recording = False
        self._stop_event.set()

        if self._worker_thread and self._worker_thread.is_alive():
            self._worker_thread.join(timeout=4.0)
            self._worker_thread = None

        full_text = self.get_full_transcript()
        self._broadcast_event("complete", {
            "session_id": self._active_session_id,
            "total_segments": len(self._confirmed_segments),
            "text": full_text
        })
        logger.info(f"[LiveTranscription] Sesión {self._active_session_id} completada.")
        return full_text

    def cancel_session(self):
        """Cancela inmediatamente la sesión liberando recursos."""
        self._is_cancelled = True
        self._is_recording = False
        self._stop_event.set()

        # Vaciar cola
        while not self._audio_queue.empty():
            try:
                self._audio_queue.get_nowait()
            except queue.Empty:
                break

        if self._worker_thread and self._worker_thread.is_alive():
            self._worker_thread.join(timeout=2.0)
            self._worker_thread = None

        self._broadcast_event("cancelled", {
            "session_id": self._active_session_id
        })
        with self._session_lock:
            self._confirmed_segments = []
            self._active_session_id = None
        logger.info("[LiveTranscription] Sesión cancelada y recursos liberados.")

    # ─────────────────────────────────────────
    # Bucle Worker de Transcripción
    # ─────────────────────────────────────────
    def _transcription_worker(self, session_id: str, language: Optional[str]):
        """
        Hilo de ejecución continua para procesar fragmentos de audio,
        detectar voz/silencio y emitir eventos parciales y finales.
        """
        accumulated_chunks: List[np.ndarray] = []
        speech_detected = False
        silence_frame_count = 0
        timeline_offset = 0.0  # Segundos totales transcurridos
        last_partial_time = 0.0

        def process_segment(audio_buf: np.ndarray, is_final: bool) -> Tuple[str, List[Dict[str, Any]]]:
            if len(audio_buf) < int(SAMPLE_RATE * MIN_SEGMENT_DURATION_SEC):
                return "", []

            if self._model is None:
                return "", []

            try:
                with self._model_lock:
                    # Inferencia de baja latencia: beam_size=1, vad_filter=False (ya filtramos nosotros)
                    segments, _ = self._model.transcribe(
                        audio_buf,
                        language=language,
                        beam_size=1,
                        best_of=1,
                        temperature=0.0,
                        condition_on_previous_text=False,
                        word_timestamps=True
                    )
                    words_list = []
                    text_parts = []
                    for seg in segments:
                        text_parts.append(seg.text.strip())
                        if hasattr(seg, "words") and seg.words:
                            for w in seg.words:
                                words_list.append({
                                    "word": w.word,
                                    "start": round(timeline_offset + w.start, 2),
                                    "end": round(timeline_offset + w.end, 2),
                                    "prob": round(float(w.probability), 2)
                                })
                    
                    full_segment_text = " ".join(text_parts).strip()
                    return full_segment_text, words_list
            except Exception as e:
                logger.error(f"[LiveTranscription] Error en inferencia Whisper: {e}")
                return "", []

        while not self._stop_event.is_set():
            try:
                chunk = self._audio_queue.get(timeout=0.15)
            except queue.Empty:
                chunk = None

            if self._is_cancelled:
                break

            if chunk is not None:
                # Comprobar nivel RMS del fragmento
                rms = float(np.sqrt(np.mean(np.square(chunk)))) if len(chunk) > 0 else 0.0

                if rms >= SILENCE_RMS_THRESHOLD:
                    speech_detected = True
                    silence_frame_count = 0
                    accumulated_chunks.append(chunk)
                else:
                    silence_frame_count += 1
                    if speech_detected:
                        accumulated_chunks.append(chunk)
                    else:
                        # Silencio continuo antes de cualquier habla: descartar y avanzar offset
                        timeline_offset += len(chunk) / SAMPLE_RATE

            # Calcular duración del audio acumulado
            accumulated_samples = sum(len(c) for c in accumulated_chunks)
            accumulated_duration = accumulated_samples / SAMPLE_RATE

            now = time.perf_counter()

            # Caso 1: Actualización Parcial (Mientras se está hablando)
            if speech_detected and accumulated_duration >= MIN_SEGMENT_DURATION_SEC:
                if (now - last_partial_time) >= MIN_PARTIAL_INTERVAL_SEC:
                    audio_arr = np.concatenate(accumulated_chunks, axis=0) if accumulated_chunks else np.array([], dtype=np.float32)
                    partial_text, partial_words = process_segment(audio_arr, is_final=False)

                    if partial_text:
                        with self._session_lock:
                            self._seq_counter += 1
                            seq = self._seq_counter

                        self._broadcast_event("partial", {
                            "session_id": session_id,
                            "seq": seq,
                            "start": round(timeline_offset, 2),
                            "duration": round(accumulated_duration, 2),
                            "text": partial_text,
                            "words": partial_words
                        })
                    last_partial_time = now

            # Caso 2: Cierre y confirmación de segmento final (Pausa detectada o longitud máxima)
            should_finalize = False
            if speech_detected:
                if silence_frame_count >= SILENCE_CONSECUTIVE_FRAMES and accumulated_duration >= MIN_SEGMENT_DURATION_SEC:
                    should_finalize = True
                elif accumulated_duration >= MAX_SEGMENT_DURATION_SEC:
                    should_finalize = True

            if should_finalize and accumulated_chunks:
                audio_arr = np.concatenate(accumulated_chunks, axis=0)
                final_text, final_words = process_segment(audio_arr, is_final=True)

                if final_text:
                    with self._session_lock:
                        self._seq_counter += 1
                        seq = self._seq_counter
                        seg_data = {
                            "seq": seq,
                            "start": round(timeline_offset, 2),
                            "end": round(timeline_offset + accumulated_duration, 2),
                            "text": final_text,
                            "words": final_words
                        }
                        self._confirmed_segments.append(seg_data)

                    self._broadcast_event("final_segment", {
                        "session_id": session_id,
                        **seg_data
                    })

                timeline_offset += accumulated_duration
                accumulated_chunks = []
                speech_detected = False
                silence_frame_count = 0
                last_partial_time = now

        # Flush final al detener la sesión
        if not self._is_cancelled and speech_detected and accumulated_chunks:
            audio_arr = np.concatenate(accumulated_chunks, axis=0)
            accumulated_duration = len(audio_arr) / SAMPLE_RATE
            final_text, final_words = process_segment(audio_arr, is_final=True)

            if final_text:
                with self._session_lock:
                    self._seq_counter += 1
                    seq = self._seq_counter
                    seg_data = {
                        "seq": seq,
                        "start": round(timeline_offset, 2),
                        "end": round(timeline_offset + accumulated_duration, 2),
                        "text": final_text,
                        "words": final_words
                    }
                    self._confirmed_segments.append(seg_data)

                self._broadcast_event("final_segment", {
                    "session_id": session_id,
                    **seg_data
                })


# Instancia global del servicio
live_transcription_service = LiveTranscriptionService()
