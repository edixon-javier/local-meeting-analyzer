"""
backend/services/win32_injector.py
Inyector Win32 Nativo de 64 bits para inserción de texto en cursor
sin pérdida de foco y preservación íntegra del portapapeles del usuario.

Principios:
1. Firmas ctypes estrictas para x64 (c_size_t en GlobalSize/GlobalAlloc).
2. Filtrado de formatos GDI en el respaldo del portapapeles.
3. Inyección sintética inmediata de Ctrl + V (<5ms) vía SendInput.
4. Banderas de privacidad de Windows 10/11 para no ensuciar el historial de Win+V ni nube.
5. Restauración asíncrona desacoplada del portapapeles original tras 300ms.
6. Detección de elevación (Admin / UIPI) con fallback limpio al portapapeles.
"""

import sys
import os
import time
import ctypes
import threading
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("win32_injector")

# Solo en plataformas Windows
IS_WINDOWS = sys.platform == "win32"

if IS_WINDOWS:
    from ctypes import wintypes

    user32 = ctypes.windll.user32
    kernel32 = ctypes.windll.kernel32
    advapi32 = ctypes.windll.advapi32

    # ─────────────────────────────────────────────────────────────
    # Firmas estrictas de 64 bits para ctypes
    # ─────────────────────────────────────────────────────────────
    kernel32.GlobalAlloc.restype = ctypes.c_void_p
    kernel32.GlobalAlloc.argtypes = [ctypes.c_uint, ctypes.c_size_t]

    kernel32.GlobalLock.restype = ctypes.c_void_p
    kernel32.GlobalLock.argtypes = [ctypes.c_void_p]

    kernel32.GlobalUnlock.restype = ctypes.c_bool
    kernel32.GlobalUnlock.argtypes = [ctypes.c_void_p]

    kernel32.GlobalSize.restype = ctypes.c_size_t
    kernel32.GlobalSize.argtypes = [ctypes.c_void_p]

    kernel32.GlobalFree.restype = ctypes.c_void_p
    kernel32.GlobalFree.argtypes = [ctypes.c_void_p]

    user32.OpenClipboard.restype = ctypes.c_bool
    user32.OpenClipboard.argtypes = [ctypes.c_void_p]

    user32.CloseClipboard.restype = ctypes.c_bool
    user32.CloseClipboard.argtypes = []

    user32.EmptyClipboard.restype = ctypes.c_bool
    user32.EmptyClipboard.argtypes = []

    user32.GetClipboardData.restype = ctypes.c_void_p
    user32.GetClipboardData.argtypes = [ctypes.c_uint]

    user32.SetClipboardData.restype = ctypes.c_void_p
    user32.SetClipboardData.argtypes = [ctypes.c_uint, ctypes.c_void_p]

    user32.EnumClipboardFormats.restype = ctypes.c_uint
    user32.EnumClipboardFormats.argtypes = [ctypes.c_uint]

    user32.RegisterClipboardFormatW.restype = ctypes.c_uint
    user32.RegisterClipboardFormatW.argtypes = [ctypes.c_wchar_p]

    user32.GetForegroundWindow.restype = ctypes.c_void_p
    user32.GetForegroundWindow.argtypes = []

    user32.GetWindowTextW.restype = ctypes.c_int
    user32.GetWindowTextW.argtypes = [ctypes.c_void_p, ctypes.c_wchar_p, ctypes.c_int]

    user32.GetWindowThreadProcessId.restype = ctypes.c_uint
    user32.GetWindowThreadProcessId.argtypes = [ctypes.c_void_p, ctypes.POINTER(wintypes.DWORD)]

    kernel32.OpenProcess.restype = ctypes.c_void_p
    kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]

    kernel32.CloseHandle.restype = wintypes.BOOL
    kernel32.CloseHandle.argtypes = [ctypes.c_void_p]

    kernel32.QueryFullProcessImageNameW.restype = wintypes.BOOL
    kernel32.QueryFullProcessImageNameW.argtypes = [
        ctypes.c_void_p,
        wintypes.DWORD,
        ctypes.c_wchar_p,
        ctypes.POINTER(wintypes.DWORD),
    ]

    advapi32.OpenProcessToken.restype = wintypes.BOOL
    advapi32.OpenProcessToken.argtypes = [ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(wintypes.HANDLE)]

    advapi32.GetTokenInformation.restype = wintypes.BOOL
    advapi32.GetTokenInformation.argtypes = [
        wintypes.HANDLE,
        ctypes.c_int,
        ctypes.c_void_p,
        wintypes.DWORD,
        ctypes.POINTER(wintypes.DWORD),
    ]

    # Estructuras para SendInput en x64 (40 bytes exactos)
    class MOUSEINPUT(ctypes.Structure):
        _fields_ = [
            ("dx", wintypes.LONG),
            ("dy", wintypes.LONG),
            ("mouseData", wintypes.DWORD),
            ("dwFlags", wintypes.DWORD),
            ("time", wintypes.DWORD),
            ("dwExtraInfo", ctypes.c_size_t),
        ]

    class KEYBDINPUT(ctypes.Structure):
        _fields_ = [
            ("wVk", wintypes.WORD),
            ("wScan", wintypes.WORD),
            ("dwFlags", wintypes.DWORD),
            ("time", wintypes.DWORD),
            ("dwExtraInfo", ctypes.c_size_t),
        ]

    class HARDWAREINPUT(ctypes.Structure):
        _fields_ = [
            ("uMsg", wintypes.DWORD),
            ("wParamL", wintypes.WORD),
            ("wParamH", wintypes.WORD),
        ]

    class _INPUT_UNION(ctypes.Union):
        _fields_ = [
            ("mi", MOUSEINPUT),
            ("ki", KEYBDINPUT),
            ("hi", HARDWAREINPUT),
        ]

    class INPUT(ctypes.Structure):
        _fields_ = [
            ("type", wintypes.DWORD),
            ("union", _INPUT_UNION),
        ]

    user32.SendInput.restype = ctypes.c_uint
    user32.SendInput.argtypes = [ctypes.c_uint, ctypes.POINTER(INPUT), ctypes.c_int]

    # Constantes Win32
    GMEM_MOVEABLE = 0x0002
    CF_UNICODETEXT = 13
    INPUT_KEYBOARD = 1
    KEYEVENTF_KEYUP = 0x0002
    VK_CONTROL = 0x11
    VK_V = 0x56

    # Formatos GDI a excluir de la lectura HGLOBAL
    GDI_FORMATS = {
        2,   # CF_BITMAP
        3,   # CF_METAFILEPICT
        9,   # CF_PALETTE
        14,  # CF_ENHMETAFILE
    }

    # Banderas de privacidad del portapapeles de Windows 10/11
    try:
        FMT_NO_HISTORY = user32.RegisterClipboardFormatW("CanIncludeInClipboardHistory")
        FMT_EXCLUDE_MONITOR = user32.RegisterClipboardFormatW("ExcludeClipboardContentFromMonitorProcessing")
        FMT_NO_CLOUD = user32.RegisterClipboardFormatW("CanUploadToCloudClipboard")
    except Exception as e:
        logger.warning(f"Error registrando formatos de privacidad de portapapeles: {e}")
        FMT_NO_HISTORY = 0
        FMT_EXCLUDE_MONITOR = 0
        FMT_NO_CLOUD = 0


