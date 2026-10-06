import sys
import importlib
import inspect
import soundcard as sc
import numpy as np
import wave
import threading
import os
from datetime import datetime
import traceback
import subprocess
from domain.interfaces import IAudioCapture

# --- HOTFIX para la librería soundcard en Windows ---
def _apply_soundcard_hotfix():
    if sys.platform == 'win32':
        try:
            import soundcard.mediafoundation as mf
            source_file = inspect.getsourcefile(mf)
            if source_file:
                with open(source_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                modified = False
                
                target_assert_1 = "assert ppMixFormat[0][0].Format.wFormatTag == 0xFFFE"
                target_assert_2 = "assert ppMixFormat[0][0].Format.wFormatTag in (1, 3, 0xFFFE)"
                if target_assert_1 in content:
                    print("[AudioService] Aplicando hotfix dinámico (wFormatTag) a soundcard.mediafoundation...")
                    content = content.replace(target_assert_1, f"{target_assert_2}  # HOTFIX")
                    modified = True

                cb_assert_1 = "assert ppMixFormat[0][0].Format.cbSize == 22"
                cb_assert_2 = "assert ppMixFormat[0][0].Format.cbSize in (0, 2, 22, 32)"
                if cb_assert_1 in content:
                    print("[AudioService] Aplicando hotfix dinámico (cbSize) a soundcard.mediafoundation...")
                    content = content.replace(cb_assert_1, f"{cb_assert_2}  # HOTFIX")
                    modified = True

                subfmt_block_1 = "        assert ppMixFormat[0][0].SubFormat.Data1 == 0x100000\n        assert ppMixFormat[0][0].SubFormat.Data2 == 0x0080\n        assert ppMixFormat[0][0].SubFormat.Data3 == 0xaa00\n        assert [int(x) for x in ppMixFormat[0][0].SubFormat.Data4[0:4]] == [0, 56, 155, 113]"
                subfmt_block_2 = "        if ppMixFormat[0][0].Format.wFormatTag == 0xFFFE:\n            assert ppMixFormat[0][0].SubFormat.Data1 == 0x100000\n            assert ppMixFormat[0][0].SubFormat.Data2 == 0x0080\n            assert ppMixFormat[0][0].SubFormat.Data3 == 0xaa00\n            assert [int(x) for x in ppMixFormat[0][0].SubFormat.Data4[0:4]] == [0, 56, 155, 113]  # HOTFIX"
                if subfmt_block_1 in content:
                    print("[AudioService] Aplicando hotfix dinámico (SubFormat) a soundcard.mediafoundation...")
                    content = content.replace(subfmt_block_1, subfmt_block_2)
                    modified = True
                
                if modified:
                    with open(source_file, 'w', encoding='utf-8') as f:
                        f.write(content)
                    importlib.reload(mf)
                    importlib.reload(sc)
                    print("[AudioService] Hotfix(es) de soundcard aplicado(s) y módulo(s) recargado(s) correctamente.")
        except Exception as e:
            print(f"[AudioService] Advertencia: No se pudo verificar o aplicar el hotfix a soundcard: {e}")

_apply_soundcard_hotfix()
# ---------------------------------------------------

def _get_ffmpeg_path() -> str:
    # Delegado a core.paths (bin/ empaquetado, MEETING_ANALYZER_BIN_DIR o PATH)
    from core.paths import get_ffmpeg_path
    return get_ffmpeg_path()

SAMPLE_RATE = 48000
DTYPE = "float32"
CHUNK_SIZE = SAMPLE_RATE // 5  # 200ms

class AudioService(IAudioCapture):
    def __init__(self):
        self._recording = False
        self._paused = False
        self._is_testing = False
        self._mode = "both"
        self._mic_id = "default"
        self._thread_sys = None
        self._thread_mic = None
        self._output_path = None
        self._temp_sys_path = None
        self._temp_mic_path = None
        self._file_sys = None
        self._file_mic = None
        self._last_sys_level = 0.0
        self._last_mic_level = 0.0
        self._live_listeners = []
        self._live_listeners_lock = threading.Lock()
        self._pending_chunks = {}
        self._mix_lock = threading.Lock()

    def _get_loopback_device(self):
        try:
            default_speaker = sc.default_speaker()
            loopback = sc.get_microphone(default_speaker.name, include_loopback=True)
            return loopback
        except Exception as e:
            raise RuntimeError(f"No se pudo obtener el dispositivo de loopback: {e}")

    def _get_mic_device(self):
        try:
            if self._mic_id == "default" or not self._mic_id:
                return sc.default_microphone()
            else:
                return sc.get_microphone(self._mic_id)
        except Exception as e:
            raise RuntimeError(f"No se pudo obtener el micrófono: {e}")

    @property
    def is_testing(self) -> bool:
        return self._is_testing

    def add_live_listener(self, callback):
        with self._live_listeners_lock:
            if callback not in self._live_listeners:
                self._live_listeners.append(callback)

    def remove_live_listener(self, callback):
        with self._live_listeners_lock:
            if callback in self._live_listeners:
                self._live_listeners.remove(callback)

    def _notify_live_listeners(self, chunk_16k: np.ndarray):
        with self._live_listeners_lock:
            listeners = list(self._live_listeners)
        for listener in listeners:
            try:
                listener(chunk_16k)
            except Exception as e:
                print(f"[AudioService] Error notificando listener en vivo: {e}")

    def _handle_live_chunk(self, source_type: str, mono_chunk: np.ndarray):
        if not self._live_listeners or self._is_testing or mono_chunk is None or len(mono_chunk) == 0:
            return

        if self._mode in ["mic", "system"]:
            if (self._mode == "mic" and source_type == "mic") or (self._mode == "system" and source_type == "sys"):
                n = (len(mono_chunk) // 3) * 3
                if n > 0:
                    c = mono_chunk[:n]
                    chunk_16k = (c[0::3] + c[1::3] + c[2::3]) / 3.0
                    self._notify_live_listeners(chunk_16k.astype(np.float32))
        elif self._mode == "both":
            with self._mix_lock:
                if source_type in self._pending_chunks:
                    old = self._pending_chunks.pop(source_type)
                    n = (len(old) // 3) * 3
                    if n > 0:
                        c = old[:n]
                        chunk_16k = (c[0::3] + c[1::3] + c[2::3]) / 3.0
                        self._notify_live_listeners(chunk_16k.astype(np.float32))
                self._pending_chunks[source_type] = mono_chunk
                if "sys" in self._pending_chunks and "mic" in self._pending_chunks:
                    sys_c = self._pending_chunks.pop("sys")
                    mic_c = self._pending_chunks.pop("mic")
                    min_len = min(len(sys_c), len(mic_c))
                    n = (min_len // 3) * 3
                    if n > 0:
                        mixed = sys_c[:n] + mic_c[:n]
                        chunk_16k = (mixed[0::3] + mixed[1::3] + mixed[2::3]) / 3.0
                        self._notify_live_listeners(chunk_16k.astype(np.float32))

    def start(self, output_dir: str, mode: str, mic_device_id: str) -> str:
        if self._recording or self._is_testing:
            raise RuntimeError("Ya hay una grabación o prueba en curso.")

        os.makedirs(output_dir, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self._output_path = os.path.join(output_dir, f"meeting_{timestamp}.wav")
        self._temp_sys_path = self._output_path + ".sys.raw"
        self._temp_mic_path = self._output_path + ".mic.raw"

        self._mode = mode
        self._mic_id = mic_device_id
        self._recording = True
        self._paused = False
        self._last_sys_level = 0.0
        self._last_mic_level = 0.0
        self._file_sys = None
        self._file_mic = None

        try:
            if self._mode in ["system", "both"]:
                self._file_sys = open(self._temp_sys_path, "wb")
            if self._mode in ["mic", "both"]:
                self._file_mic = open(self._temp_mic_path, "wb")
        except Exception as e:
            if self._file_sys:
                try: self._file_sys.close()
                except Exception: pass
            if self._file_mic:
                try: self._file_mic.close()
                except Exception: pass
            self._recording = False
            self._is_testing = False
            raise RuntimeError(f"No se pudieron inicializar los archivos temporales de grabación: {e}")

        if self._mode in ["system", "both"]:
            self._thread_sys = threading.Thread(target=self._record_loop, args=("sys",), daemon=True)
            self._thread_sys.start()
            
        if self._mode in ["mic", "both"]:
            self._thread_mic = threading.Thread(target=self._record_loop, args=("mic",), daemon=True)
            self._thread_mic.start()

        print(f"[AudioService] Grabación iniciada en modo '{self._mode}' -> {self._output_path}")
        return self._output_path

    def start_test(self, output_dir: str, mode: str, mic_device_id: str) -> str:
        if self._recording or self._is_testing:
            raise RuntimeError("Ya hay una grabación o prueba en curso.")

        os.makedirs(output_dir, exist_ok=True)
        self._output_path = os.path.join(output_dir, "test_capture.wav")
        self._temp_sys_path = self._output_path + ".sys.raw"
        self._temp_mic_path = self._output_path + ".mic.raw"

        self._mode = mode
        self._mic_id = mic_device_id
        self._is_testing = True
        self._recording = True
        self._paused = False
        self._last_sys_level = 0.0
        self._last_mic_level = 0.0
        self._file_sys = None
        self._file_mic = None

        try:
            if self._mode in ["system", "both"]:
                self._file_sys = open(self._temp_sys_path, "wb")
            if self._mode in ["mic", "both"]:
                self._file_mic = open(self._temp_mic_path, "wb")
        except Exception as e:
            if self._file_sys:
                try: self._file_sys.close()
                except Exception: pass
            if self._file_mic:
                try: self._file_mic.close()
                except Exception: pass
            self._recording = False
            self._is_testing = False
            raise RuntimeError(f"No se pudieron inicializar los archivos temporales de prueba: {e}")

        if self._mode in ["system", "both"]:
            self._thread_sys = threading.Thread(target=self._record_loop, args=("sys",), daemon=True)
            self._thread_sys.start()
            
        if self._mode in ["mic", "both"]:
            self._thread_mic = threading.Thread(target=self._record_loop, args=("mic",), daemon=True)
            self._thread_mic.start()

        print(f"[AudioService] Prueba de audio iniciada en modo '{self._mode}' -> {self._output_path}")
        return self._output_path

    def _record_loop(self, source_type: str):
        file_handle = None
        try:
            if source_type == "sys":
                device = self._get_loopback_device()
                file_handle = self._file_sys
            else:
                device = self._get_mic_device()
                file_handle = self._file_mic
                
        except Exception as e:
            print(f"[AudioService] Error al abrir dispositivo ({source_type}): {e}")
            if source_type == "sys":
                print("[AudioService] TIP: Asegúrate de tener algún sonido reproduciéndose antes de iniciar la grabación.")
            
            if self._mode == "both":
                print(f"[AudioService] Advertencia: falló captura de {source_type}, intentando con la otra.")
            else:
                self._recording = False
                self._is_testing = False
            return

        channels = device.channels
        try:
            with device.recorder(samplerate=SAMPLE_RATE, channels=channels) as mic:
                while self._recording:
                    chunk = mic.record(numframes=CHUNK_SIZE)
                    
                    if chunk is not None and len(chunk) > 0:
                        # Convert to mono immediately
                        if chunk.ndim > 1 and chunk.shape[1] > 1:
                            mono_chunk = np.mean(chunk, axis=1)
                        else:
                            mono_chunk = chunk.flatten()
                        
                        rms = float(np.sqrt(np.mean(np.square(mono_chunk))))
                    else:
                        mono_chunk = None
                        rms = 0.0
                        
                    if source_type == "sys":
                        self._last_sys_level = rms
                    else:
                        self._last_mic_level = rms
                        
                    if not self._paused and mono_chunk is not None and len(mono_chunk) > 0:
                        if file_handle and not file_handle.closed:
                            try:
                                file_handle.write(mono_chunk.astype(DTYPE).tobytes())
                                file_handle.flush()
                            except (ValueError, OSError):
                                break
                        self._handle_live_chunk(source_type, mono_chunk)
        except Exception as e:
            print(f"[AudioService] Error en grabación {source_type}: {e}")
            traceback.print_exc()
            if self._mode != "both":
                self._recording = False
                self._is_testing = False

    def pause(self):
        if not self._recording:
            raise RuntimeError("No hay grabación activa.")
        self._paused = True
        print("[AudioService] Grabación pausada.")

    def resume(self):
        if not self._recording:
            raise RuntimeError("No hay grabación activa.")
        self._paused = False
        print("[AudioService] Grabación reanudada.")

    def _save_and_clean_audio(self) -> str:
        # Join threads
        if self._thread_sys:
            self._thread_sys.join(timeout=3)
            self._thread_sys = None
        if self._thread_mic:
            self._thread_mic.join(timeout=3)
            self._thread_mic = None

        # Close temporary file handles if they are still open
        if hasattr(self, "_file_sys") and self._file_sys:
            try:
                self._file_sys.close()
            except Exception:
                pass
            self._file_sys = None

        if hasattr(self, "_file_mic") and self._file_mic:
            try:
                self._file_mic.close()
            except Exception:
                pass
            self._file_mic = None

        # Check raw files sizes
        sys_exists = self._temp_sys_path and os.path.exists(self._temp_sys_path)
        mic_exists = self._temp_mic_path and os.path.exists(self._temp_mic_path)
        
        sys_size = os.path.getsize(self._temp_sys_path) if sys_exists else 0
        mic_size = os.path.getsize(self._temp_mic_path) if mic_exists else 0
        
        sys_samples = sys_size // 4  # float32 is 4 bytes
        mic_samples = mic_size // 4
        
        max_samples = 0
        if self._mode == "both":
            max_samples = max(sys_samples, mic_samples)
        elif self._mode == "system":
            max_samples = sys_samples
        elif self._mode == "mic":
            max_samples = mic_samples

        if max_samples > 0:
            # Block parameters
            # 5 seconds block
            block_samples = SAMPLE_RATE * 5
            
            # Pass 1: Find maximum absolute value for normalization
            max_val = 0.0
            
            # Open temporary files in read binary mode
            f_sys = open(self._temp_sys_path, "rb") if sys_exists and self._mode in ["system", "both"] else None
            f_mic = open(self._temp_mic_path, "rb") if mic_exists and self._mode in ["mic", "both"] else None
            
            try:
                for start_sample in range(0, max_samples, block_samples):
                    curr_block_samples = min(block_samples, max_samples - start_sample)
                    
                    sys_block = np.zeros(curr_block_samples, dtype=DTYPE)
                    mic_block = np.zeros(curr_block_samples, dtype=DTYPE)
                    
                    if f_sys:
                        data = f_sys.read(curr_block_samples * 4)
                        if data:
                            read_arr = np.frombuffer(data, dtype=DTYPE)
                            sys_block[:len(read_arr)] = read_arr
                            
                    if f_mic:
                        data = f_mic.read(curr_block_samples * 4)
                        if data:
                            read_arr = np.frombuffer(data, dtype=DTYPE)
                            mic_block[:len(read_arr)] = read_arr
                            
                    if self._mode == "both":
                        mixed_block = sys_block + mic_block
                    elif self._mode == "system":
                        mixed_block = sys_block
                    else:
                        mixed_block = mic_block
                        
                    if len(mixed_block) > 0:
                        block_max = np.max(np.abs(mixed_block))
                        if block_max > max_val:
                            max_val = block_max
            finally:
                if f_sys: f_sys.close()
                if f_mic: f_mic.close()

            # Pass 2: Write normalized audio to WAV
            f_sys = open(self._temp_sys_path, "rb") if sys_exists and self._mode in ["system", "both"] else None
            f_mic = open(self._temp_mic_path, "rb") if mic_exists and self._mode in ["mic", "both"] else None
            
            try:
                with wave.open(self._output_path, "wb") as wf:
                    wf.setnchannels(1)
                    wf.setsampwidth(2) # 16-bit
                    wf.setframerate(SAMPLE_RATE)
                    
                    for start_sample in range(0, max_samples, block_samples):
                        curr_block_samples = min(block_samples, max_samples - start_sample)
                        
                        sys_block = np.zeros(curr_block_samples, dtype=DTYPE)
                        mic_block = np.zeros(curr_block_samples, dtype=DTYPE)
                        
                        if f_sys:
                            data = f_sys.read(curr_block_samples * 4)
                            if data:
                                read_arr = np.frombuffer(data, dtype=DTYPE)
                                sys_block[:len(read_arr)] = read_arr
                                
                        if f_mic:
                            data = f_mic.read(curr_block_samples * 4)
                            if data:
                                read_arr = np.frombuffer(data, dtype=DTYPE)
                                mic_block[:len(read_arr)] = read_arr
                                
                        if self._mode == "both":
                            mixed_block = sys_block + mic_block
                        elif self._mode == "system":
                            mixed_block = sys_block
                        else:
                            mixed_block = mic_block
                            
                        if len(mixed_block) > 0:
                            if max_val > 0.01:
                                normalized_block = (mixed_block / max_val) * 0.9
                            else:
                                normalized_block = mixed_block
                                
                            int16_block = (normalized_block * 32767).astype(np.int16)
                            wf.writeframes(int16_block.tobytes())
            finally:
                if f_sys: f_sys.close()
                if f_mic: f_mic.close()

            print(f"[AudioService] Mezcla guardada temporalmente -> {self._output_path}")

            # Compress to MP3
            try:
                mp3_path = self._output_path.replace(".wav", ".mp3")
                print(f"[AudioService] Comprimiendo a MP3 con FFmpeg...")
                cmd = [_get_ffmpeg_path(), "-y", "-i", self._output_path, "-b:a", "64k", mp3_path]
                subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True, timeout=60)
                
                if os.path.exists(self._output_path):
                    os.remove(self._output_path)
                self._output_path = mp3_path
                print(f"[AudioService] Compresión exitosa -> {self._output_path}")
            except Exception as e:
                print(f"[AudioService] Advertencia: No se pudo comprimir a MP3 ({e}).")
        else:
            print("[AudioService] Advertencia: No se capturó ningún audio.")
            try:
                with wave.open(self._output_path, "wb") as wf:
                    wf.setnchannels(1)
                    wf.setsampwidth(2)
                    wf.setframerate(SAMPLE_RATE)
            except Exception as e:
                print(f"[AudioService] Error al escribir cabecera de audio vacío: {e}")
            
        # Clean up temporary raw files
        for temp_path in [self._temp_sys_path, self._temp_mic_path]:
            if temp_path and os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except Exception as e:
                    print(f"[AudioService] Advertencia al eliminar archivo temporal {temp_path}: {e}")

        with self._mix_lock:
            self._pending_chunks.clear()

        self._last_sys_level = 0.0
        self._last_mic_level = 0.0
        return self._output_path

    def stop(self) -> str:
        if not self._recording:
            raise RuntimeError("No hay grabación activa.")

        self._recording = False
        self._paused = False
        
        return self._save_and_clean_audio()

    def cancel(self):
        """Cancela inmediatamente la grabación activa, detiene hilos y libera recursos."""
        self._recording = False
        self._is_testing = False
        self._paused = False

        if self._thread_sys:
            self._thread_sys.join(timeout=2)
            self._thread_sys = None
        if self._thread_mic:
            self._thread_mic.join(timeout=2)
            self._thread_mic = None

        if hasattr(self, "_file_sys") and self._file_sys:
            try:
                self._file_sys.close()
            except Exception:
                pass
            self._file_sys = None

        if hasattr(self, "_file_mic") and self._file_mic:
            try:
                self._file_mic.close()
            except Exception:
                pass
            self._file_mic = None

        for temp_path in [self._temp_sys_path, self._temp_mic_path]:
            if temp_path and os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except Exception:
                    pass

        if self._output_path and os.path.exists(self._output_path):
            try:
                os.remove(self._output_path)
            except Exception:
                pass

        with self._mix_lock:
            self._pending_chunks.clear()

        self._last_sys_level = 0.0
        self._last_mic_level = 0.0
        print("[AudioService] Grabación cancelada y recursos liberados.")

    def stop_test(self) -> str:
        if not self._is_testing:
            raise RuntimeError("No hay ninguna prueba activa.")

        self._recording = False
        self._is_testing = False
        
        return self._save_and_clean_audio()

    def get_levels(self) -> dict:
        return {
            "sys_level": self._last_sys_level,
            "mic_level": self._last_mic_level
        }

    @property
    def is_recording(self) -> bool:
        return self._recording and not self._is_testing

    @property
    def is_paused(self) -> bool:
        return self._paused

    @property
    def output_path(self) -> str:
        return self._output_path

# Global instance for injection
audio_service = AudioService()
