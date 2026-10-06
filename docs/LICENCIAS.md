# Revisión de licencias (para el propietario)

> Revisión técnica de buena fe, hecha el 2026-10-06 sobre el repositorio, el entorno virtual del backend (`backend/venv`) y `frontend/node_modules`. **No es asesoría legal**; antes de un lanzamiento comercial conviene que la revise un abogado. Los avisos de atribución que deben acompañar al producto están en [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).

## Resumen

- **Bloqueante 1: `bin/ffmpeg.exe` es GPLv3** (compilación "full" de gyan.dev). Hay que cambiarlo por una compilación LGPL.
- **Resuelto por la licencia del proyecto: la rueda de PyAV (`av`) trae `libx264` y `libx265`** (GPL-2.0-or-later). Como el proyecto se publica bajo **AGPL-3.0-or-later** (decisión del 2026-10-06), distribuirlas es compatible; solo hay que cumplir los avisos y la disponibilidad del código fuente (sección 2).
- Todo lo demás es permisivo (MIT, BSD, Apache, ISC, PSF) o copyleft débil que no afecta al producto (LGPL por enlace dinámico, MPL-2.0 sin modificar).
- El árbol de npm no contiene ninguna dependencia GPL, LGPL ni AGPL.
- Recomendación de LLM local por defecto: **`qwen3:4b`** (Apache-2.0). Ver más abajo.

## Tabla de componentes

Riesgo: **Bajo** = sin acción más allá del aviso de atribución; **Medio** = requiere una acción concreta; **Alto** = bloquea la distribución hasta resolverlo.

| Componente | Licencia | ¿Uso comercial? | Obligaciones de atribución | Riesgo |
|---|---|---|---|---|
| Electron 42 / Chromium / Node.js | MIT, BSD-3-Clause y otras | Sí | Conservar `LICENSE.electron.txt` y `LICENSES.chromium.html` (electron-builder los incluye) | Bajo |
| React, react-dom, axios y 27 dependencias transitivas de npm | MIT | Sí | Aviso de copyright (THIRD_PARTY_NOTICES) | Bajo |
| electron-updater y sus dependencias | MIT, ISC, Python-2.0, BlueOak-1.0.0 | Sí | Aviso de copyright | Bajo |
| **FFmpeg actual (`bin/ffmpeg.exe`, gyan.dev "full")** | **GPL-3.0** (`--enable-gpl --enable-version3`, con x264, x265 y decenas de bibliotecas) | Sí, pero con obligaciones de GPLv3 | Texto de GPLv3 y oferta de código fuente completo del binario | **Alto** (evitable) |
| FFmpeg LGPL (BtbN `win64-lgpl`, objetivo) | LGPL-2.1-or-later | Sí | Texto de la licencia, enlace al código fuente y a la configuración de compilación, binario reemplazable | Bajo |
| **PyAV `av` 17.1.0 (rueda con FFmpeg propio)** | BSD-3-Clause (PyAV) + bibliotecas nativas mezcladas, incluidas **GPL-2.0+ (`libx264`, `libx265`)** | Depende de lo que se distribuya | Si se distribuyen las DLL GPL: obligaciones de GPL | **Alto** (verificar y resolver) |
| faster-whisper, ctranslate2, onnxruntime | MIT | Sí | Aviso de copyright | Bajo |
| Silero VAD v6 (incluido en faster-whisper) | MIT | Sí | Aviso de copyright (Silero Team) | Bajo |
| numpy (con OpenBLAS), fastapi, starlette, uvicorn, pydantic, httpx, requests, openai, SoundCard y resto del cierre de `requirements.txt` | MIT, BSD, Apache-2.0, ISC, PSF-2.0 | Sí | Aviso de copyright (Apache-2.0: conservar NOTICE si existe) | Bajo |
| soundfile + libsndfile 1.2.2 | BSD-3-Clause (Python) + LGPL-2.1+ (DLL) | Sí | Si se distribuye: texto LGPL y que la DLL sea reemplazable | Bajo (y evitable: no se usa) |
| libmp3lame (dentro de PyAV y de FFmpeg) | LGPL-2.0+ | Sí (patentes de MP3 caducadas) | Aviso y enlace dinámico / binario separado | Bajo |
| certifi, tqdm | MPL-2.0 (tqdm: MPL-2.0 AND MIT) | Sí | Mantenerlos sin modificar y enlazar su código fuente | Bajo |
| `cudnn64_9.dll` (0,3 MB, dentro de ctranslate2) | NVIDIA cuDNN (propietaria, redistribuible) | Sí, con condiciones de NVIDIA | Incluir la licencia de NVIDIA si se distribuye | Medio (se puede excluir: la app solo usa CPU) |
| `libiomp5md.dll` (OpenMP de Intel, dentro de ctranslate2) | Licencia de Intel/LLVM OpenMP | Sí | Aviso | Bajo |
| Python 3.14 | PSF-2.0 | Sí | Aviso | Bajo |
| PyInstaller (bootloader en el `.exe` del backend) | GPL-2.0+ **con excepción** para distribuir programas no libres | Sí | Ninguna sobre el código propio | Bajo |
| Modelos Whisper / faster-whisper (Systran) | MIT | Sí | Aviso de copyright (OpenAI, SYSTRAN). Se descargan al usarlos, no van en el instalador | Bajo |
| Fuentes Inter, Outfit, JetBrains Mono | SIL OFL 1.1 | Sí | Conservar copyright y `OFL.txt`; no vender las fuentes por separado | Bajo |
| Ollama (no incluido) | MIT | Sí | Ninguna (no se redistribuye) | Bajo |
| OpenAI API (opcional, clave del usuario) | Términos de servicio de OpenAI | Según términos del usuario con OpenAI | Informar en la política de privacidad de que el texto/audio sale al proveedor | Bajo |
| Logo e iconos (`icon.ico`, `icon.png`, `src/assets/icon.jpg`) | **Origen no documentado en el repositorio** | Por confirmar | Si no es obra propia, necesitas la licencia del autor | Medio (confirmar) |

