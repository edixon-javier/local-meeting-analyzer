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
                
                target_assert_1 = "assert ppMixFormat[0][0].Format.wFormatTag == 0xFFFE"
                target_assert_2 = "assert ppMixFormat[0][0].Format.wFormatTag in (1, 3, 0xFFFE)"
                
                if target_assert_1 in content and target_assert_2 not in content:
                    print("[AudioService] Aplicando hotfix dinámico a soundcard.mediafoundation...")
                    content = content.replace(target_assert_1, f"{target_assert_2}  # HOTFIX")
                    with open(source_file, 'w', encoding='utf-8') as f:
                        f.write(content)
                    importlib.reload(mf)
                    importlib.reload(sc)
                    print("[AudioService] Hotfix aplicado y módulo recargado correctamente.")
        except Exception as e:
            print(f"[AudioService] Advertencia: No se pudo verificar o aplicar el hotfix a soundcard: {e}")

_apply_soundcard_hotfix()
# ---------------------------------------------------

SAMPLE_RATE = 48000
DTYPE = "float32"
CHUNK_SIZE = SAMPLE_RATE // 5  # 200ms

class AudioService(IAudioCapture):
    def __init__(self):
        self._recording = False
        self._paused = False
        self._mode = "both"
        self._mic_id = "default"
        self._frames_sys = []
        self._frames_mic = []
        self._thread_sys = None
        self._thread_mic = None
        self._output_path = None

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

    def start(self, output_dir: str, mode: str, mic_device_id: str) -> str:
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

        if self._mode in ["system", "both"]:
            self._thread_sys = threading.Thread(target=self._record_loop, args=("sys",), daemon=True)
            self._thread_sys.start()
            
        if self._mode in ["mic", "both"]:
            self._thread_mic = threading.Thread(target=self._record_loop, args=("mic",), daemon=True)
            self._thread_mic.start()

        print(f"[AudioService] Grabación iniciada en modo '{self._mode}' -> {self._output_path}")
        return self._output_path

    def _record_loop(self, source_type: str):
        try:
            if source_type == "sys":
                device = self._get_loopback_device()
                target_frames = self._frames_sys
            else:
                device = self._get_mic_device()
                target_frames = self._frames_mic
                
        except Exception as e:
            print(f"[AudioService] Error al abrir dispositivo ({source_type}): {e}")
            if source_type == "sys":
                print("[AudioService] TIP: Asegúrate de tener algún sonido reproduciéndose antes de iniciar la grabación.")
            
            if self._mode == "both":
                print(f"[AudioService] Advertencia: falló captura de {source_type}, intentando con la otra.")
            else:
                self._recording = False
            return

        channels = device.channels
        try:
            with device.recorder(samplerate=SAMPLE_RATE, channels=channels) as mic:
                while self._recording:
                    chunk = mic.record(numframes=CHUNK_SIZE)
                    if not self._paused:
                        target_frames.append(chunk)
        except Exception as e:
            print(f"[AudioService] Error en grabación {source_type}: {e}")
            if self._mode != "both":
                self._recording = False

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

    def _process_audio_array(self, frames_list):
        if not frames_list:
            return np.array([], dtype=DTYPE)
        
        audio_data = np.concatenate(frames_list, axis=0)
        if audio_data.ndim > 1 and audio_data.shape[1] > 1:
            audio_data = np.mean(audio_data, axis=1)
        else:
            audio_data = audio_data.flatten()
        return audio_data

    def stop(self) -> str:
        if not self._recording:
            raise RuntimeError("No hay grabación activa.")

        self._recording = False
        self._paused = False
        
        if self._thread_sys:
            self._thread_sys.join(timeout=3)
        if self._thread_mic:
            self._thread_mic.join(timeout=3)

        sys_array = self._process_audio_array(self._frames_sys)
        mic_array = self._process_audio_array(self._frames_mic)
        
        audio_final = np.array([], dtype=DTYPE)
        
        if self._mode == "both":
            max_len = max(len(sys_array), len(mic_array))
            if len(sys_array) < max_len:
                sys_array = np.pad(sys_array, (0, max_len - len(sys_array)), 'constant')
            if len(mic_array) < max_len:
                mic_array = np.pad(mic_array, (0, max_len - len(mic_array)), 'constant')
            audio_final = sys_array + mic_array
        elif self._mode == "system":
            audio_final = sys_array
        elif self._mode == "mic":
            audio_final = mic_array
            
        if len(audio_final) > 0:
            max_val = np.max(np.abs(audio_final))
            if max_val > 0.01:
                audio_final = (audio_final / max_val) * 0.9
                
            audio_int16 = (audio_final * 32767).astype(np.int16)

            with wave.open(self._output_path, "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(SAMPLE_RATE)
                wf.writeframes(audio_int16.tobytes())

            print(f"[AudioService] Mezcla guardada temporalmente -> {self._output_path}")

            try:
                mp3_path = self._output_path.replace(".wav", ".mp3")
                print("[AudioService] Comprimiendo a MP3 con FFmpeg...")
                cmd = ["ffmpeg", "-y", "-i", self._output_path, "-b:a", "64k", mp3_path]
                subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
                
                os.remove(self._output_path)
                self._output_path = mp3_path
                print(f"[AudioService] Compresión exitosa -> {self._output_path}")
            except Exception as e:
                print(f"[AudioService] Advertencia: No se pudo comprimir a MP3 ({e}).")
        else:
            print("[AudioService] Advertencia: No se capturó ningún audio.")
            
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

# Global instance for injection
audio_service = AudioService()
