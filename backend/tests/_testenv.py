"""
tests/_testenv.py
Aísla las pruebas de los datos reales del desarrollador (backend/config.json,
backend/recordings/). Fija MEETING_ANALYZER_DATA_DIR a una carpeta temporal
que se elimina al terminar.

Debe importarse ANTES que cualquier módulo del backend: core.config crea
config.json en la carpeta de datos al importarse.
"""

import atexit
import os
import shutil
import tempfile

TEST_DATA_DIR = tempfile.mkdtemp(prefix="meeting-analyzer-tests-")
os.environ["MEETING_ANALYZER_DATA_DIR"] = TEST_DATA_DIR
atexit.register(shutil.rmtree, TEST_DATA_DIR, ignore_errors=True)