## Problemas detectados

### 1. FFmpeg GPLv3 y la solución LGPL

`bin/ffmpeg.exe` pesa 227 MB y se identifica como `full_build-www.gyan.dev` con `--enable-gpl --enable-version3`. Eso lo hace **GPLv3** (incluye libx264 y libx265, entre otras).

- Como la app lo ejecuta como proceso independiente (no lo enlaza), la GPL **no se extiende al código propio**. Aun así, al distribuirlo hay que entregar el texto de GPLv3 y ofrecer el código fuente completo de ese binario, y arrastra componentes con patentes (H.264/HEVC) que la app no usa.
- La app solo necesita decodificar audio, convertir y trocear a WAV/MP3 (ver `backend/services/transcription_service.py` y `audio_service.py`). Una compilación LGPL lo cubre: incluye LAME para MP3.
- **Solución:** sustituir por la compilación **BtbN `win64-lgpl`** (https://github.com/BtbN/FFmpeg-Builds), variante estática (no `-shared`). Pasos:
  1. Descargar el zip `win64-lgpl` de una versión estable y copiar `bin/ffmpeg.exe` (solo ese ejecutable; no hacen falta `ffplay` ni `ffprobe`).
  2. Comprobar con `ffmpeg -version` que **no** aparecen `--enable-gpl` ni `--enable-nonfree`.
  3. Guardar `LICENSE.txt` de la compilación junto al binario y anotar versión y etiqueta exactas en `THIRD_PARTY_NOTICES.md` (sección 5).
  4. Probar: grabar, importar `.m4a`, `.mp4`, `.ogg`, `.aac`, `.flac` y transcribir un archivo largo (usa troceado a MP3).
- Obligaciones LGPL a cumplir: texto de la licencia, enlace al código fuente exacto y a la configuración de compilación, y que el usuario pueda reemplazar el `.exe`. Todo ello queda cubierto por THIRD_PARTY_NOTICES.md y por mantener `ffmpeg.exe` como archivo separado.

### 2. PyAV trae `libx264` y `libx265` (resuelto con AGPL-3.0)

> **Decisión (2026-10-06):** el código del proyecto se publica bajo **AGPL-3.0-or-later**. La GPL-2.0-or-later de x264/x265 es compatible con la GPLv3, y la sección 13 de la GPLv3/AGPLv3 permite combinarlas, así que el instalador puede incluir la rueda de PyAV tal cual. Obligaciones: mantener `LICENSE` y `THIRD_PARTY_NOTICES.md` en el instalador (ya se empaquetan) y ofrecer el código fuente correspondiente: el del proyecto en el repositorio público y el de PyAV/FFmpeg/x264/x265 mediante enlace a sus versiones exactas. Las opciones 1 y 2 de abajo solo vuelven a importar si algún día se quisiera una edición cerrada.

`backend/venv/Lib/site-packages/av.libs/` contiene `libx264-165-*.dll` (2,2 MB) y `libx265-*.dll` (12 MB), además de `libmp3lame`, `libopencore-amr*`, `libdav1d`, `libvpx`, `libopus`, `libwebp` y otras. `libx264` y `libx265` son bibliotecas **GPL-2.0-or-later** (o de pago). Hay evidencia contradictoria: la cadena de licencia interna de `avutil` dice "LGPL version 3 or later" y no aparece `--enable-gpl`, pero los DLL GPL están físicamente en la rueda. Hasta aclararlo, trátalo como un riesgo GPL real: si esas DLL entran en el instalador, estás distribuyendo código GPL dentro del producto.

La app usa `av` a través de `faster-whisper` para decodificar el audio de entrada (`faster_whisper/audio.py` hace `import av`). Opciones, de más a menos recomendable:

1. **Rueda de PyAV sin GPL:** compilar PyAV contra el FFmpeg LGPL (variante `-shared` de BtbN) o usar una rueda construida sin x264/x265 (existen forks que publican ruedas LGPL; comprueba la que elijas con el mismo análisis de `av.libs`).
2. **Decodificar con el `ffmpeg.exe` LGPL propio** (subproceso a PCM 16 kHz mono) y pasar a faster-whisper un `numpy.ndarray`, de modo que `av` no se use para decodificar; aun así `faster_whisper` importa `av` al cargarse, por lo que haría falta un módulo `av` mínimo en el build. Es frágil; hay que probarlo bien.
3. **Distribuir bajo GPL** (publicar el código bajo GPL-compatible). No recomendado si quieres un "Pro" cerrado.

Con la licencia AGPL-3.0 elegida, este punto deja de bloquear la publicación.

### 3. soundfile y libsndfile (LGPL)

`soundfile` figura en `backend/requirements.txt` pero **ningún módulo del proyecto lo importa**. Su rueda trae `libsndfile 1.2.2` (LGPL-2.1+). Con enlace dinámico y DLL reemplazable el uso es legítimo, pero sin necesidad de ella es mejor **quitar `soundfile` de los requisitos** y evitar la obligación. Si se mantiene: incluir el texto LGPL y no empaquetar la DLL de forma que impida reemplazarla.

### 4. Otros copyleft y componentes a vigilar

- **npm:** ninguna dependencia GPL/LGPL/AGPL. `lightningcss` es MPL-2.0 pero solo se usa para compilar.
- **Python:** `certifi` y `tqdm` son MPL-2.0 (copyleft de archivo; sin modificarlos no hay obligación más allá de poder obtener su código). `pyinstaller` es GPL con excepción de distribución (ver tabla).
- **Instalados pero no usados:** `torch`, `openai-whisper`, `numba`, `llvmlite`, `tiktoken` y `pydub` están en el entorno virtual, pero ningún módulo del proyecto los importa ni son dependencias de `requirements.txt` (todos son MIT o BSD). Mantenerlos fuera del instalador reduce tamaño y superficie de licencias. `python-dotenv` tampoco se importa, pero llega como dependencia de `uvicorn[standard]` (BSD-3-Clause).
- **Binarios innecesarios:** `cudnn64_9.dll` y, si no se usa, `libsndfile_x64.dll`.

### 5. Herramientas solo de compilación (no se distribuyen, sin problema)

`lightningcss` (MPL-2.0), utilidades con licencia WTFPL (`truncate-utf8-bytes`, `utf8-byte-length`, `sanitize-filename`), paquetes BlueOak-1.0.0 (`tar`, `minimatch`, `minipass`, `chownr`, `yallist`, `isexe`), `type-fest` (MIT OR CC0), `pytest`, Vite, Rolldown y electron-builder. Ninguna entra en el instalador.

### 6. Tipografías cargadas desde Google Fonts

`frontend/src/index.css` importa Inter, Outfit y JetBrains Mono desde `fonts.googleapis.com`. Licencia (OFL) no es problema, pero cada arranque envía la IP del usuario a Google y contradice el mensaje "100 % local". Está previsto empaquetarlas; incluir entonces los `OFL.txt`.

## Licencias de los modelos de lenguaje (LLM)

La aplicación **no distribuye LLM**: el usuario los descarga con Ollama. Las licencias obligan a quien redistribuye el modelo, no a una app que solo lo invoca; el riesgo sube si la app **descarga o recomienda** un modelo concreto como parte del producto, por eso conviene que el modelo por defecto sea permisivo.

| Modelo (etiqueta de Ollama) | Licencia | ¿Uso comercial? | Condiciones | Español y RAM |
|---|---|---|---|---|
| `phi3` (mini 3,8B), phi3.5, `phi4-mini` | MIT | Sí | Ninguna relevante | phi3: español flojo. phi4-mini mejora el soporte multilingüe; unos 2,5 GB |
| `qwen3` (0,6B a 32B) | Apache-2.0 (comprobado en Qwen3-4B) | Sí | Aviso de licencia | 100+ idiomas; `qwen3:4b` ocupa 2,5 GB |
| `qwen2.5` 0,5B / 1,5B / 7B / 14B / 32B | Apache-2.0 | Sí | Aviso de licencia | `qwen2.5` (7B) buen español; ~4,7 GB, ajustado en 8 GB |
| `qwen2.5:3b` | **Qwen Research License** (solo investigación, no comercial) | **No** | Evitarlo | Evitar |
| `qwen2.5:72b` | Qwen License | Sí, pero hace falta licencia de Alibaba con más de 100 M de usuarios mensuales | Condiciones propias | No cabe en equipos normales |
| `llama3`, `llama3.1`, `llama3.2`, `llama3.3` | Llama Community License | Sí, con condiciones | Mostrar "Built with Llama" de forma visible; prefijo "Llama" en modelos derivados; cumplir la política de uso aceptable de Meta; con más de 700 M de usuarios mensuales hay que pedir licencia a Meta | Español oficial desde 3.1 (3.2 3B incluido) |
| `gemma`, `gemma2`, `gemma3` | Términos de Uso de Gemma + Política de Uso Prohibido | Sí, con condiciones | Trasladar las restricciones de uso a terceros; Google puede exigir cesar el uso si se incumple | `gemma` es la primera generación |
| `gemma4` (abril de 2026) | Apache-2.0 | Sí | Aviso de licencia | `gemma4:e2b` ~4,6 GB y `e4b` ~6,6 GB: pesados para 8 GB |
| `mistral` (7B v0.3) | Apache-2.0 | Sí | Aviso de licencia | Español aceptable; ~4 GB, justo en 8 GB |

Estado en 1.6.0: el modelo por defecto es `qwen3:4b` y la lista de respaldo de la interfaz es `qwen3:4b`, `qwen3:1.7b`, `phi3`, `mistral`, `llama3.2` (`frontend/src/components/SettingsScreen.jsx` y `backend/api/routers/system.py`). `llama3.2` usa la Llama Community License, que pide atribución "Built with Llama".

### Recomendación de modelo por defecto

**`qwen3:4b`**: Apache-2.0 (sin condiciones de marca ni de uso), 2,5 GB en disco, más de 100 idiomas con buen español, y deja margen en 8 GB junto a Windows, Electron y Whisper `small` en int8.

- Qwen3 tiene un modo de razonamiento ("thinking") que añade texto previo a la respuesta. Para el análisis estructurado y el chat conviene **desactivarlo** (parámetro `think: false` en la API de Ollama, o `/no_think`).
- Valídalo con 3 a 5 transcripciones reales en español. Si la calidad no basta y el equipo tiene 16 GB, sube a `qwen2.5:7b` (también Apache-2.0).
- Alternativa MIT: `phi4-mini` (2,5 GB). `phi3`, el valor actual, tiene licencia correcta pero peor español.
- Evita `qwen2.5:3b` (no comercial).

## Licencia del propio código: opciones

> **Decisión tomada (2026-10-06): AGPL-3.0-or-later.** Se añadió `LICENSE`, el campo `license` de los `package.json` y se reescribió `legal/EULA.txt` como "Licencia y términos de uso", sin restricciones que contradigan la AGPL. Implicaciones: firma gratuita posible con SignPath Foundation, monetización por la edición de la Store, soporte y servicios (no por módulos cerrados) y, si aceptas contribuciones externas, conviene un CLA si quieres poder relicenciar en el futuro.

Análisis original de las opciones:

| Opción | Monetización | Firma de código gratuita | Adopción y riesgos |
|---|---|---|---|
| **Propietaria / todos los derechos reservados** (más EULA) | La más cómoda: puedes mantener funciones "Pro" cerradas y vender licencias | **SignPath Foundation: no** (exige licencia OSI). **Microsoft Store: sí**, la Store firma sin coste los paquetes que se publican allí | Menos confianza para quien quiere auditar un producto "100 % local"; obliga a resolver los puntos GPL anteriores sin excepciones |
| **MIT** | Cualquiera puede revender o empaquetar tu código sin devolverte nada; solo quedan soporte, donaciones y servicios | **SignPath: sí**, siempre que no haya componentes propietarios ni doble licencia comercial | Máxima adopción; mínima protección frente a clones |
| **AGPL-3.0** | Disuade de bifurcaciones cerradas y de servicios en la nube que reutilicen tu código sin publicar; compatible con vender servicios, soporte y una edición de pago en la Store | **SignPath: sí**, pero la doble licencia comercial está excluida y no puede haber módulos propietarios dentro del binario firmado | Algunas empresas rechazan AGPL; si quieres relicenciar luego, exige una cesión de derechos (CLA) a los colaboradores desde el primer día |

Matiz común: como único titular del copyright puedes cambiar la licencia de **versiones futuras**; lo que ya publicaste bajo MIT o AGPL seguirá disponible bajo esa licencia. Pasar de cerrado a abierto es siempre posible; volver a cerrar lo ya abierto, no.

**Recomendación (decisión del propietario):** con casi nada de presupuesto y la idea de monetizar más adelante, la opción de menor arrepentimiento es **empezar propietaria** (coherente con el EULA ya redactado), distribuir por la **Microsoft Store** (firma gratuita) y usar GitHub Releases como descarga alternativa sin firmar, documentando el aviso de SmartScreen. Así mantienes abierta la puerta a un "Pro" cerrado y puedes abrir el código más adelante. Si prefieres priorizar la confianza de usuarios que valoran la privacidad, o necesitas **firma gratuita fuera de la Store**, **AGPL-3.0** es la alternativa coherente, aceptando que la monetización será por la edición de la Store, soporte y servicios, y no por módulos cerrados ni licencias duales. MIT solo tiene sentido si lo que quieres es máxima difusión sin proteger la monetización.

## Acciones pendientes

1. Sustituir `bin/ffmpeg.exe` por la compilación LGPL (sección 1).
2. ~~Resolver `libx264`/`libx265` en la rueda de `av`~~: resuelto al elegir AGPL-3.0 (sección 2).
3. ~~Quitar `soundfile` de `requirements.txt`~~ (hecho en 1.6.0). Opcional: excluir `cudnn64_9.dll` del congelado.
4. Confirmar el origen del logo e iconos.
5. ~~Empaquetar las fuentes localmente~~ (hecho en 1.6.0 con `@fontsource`, que incluye sus `OFL.txt`).
6. ~~Decidir la licencia del código~~: AGPL-3.0-or-later, `LICENSE` añadido.
7. ~~Revisar el modelo por defecto~~: `qwen3:4b` desde 1.6.0.