class Win32Injector:
    """
    Controlador nativo de inyección en cursor mediante emulación de teclado SendInput
    con respaldo transparente del portapapeles y restauración asíncrona.
    """

    def __init__(self, restore_delay_ms: int = 300):
        self.restore_delay_ms = restore_delay_ms
        self._lock = threading.Lock()
        self._restore_timer: Optional[threading.Timer] = None
        self._original_backup: Optional[Dict[int, bytes]] = None

    def get_foreground_window_info(self) -> Dict[str, Any]:
        """
        Obtiene información de la ventana que tiene el cursor activo:
        HWND, título de ventana, PID, nombre de ejecutable y estado de elevación.
        """
        if not IS_WINDOWS:
            return {
                "hwnd": 0,
                "title": "Non-Windows OS",
                "process_id": 0,
                "exe_name": "app",
                "is_elevated": False,
            }

        try:
            hwnd = user32.GetForegroundWindow()
            if not hwnd:
                return {
                    "hwnd": 0,
                    "title": "Sin ventana activa",
                    "process_id": 0,
                    "exe_name": "unknown.exe",
                    "is_elevated": False,
                }

            title_buf = ctypes.create_unicode_buffer(512)
            user32.GetWindowTextW(hwnd, title_buf, 512)
            title = title_buf.value.strip() or "Sin título"

            pid = wintypes.DWORD()
            user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))

            exe_name = "unknown.exe"
            is_elevated = False

            # Intentar abrir el proceso para consultar la ruta y el token
            # PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
            h_proc = kernel32.OpenProcess(0x1000, False, pid.value)
            if h_proc:
                try:
                    img_buf = ctypes.create_unicode_buffer(1024)
                    size = wintypes.DWORD(1024)
                    if kernel32.QueryFullProcessImageNameW(h_proc, 0, img_buf, ctypes.byref(size)):
                        exe_name = os.path.basename(img_buf.value)

                    # Comprobar elevación mediante TokenElevation (TokenInformationClass = 20)
                    h_token = wintypes.HANDLE()
                    # TOKEN_QUERY = 0x0008
                    if advapi32.OpenProcessToken(h_proc, 0x0008, ctypes.byref(h_token)):
                        try:
                            class TOKEN_ELEVATION(ctypes.Structure):
                                _fields_ = [("TokenIsElevated", wintypes.DWORD)]

                            elev = TOKEN_ELEVATION()
                            ret_len = wintypes.DWORD()
                            if advapi32.GetTokenInformation(
                                h_token,
                                20,
                                ctypes.byref(elev),
                                ctypes.sizeof(elev),
                                ctypes.byref(ret_len),
                            ):
                                is_elevated = bool(elev.TokenIsElevated)
                        finally:
                            kernel32.CloseHandle(h_token)
                finally:
                    kernel32.CloseHandle(h_proc)
            else:
                # Si OpenProcess falló con Access Denied (5), el proceso es elevado o protegido
                last_err = ctypes.GetLastError()
                if last_err == 5:
                    is_elevated = True

            return {
                "hwnd": int(hwnd) if hwnd else 0,
                "title": title,
                "process_id": int(pid.value),
                "exe_name": exe_name,
                "is_elevated": is_elevated,
            }
        except Exception as e:
            logger.error(f"Error inspeccionando ventana activa: {e}")
            return {
                "hwnd": 0,
                "title": "Error",
                "process_id": 0,
                "exe_name": "error.exe",
                "is_elevated": False,
                "error": str(e),
            }

    def _open_clipboard_with_retry(self, max_retries: int = 6, delay: float = 0.015) -> bool:
        """Intenta abrir el portapapeles con reintentos para mitigar locks temporales de otras apps."""
        for _ in range(max_retries):
            if user32.OpenClipboard(None):
                return True
            time.sleep(delay)
        return False

    def backup_clipboard(self) -> Dict[int, bytes]:
        """
        Guarda en memoria una copia de los formatos actuales del portapapeles,
        omitiendo handles GDI (bitmaps/paletas) que causan excepciones con GlobalLock.
        """
        if not IS_WINDOWS:
            return {}

        backup: Dict[int, bytes] = {}
        if not self._open_clipboard_with_retry():
            logger.warning("No se pudo abrir el portapapeles para respaldar datos.")
            return backup

        try:
            fmt = user32.EnumClipboardFormats(0)
            while fmt != 0:
                if fmt not in GDI_FORMATS:
                    h_data = user32.GetClipboardData(fmt)
                    if h_data:
                        size = kernel32.GlobalSize(h_data)
                        if size > 0:
                            ptr = kernel32.GlobalLock(h_data)
                            if ptr:
                                try:
                                    backup[fmt] = ctypes.string_at(ptr, size)
                                finally:
                                    kernel32.GlobalUnlock(h_data)
                fmt = user32.EnumClipboardFormats(fmt)
        except Exception as e:
            logger.error(f"Excepción respaldando el portapapeles: {e}")
        finally:
            user32.CloseClipboard()

        return backup

    def _set_clipboard_dword(self, format_id: int, value: int):
        """Asigna un valor DWORD (4 bytes) a un formato registrado del portapapeles."""
        if not format_id:
            return
        h_mem = kernel32.GlobalAlloc(GMEM_MOVEABLE, 4)
        if h_mem:
            ptr = kernel32.GlobalLock(h_mem)
            if ptr:
                ctypes.cast(ptr, ctypes.POINTER(ctypes.c_uint32))[0] = value
                kernel32.GlobalUnlock(h_mem)
                if not user32.SetClipboardData(format_id, h_mem):
                    kernel32.GlobalFree(h_mem)
            else:
                kernel32.GlobalFree(h_mem)

    def write_dictation_to_clipboard(self, text: str) -> bool:
        """
        Escribe el texto dictado en el portapapeles en formato CF_UNICODETEXT,
        activando las banderas de privacidad para excluirlo del historial público de Win+V y la nube.
        """
        if not IS_WINDOWS:
            return False

        if not self._open_clipboard_with_retry():
            logger.error("No se pudo abrir el portapapeles para escribir dictado.")
            return False

        success = False
        try:
            user32.EmptyClipboard()

            # Banderas de privacidad nativas de Windows 10/11
            if FMT_NO_HISTORY:
                self._set_clipboard_dword(FMT_NO_HISTORY, 0)
            if FMT_EXCLUDE_MONITOR:
                self._set_clipboard_dword(FMT_EXCLUDE_MONITOR, 1)
            if FMT_NO_CLOUD:
                self._set_clipboard_dword(FMT_NO_CLOUD, 0)

            # Texto Unicode UTF-16LE null-terminado
            encoded_text = (text + "\0").encode("utf-16le")
            size = len(encoded_text)
            h_mem = kernel32.GlobalAlloc(GMEM_MOVEABLE, size)
            if h_mem:
                ptr = kernel32.GlobalLock(h_mem)
                if ptr:
                    ctypes.memmove(ptr, encoded_text, size)
                    kernel32.GlobalUnlock(h_mem)
                    if user32.SetClipboardData(CF_UNICODETEXT, h_mem):
                        success = True
                    else:
                        kernel32.GlobalFree(h_mem)
                else:
                    kernel32.GlobalFree(h_mem)
        except Exception as e:
            logger.error(f"Error escribiendo dictado al portapapeles: {e}")
        finally:
            user32.CloseClipboard()

        return success

    def restore_clipboard(self, backup: Dict[int, bytes]):
        """Restaura los formatos originales guardados previamente en el portapapeles."""
        if not IS_WINDOWS or not backup:
            return

        if not self._open_clipboard_with_retry(max_retries=10, delay=0.03):
            logger.warning("No se pudo abrir el portapapeles para restaurar contenido previo.")
            return

        try:
            user32.EmptyClipboard()
            for fmt, data in backup.items():
                if not data:
                    continue
                size = len(data)
                h_mem = kernel32.GlobalAlloc(GMEM_MOVEABLE, size)
                if h_mem:
                    ptr = kernel32.GlobalLock(h_mem)
                    if ptr:
                        ctypes.memmove(ptr, data, size)
                        kernel32.GlobalUnlock(h_mem)
                        if not user32.SetClipboardData(fmt, h_mem):
                            kernel32.GlobalFree(h_mem)
                    else:
                        kernel32.GlobalFree(h_mem)
        except Exception as e:
            logger.error(f"Error restaurando portapapeles original: {e}")
        finally:
            user32.CloseClipboard()

    def _do_restore(self, backup: Dict[int, bytes]):
        """Restaura el portapapeles y limpia el temporizador activo bajo lock."""
        with self._lock:
            self._restore_timer = None
            self._original_backup = None
        self.restore_clipboard(backup)

    def send_ctrl_v(self) -> bool:
        """
        Emite la combinación de teclas Ctrl + V sintéticamente mediante SendInput en <5ms.
        Si las teclas Alt o Shift están presionadas físicamente por el atajo del usuario,
        las libera primero para garantizar que no se interprete como Ctrl+Alt+V o Ctrl+Shift+V.
        Retorna True si SendInput procesó todos los eventos, False si fue bloqueado por UIPI o permisos.
        """
        if not IS_WINDOWS:
            return False

        # Comprobar si Alt (0x12) o Shift (0x10) están físicamente abajo
        alt_down = bool(user32.GetAsyncKeyState(0x12) & 0x8000)
        shift_down = bool(user32.GetAsyncKeyState(0x10) & 0x8000)

        events = []

        if alt_down:
            alt_up = INPUT()
            alt_up.type = INPUT_KEYBOARD
            alt_up.union.ki.wVk = 0x12  # VK_MENU
            alt_up.union.ki.dwFlags = KEYEVENTF_KEYUP
            events.append(alt_up)

        if shift_down:
            shift_up = INPUT()
            shift_up.type = INPUT_KEYBOARD
            shift_up.union.ki.wVk = 0x10  # VK_SHIFT
            shift_up.union.ki.dwFlags = KEYEVENTF_KEYUP
            events.append(shift_up)

        # 1. Ctrl Down
        ctrl_down = INPUT()
        ctrl_down.type = INPUT_KEYBOARD
        ctrl_down.union.ki.wVk = VK_CONTROL
        events.append(ctrl_down)

        # 2. V Down
        v_down = INPUT()
        v_down.type = INPUT_KEYBOARD
        v_down.union.ki.wVk = VK_V
        events.append(v_down)

        # 3. V Up
        v_up = INPUT()
        v_up.type = INPUT_KEYBOARD
        v_up.union.ki.wVk = VK_V
        v_up.union.ki.dwFlags = KEYEVENTF_KEYUP
        events.append(v_up)

        # 4. Ctrl Up
        ctrl_up = INPUT()
        ctrl_up.type = INPUT_KEYBOARD
        ctrl_up.union.ki.wVk = VK_CONTROL
        ctrl_up.union.ki.dwFlags = KEYEVENTF_KEYUP
        events.append(ctrl_up)

        num_events = len(events)
        inputs = (INPUT * num_events)(*events)
        res = user32.SendInput(num_events, inputs, ctypes.sizeof(INPUT))
        if res == num_events:
            return True

        last_err = ctypes.GetLastError()
        logger.warning(f"SendInput retornó {res}/{num_events} eventos (GetLastError={last_err})")
        return False

    def inject_text(self, text: str) -> Dict[str, Any]:
        """
        Punto de entrada de inyección directa:
        1. Captura la ventana destino y su elevación.
        2. Si la ventana activa es nuestra propia app, no inyecta pulsaciones sintéticas
           para evitar corromper la UI y conserva el texto en el portapapeles.
        3. Respalda el portapapeles del usuario (conservando el respaldo original ante ráfagas).
        4. Escribe el nuevo texto con banderas de privacidad.
        5. Envía Ctrl + V.
        6. Si SendInput tuvo éxito, programa la restauración asíncrona a los 300ms.
           Si SendInput falló (por UIPI/Admin), conserva el texto en el portapapeles
           para que el usuario pueda presionar Ctrl + V manualmente sin perder nada.
        """
        start_time = time.perf_counter()

        if not text or not text.strip():
            return {
                "success": False,
                "injected": False,
                "reason": "empty_text",
                "latency_ms": 0.0,
            }

        with self._lock:
            target_window = self.get_foreground_window_info()

            # Detección de ventana propia (Meeting Analyzer / Electron / Backend)
            target_pid = target_window.get("process_id", 0)
            target_exe = target_window.get("exe_name", "").lower()
            is_own_app = (
                (target_pid > 0 and target_pid == os.getpid()) or
                target_exe in ("electron.exe", "local meeting analyzer.exe")
            )

            # Gestión de respaldo concurrente: si hay un temporizador activo, no sobrescribir
            # el portapapeles original del usuario con el dictado intermedio
            if self._restore_timer and self._restore_timer.is_alive():
                self._restore_timer.cancel()
                self._restore_timer = None
                backup = self._original_backup if self._original_backup is not None else self.backup_clipboard()
            else:
                backup = self.backup_clipboard()
                self._original_backup = backup

            written = self.write_dictation_to_clipboard(text)
            if not written:
                self._original_backup = None
                return {
                    "success": False,
                    "injected": False,
                    "reason": "clipboard_write_failed",
                    "target_window": target_window,
                    "latency_ms": (time.perf_counter() - start_time) * 1000,
                }

            # Si la ventana activa es nuestra propia app, no emitimos Ctrl+V ni auto-restauramos:
            # el usuario usará el texto en la ventana que elija
            if is_own_app:
                elapsed_ms = (time.perf_counter() - start_time) * 1000
                self._original_backup = None
                return {
                    "success": True,
                    "injected": False,
                    "reason": "own_app_foreground",
                    "target_window": target_window,
                    "latency_ms": elapsed_ms,
                    "clipboard_ready": True,
                    "message": "Texto copiado al portapapeles. Ve a tu aplicación y presiona Ctrl+V.",
                }

            # Si la ventana es elevada/admin, evitamos enviar SendInput que UIPI bloqueará
            if target_window.get("is_elevated"):
                elapsed_ms = (time.perf_counter() - start_time) * 1000
                self._original_backup = None
                return {
                    "success": True,
                    "injected": False,
                    "reason": "admin_window_uipi_block",
                    "target_window": target_window,
                    "latency_ms": elapsed_ms,
                    "clipboard_ready": True,
                    "message": "Texto copiado al portapapeles. Presiona Ctrl+V para pegar en ventana de Administrador.",
                }

            # Enviar pulsación sintética de Ctrl + V
            injected = self.send_ctrl_v()
            elapsed_ms = (time.perf_counter() - start_time) * 1000

            if injected:
                # Éxito: programar restauración asíncrona tras el retardo configurado (300ms)
                delay_sec = self.restore_delay_ms / 1000.0
                self._restore_timer = threading.Timer(delay_sec, self._do_restore, args=(backup,))
                self._restore_timer.daemon = True
                self._restore_timer.start()

                return {
                    "success": True,
                    "injected": True,
                    "reason": "injected_successfully",
                    "target_window": target_window,
                    "latency_ms": elapsed_ms,
                    "clipboard_restored_async": True,
                }
            else:
                self._original_backup = None
                logger.info(
                    "Inyección automática no procesada (sendinput_blocked). "
                    "El texto permanece en el portapapeles para uso manual."
                )
                return {
                    "success": True,
                    "injected": False,
                    "reason": "sendinput_blocked",
                    "target_window": target_window,
                    "latency_ms": elapsed_ms,
                    "clipboard_ready": True,
                    "message": "Texto copiado al portapapeles. Presiona Ctrl+V para pegar.",
                }


# Instancia singleton predeterminada
win32_injector = Win32Injector()
