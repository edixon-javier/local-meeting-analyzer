"""
backend/tests/test_win32_injector.py
Pruebas unitarias para el inyector Win32 de 64 bits y gestión del portapapeles.
"""

import sys
import os
import ctypes
import pytest

from services.win32_injector import Win32Injector, win32_injector, IS_WINDOWS

if IS_WINDOWS:
    from services.win32_injector import (
        INPUT,
        KEYBDINPUT,
        MOUSEINPUT,
        HARDWAREINPUT,
        GDI_FORMATS,
        FMT_NO_HISTORY,
        FMT_EXCLUDE_MONITOR,
        FMT_NO_CLOUD,
        CF_UNICODETEXT,
        kernel32,
        user32,
    )


def test_win32_injector_64bit_structures():
    """Valida que en Windows x64 las estructuras ctypes tengan el tamaño binario exacto (40 bytes para INPUT)."""
    if not IS_WINDOWS:
        pytest.skip("Prueba exclusiva de Windows")

    assert ctypes.sizeof(INPUT) == 40
    # GlobalSize y GlobalAlloc deben aceptar y devolver c_size_t
    assert kernel32.GlobalSize.restype == ctypes.c_size_t
    assert kernel32.GlobalAlloc.restype == ctypes.c_void_p


def test_gdi_formats_excluded():
    """Verifica que los handles GDI estén en la lista de exclusión para no corromper memoria."""
    if not IS_WINDOWS:
        pytest.skip("Prueba exclusiva de Windows")

    # CF_BITMAP (2), CF_METAFILEPICT (3), CF_PALETTE (9), CF_ENHMETAFILE (14)
    assert 2 in GDI_FORMATS
    assert 3 in GDI_FORMATS
    assert 9 in GDI_FORMATS
    assert 14 in GDI_FORMATS


def test_clipboard_privacy_formats_registered():
    """Verifica que los formatos de privacidad de Windows 10/11 se hayan registrado correctamente."""
    if not IS_WINDOWS:
        pytest.skip("Prueba exclusiva de Windows")

    # Los formatos registrados devuelven un entero mayor a 0xC000 (49152)
    assert FMT_NO_HISTORY > 0
    assert FMT_EXCLUDE_MONITOR > 0
    assert FMT_NO_CLOUD > 0


def test_foreground_window_info_structure():
    """Valida que get_foreground_window_info devuelva un diccionario completo con las claves esperadas."""
    info = win32_injector.get_foreground_window_info()
    assert isinstance(info, dict)
    assert "hwnd" in info
    assert "title" in info
    assert "process_id" in info
    assert "exe_name" in info
    assert "is_elevated" in info


def test_clipboard_write_and_backup_cycle():
    """Prueba el ciclo de escritura Unicode con banderas de privacidad y respaldo de portapapeles."""
    if not IS_WINDOWS:
        pytest.skip("Prueba exclusiva de Windows")

    injector = Win32Injector(restore_delay_ms=50)

    # 1. Escribir texto original
    orig_text = "Texto previo del usuario para test de portapapeles"
    success_orig = injector.write_dictation_to_clipboard(orig_text)
    assert success_orig is True

    # 2. Respaldar
    backup = injector.backup_clipboard()
    assert isinstance(backup, dict)
    assert CF_UNICODETEXT in backup

    # 3. Sobrescribir con nuevo dictado
    new_text = "Nuevo dictado transcrito por Groq"
    success_new = injector.write_dictation_to_clipboard(new_text)
    assert success_new is True

    # 4. Restaurar original
    injector.restore_clipboard(backup)

    # 5. Comprobar que volvió al texto original
    if user32.OpenClipboard(None):
        try:
            h_data = user32.GetClipboardData(CF_UNICODETEXT)
            if h_data:
                ptr = kernel32.GlobalLock(h_data)
                try:
                    restored = ctypes.wstring_at(ptr)
                    assert restored == orig_text
                finally:
                    kernel32.GlobalUnlock(h_data)
        finally:
            user32.CloseClipboard()


def test_inject_empty_text():
    """Valida que inyectar texto vacío no realice operaciones y devuelva error limpio."""
    injector = Win32Injector()
    res = injector.inject_text("")
    assert res["success"] is False
    assert res["reason"] == "empty_text"


def test_inject_text_uipi_or_success_fallback():
    """
    Valida que inject_text ejecute el flujo sin excepciones.
    Si SendInput tiene éxito o si es bloqueado por UIPI (entorno headless/consola),
    la función debe responder limpiamente con target_window y latency_ms sin crashear.
    """
    injector = Win32Injector(restore_delay_ms=100)
    test_phrase = "Probando inyección de dictado con Win32"

    res = injector.inject_text(test_phrase)
    assert isinstance(res, dict)
    assert "latency_ms" in res
    assert "target_window" in res
    assert res["latency_ms"] >= 0.0

    if res.get("injected"):
        assert res["reason"] == "injected_successfully"
    else:
        # En consola headless o ventana no interactiva, el fallback al portapapeles debe estar activo
        assert res.get("clipboard_ready") is True


def test_inject_text_own_app_foreground():
    """Valida que si la ventana activa es la propia app (Electron), no emita Ctrl+V y mantenga texto en portapapeles."""
    injector = Win32Injector(restore_delay_ms=100)
    mock_window = {
        "hwnd": 1234,
        "title": "Local Meeting Analyzer",
        "process_id": 9999,
        "exe_name": "electron.exe",
        "is_elevated": False,
    }

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(injector, "get_foreground_window_info", lambda: mock_window)
        mp.setattr(injector, "write_dictation_to_clipboard", lambda text: True)
        res = injector.inject_text("Texto para otra app")
        assert res["success"] is True
        assert res["injected"] is False
        assert res["reason"] == "own_app_foreground"
        assert res["clipboard_ready"] is True


def test_restore_timer_cancel_on_burst():
    """Verifica que llamadas sucesivas rápidas cancelen el temporizador previo y preserven el portapapeles original."""
    injector = Win32Injector(restore_delay_ms=500)
    mock_window = {
        "hwnd": 5678,
        "title": "Notepad",
        "process_id": 8888,
        "exe_name": "notepad.exe",
        "is_elevated": False,
    }

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(injector, "get_foreground_window_info", lambda: mock_window)
        mp.setattr(injector, "write_dictation_to_clipboard", lambda text: True)
        mp.setattr(injector, "send_ctrl_v", lambda: True)
        mp.setattr(injector, "backup_clipboard", lambda: {13: b"OriginalData"})

        # Primera inyección
        res1 = injector.inject_text("Primera inyección")
        assert res1["injected"] is True
        assert injector._restore_timer is not None
        first_timer = injector._restore_timer
        assert injector._original_backup == {13: b"OriginalData"}

        # Segunda inyección antes de que expire el temporizador
        res2 = injector.inject_text("Segunda inyección")
        assert res2["injected"] is True
        assert injector._restore_timer != first_timer
        # El respaldo original sigue siendo el primero, no el texto intermedio
        assert injector._original_backup == {13: b"OriginalData"}

        # Limpiar temporizador activo
        if injector._restore_timer:
            injector._restore_timer.cancel()
