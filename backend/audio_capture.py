"""
audio_capture.py
Captura el audio del sistema operativo (loopback) y/o micrófono.
Soporta multithreading para capturar ambos simultáneamente y mezclarlos en post-producción.
"""

import soundcard as sc
import sys
import importlib
import inspect

# --- HOTFIX para la librería soundcard en Windows ---
if sys.platform == 'win32':
    try:
        import soundcard.mediafoundation as mf
        source_file = inspect.getsourcefile(mf)
        if source_file:
            with open(source_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            target_assert_1 = "assert ppMixFormat[0][0].Format.wFormatTag == 0xFFFE"
            target_assert_2 = "assert ppMixFormat[0][0].Format.wFormatTag in (1, 3, 0xFFFE)"
            
            if target_assert_1 in content and target_assert_2 not in content:
                print("[AudioCapture] Aplicando hotfix dinámico a soundcard.mediafoundation...")
                content = content.replace(target_assert_1, f"{target_assert_2}  # HOTFIX")
                with open(source_file, 'w', encoding='utf-8') as f:
                    f.write(content)
                # Recargar el módulo para que el cambio tome efecto en esta ejecución
                importlib.reload(mf)
                importlib.reload(sc)
                print("[AudioCapture] Hotfix aplicado y módulo recargado correctamente.")
    except Exception as e:
        print(f"[AudioCapture] Advertencia: No se pudo verificar o aplicar el hotfix a soundcard: {e}")
# ---------------------------------------------------

import numpy as np
import wave
import threading
import os
from datetime import datetime
import time
import traceback
import subprocess

# Configuración de audio
SAMPLE_RATE = 48000
DTYPE = "float32"
CHUNK_SIZE = SAMPLE_RATE // 5  # 200ms

class AudioCapture:
    def __init__(self):
        self._recording = False
        self._paused = False
        self._mode = "both" # "system", "mic", "both"
        self._mic_id = "default"
        
        # Almacenamiento de frames por canal
        self._frames_sys = []
        self._frames_mic = []
        
        self._thread_sys = None
        self._thread_mic = None
        
        self._output_path = None
        
        # Frecuencias de muestreo reales utilizadas por dispositivo
        self._sys_sr = SAMPLE_RATE
        self._mic_sr = SAMPLE_RATE

    def get_loopback_device(self):
        try:
            default_speaker = sc.default_speaker()
            loopback = sc.get_microphone(default_speaker.name, include_loopback=True)
            return loopback
        except Exception as e:
            raise RuntimeError(f"No se pudo obtener el dispositivo de loopback: {e}")

    def get_mic_device(self):
        try:
            if self._mic_id == "default" or not self._mic_id:
                return sc.default_microphone()
            else:
                return sc.get_microphone(self._mic_id)
        except Exception as e:
            raise RuntimeError(f"No se pudo obtener el micrófono: {e}")

    def start(self, output_dir: str = "recordings", mode: str = "both", mic_device_id: str = "default") -> str:
        if self._recording:
            raise RuntimeError("Ya hay una grabación en curso.")

        os.makedirs(output_dir, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self._output_path = os.path.join(output_dir, f"meeting_{timestamp}.wav")

        self._mode = mode
        self._mic_id = mic_device_id
        self._recording = True
        self._paused = False
        self._frames_sys = []
        self._frames_mic = []
        self._sys_sr = SAMPLE_RATE
        self._mic_sr = SAMPLE_RATE

        # Lanzar hilos según el modo
        if self._mode in ["system", "both"]:
            self._thread_sys = threading.Thread(target=self._record_loop, args=("sys",), daemon=True)
            self._thread_sys.start()
            
        if self._mode in ["mic", "both"]:
            self._thread_mic = threading.Thread(target=self._record_loop, args=("mic",), daemon=True)
            self._thread_mic.start()

        print(f"[AudioCapture] Grabación iniciada en modo '{self._mode}' -> {self._output_path}")
        return self._output_path

    def _record_loop(self, source_type: str):
        try:
            if source_type == "sys":
                device = self.get_loopback_device()
                target_frames = self._frames_sys
            else:
                device = self.get_mic_device()
                target_frames = self._frames_mic
                
        except Exception as e:
            error_msg = f"[AudioCapture] Error al abrir el dispositivo de audio ({source_type}): {e}"
            print(error_msg)
            traceback.print_exc()
            if source_type == "sys":
                print("[AudioCapture] TIP: Si estás en Windows y el loopback falla, asegúrate de tener algún sonido reproduciéndose antes de iniciar la grabación.")
            
            # Si ambos hilos fallan, cancelamos la grabación general
            if self._mode == "both":
                print(f"[AudioCapture] Advertencia: falló la captura de {source_type}, pero se intentará grabar la otra fuente.")
            else:
                self._recording = False
            return

        channels = device.channels
        
        # Intentar inicializar el grabador con frecuencias estándar
        samplerates_to_try = [SAMPLE_RATE, 44100, 16000, 32000, 48000, 8000]
        seen = set()
        samplerates_to_try = [x for x in samplerates_to_try if not (x in seen or seen.add(x))]
        
        recorder = None
        used_sr = SAMPLE_RATE
        
        for sr in samplerates_to_try:
            try:
                rec_candidate = device.recorder(samplerate=sr, channels=channels)
                with rec_candidate:
                    pass
                recorder = rec_candidate
                used_sr = sr
                break
            except Exception as e:
                recorder = None
                continue

        if recorder is None:
            print(f"[AudioCapture] Error: No se pudo iniciar el grabador para ({source_type}) en ninguna frecuencia soportada.")
            if source_type == "sys":
                print("[AudioCapture] TIP: Si estás en Windows y el loopback falla, asegúrate de tener algún sonido reproduciéndose antes de iniciar la grabación.")
            
            if self._mode == "both":
                print(f"[AudioCapture] Advertencia: falló la grabación de {source_type}, pero se intentará grabar la otra fuente.")
            else:
                self._recording = False
            return

        if source_type == "sys":
            self._sys_sr = used_sr
            print(f"[AudioCapture] Capturando loopback a {used_sr} Hz")
        else:
            self._mic_sr = used_sr
            print(f"[AudioCapture] Capturando micrófono a {used_sr} Hz")

        try:
            with recorder as mic:
                chunk_size = used_sr // 5  # ~200ms dinámico según frecuencia
                while self._recording:
                    chunk = mic.record(numframes=chunk_size)
                    if not self._paused:
                        target_frames.append(chunk)
        except Exception as e:
            print(f"[AudioCapture] Error en el loop de grabación de {source_type}: {e}")
            traceback.print_exc()
            if self._mode != "both":
                self._recording = False

    def pause(self):
        if not self._recording:
            raise RuntimeError("No hay una grabación activa.")
        self._paused = True
        print("[AudioCapture] Grabación pausada.")

    def resume(self):
        if not self._recording:
            raise RuntimeError("No hay una grabación activa.")
        self._paused = False
        print("[AudioCapture] Grabación reanudada.")

    def _process_audio_array(self, frames_list, orig_sr):
        """Convierte una lista de chunks a un array mono unidimensional y lo resamplea al SAMPLE_RATE global"""
        if not frames_list:
            return np.array([], dtype=DTYPE)
        
        audio_data = np.concatenate(frames_list, axis=0)
        # Convertir a mono
        if audio_data.ndim > 1 and audio_data.shape[1] > 1:
            audio_data = np.mean(audio_data, axis=1)
        else:
            audio_data = audio_data.flatten()
            
        # Si el sample rate original difiere del SAMPLE_RATE global, resampleamos
        if orig_sr != SAMPLE_RATE and len(audio_data) > 0:
            print(f"[AudioCapture] Resampleando audio de {orig_sr} Hz a {SAMPLE_RATE} Hz...")
            duration = len(audio_data) / orig_sr
            num_samples = int(duration * SAMPLE_RATE)
            audio_data = np.interp(
                np.linspace(0, len(audio_data), num_samples, endpoint=False),
                np.arange(len(audio_data)),
                audio_data
            )
            
        return audio_data

    def stop(self) -> str:
        if not self._recording:
            raise RuntimeError("No hay una grabación activa.")

        self._recording = False
        self._paused = False
        
        # Esperar a que los hilos terminen
        if self._thread_sys:
            self._thread_sys.join(timeout=3)
        if self._thread_mic:
            self._thread_mic.join(timeout=3)

        sys_array = self._process_audio_array(self._frames_sys, self._sys_sr)
        mic_array = self._process_audio_array(self._frames_mic, self._mic_sr)
        
        # Mezclar (Mixer)
        audio_final = np.array([], dtype=DTYPE)
        
        if self._mode == "both":
            # Emparejar tamaños llenando con ceros al final
            max_len = max(len(sys_array), len(mic_array))
            if len(sys_array) < max_len:
                sys_array = np.pad(sys_array, (0, max_len - len(sys_array)), 'constant')
            if len(mic_array) < max_len:
                mic_array = np.pad(mic_array, (0, max_len - len(mic_array)), 'constant')
            
            # Sumar ambos canales
            audio_final = sys_array + mic_array
        elif self._mode == "system":
            audio_final = sys_array
        elif self._mode == "mic":
            audio_final = mic_array
            
        # Guardar archivo si hay datos
        if len(audio_final) > 0:
            # Normalizar para evitar clipping
            max_val = np.max(np.abs(audio_final))
            
            if max_val < 0.0001:
                print("[AudioCapture] ADVERTENCIA: El audio grabado es completamente silencioso (max_val muy cercano a 0).")
                
            if max_val > 0.01:
                audio_final = (audio_final / max_val) * 0.9
                
            # Convertir a int16
            audio_int16 = (audio_final * 32767).astype(np.int16)

            with wave.open(self._output_path, "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(SAMPLE_RATE)
                wf.writeframes(audio_int16.tobytes())

            print(f"[AudioCapture] Mezcla guardada temporalmente -> {self._output_path}")

            # Compress to MP3 to save space via FFmpeg
            try:
                mp3_path = self._output_path.replace(".wav", ".mp3")
                print("[AudioCapture] Comprimiendo a MP3 con FFmpeg...")
                # Llama a ffmpeg (se asume en PATH o configurado por backend)
                cmd = ["ffmpeg", "-y", "-i", self._output_path, "-b:a", "64k", mp3_path]
                # Ejecutar y suprimir la salida de consola de ffmpeg
                subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
                
                os.remove(self._output_path)
                self._output_path = mp3_path
                print(f"[AudioCapture] Compresión exitosa -> {self._output_path}")
            except Exception as e:
                print(f"[AudioCapture] Advertencia: No se pudo comprimir a MP3 ({e}). Se mantendrá el WAV original.")
        else:
            print("[AudioCapture] Advertencia: No se capturó ningún audio.")
            
        return self._output_path

    @property
    def is_recording(self) -> bool:
        return self._recording

    @property
    def is_paused(self) -> bool:
        return self._paused

    @property
    def output_path(self) -> str:
        return self._output_path
