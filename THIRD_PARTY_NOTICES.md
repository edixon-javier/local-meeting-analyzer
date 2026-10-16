# Avisos de software de terceros

**Local Meeting Analyzer** incluye o utiliza software y recursos de terceros, cada uno bajo su propia licencia. Este documento reconoce a sus autores y enumera, por componente, la licencia aplicable. Los textos completos de las licencias se encuentran en el archivo `LICENSE` de cada paquete original y en los enlaces indicados.

Este archivo describe lo que se distribuye dentro del instalador (o se descarga por el usuario al usarlo). Para una valoración legal y de riesgo, consulta [docs/LICENCIAS.md](docs/LICENCIAS.md).

> Versiones y licencias tomadas el 2026-10-06 de `frontend/package-lock.json` / `node_modules`, de los metadatos `*.dist-info/METADATA` del entorno virtual del backend y del registro npm. Regenera este documento cuando cambien las dependencias.

Contenido:

1. [Paquetes npm (interfaz y proceso principal de Electron)](#1-paquetes-npm-incluidos-en-appasar)
2. [Paquetes de Python (backend congelado)](#2-paquetes-de-python-backend)
3. [Bibliotecas nativas que traen las ruedas de Python](#3-bibliotecas-nativas-incluidas-en-las-ruedas-de-python)
4. [Electron, Chromium y Node.js](#4-electron-chromium-y-nodejs)
5. [FFmpeg](#5-ffmpeg)
6. [Modelos de voz](#6-modelos-de-voz)
7. [Tipografías](#7-tipografías)
8. [Modelos de lenguaje (LLM)](#8-modelos-de-lenguaje-llm-no-incluidos)
9. [Herramientas de compilación que no se distribuyen](#9-herramientas-de-compilación-que-no-se-distribuyen)

---

## 1. Paquetes npm incluidos en `app.asar`

Dependencias de producción de `frontend/package.json` (`axios`, `react`, `react-dom`) y su cierre transitivo (`npm ls --omit=dev --all`). Todas son licencia **MIT**.

| Paquete | Versión | Licencia | Titular del copyright | URL |
|---|---|---|---|---|
| axios | 1.18.1 | MIT | Matt Zabriskie & Collaborators | https://axios-http.com |
| react | 19.2.7 | MIT | Meta Platforms, Inc. and affiliates | https://react.dev/ |
| react-dom | 19.2.7 | MIT | Meta Platforms, Inc. and affiliates | https://react.dev/ |
| scheduler | 0.27.0 | MIT | Meta Platforms, Inc. and affiliates | https://react.dev/ |
| follow-redirects | 1.16.0 | MIT | Olivier Lalonde, James Talmage, Ruben Verborgh | https://github.com/follow-redirects/follow-redirects |
| form-data | 4.0.6 | MIT | Felix Geisendörfer y colaboradores | https://github.com/form-data/form-data |
| proxy-from-env | 2.1.0 | MIT | Rob Wu | https://github.com/Rob--W/proxy-from-env |
| https-proxy-agent | 5.0.1 | MIT | Nathan Rajlich | https://github.com/TooTallNate/node-https-proxy-agent |
| agent-base | 6.0.2 | MIT | Nathan Rajlich | https://github.com/TooTallNate/node-agent-base |
| debug | 4.4.3 | MIT | TJ Holowaychuk; Josh Junon | https://github.com/debug-js/debug |
| ms | 2.1.3 | MIT | Vercel, Inc. | https://github.com/vercel/ms |
| asynckit | 0.4.0 | MIT | Alex Indigo | https://github.com/alexindigo/asynckit |
| combined-stream | 1.0.8 | MIT | Debuggable Limited | https://github.com/felixge/node-combined-stream |
| delayed-stream | 1.0.0 | MIT | Debuggable Limited | https://github.com/felixge/node-delayed-stream |
| mime-types | 2.1.35 | MIT | Jonathan Ong; Douglas Christopher Wilson | https://github.com/jshttp/mime-types |
| mime-db | 1.52.0 | MIT | Jonathan Ong; Douglas Christopher Wilson | https://github.com/jshttp/mime-db |
| es-set-tostringtag | 2.1.0 | MIT | ECMAScript Shims | https://github.com/es-shims/es-set-tostringtag |
| get-intrinsic | 1.3.0 | MIT | Jordan Harband | https://github.com/ljharb/get-intrinsic |
| call-bind-apply-helpers | 1.0.2 | MIT | Jordan Harband | https://github.com/ljharb/call-bind-apply-helpers |
| dunder-proto | 1.0.1 | MIT | ECMAScript Shims | https://github.com/es-shims/dunder-proto |
| es-define-property | 1.0.1 | MIT | Jordan Harband | https://github.com/ljharb/es-define-property |
| es-errors | 1.3.0 | MIT | Jordan Harband | https://github.com/ljharb/es-errors |
| es-object-atoms | 1.1.2 | MIT | Jordan Harband | https://github.com/ljharb/es-object-atoms |
| function-bind | 1.1.2 | MIT | Raynos | https://github.com/Raynos/function-bind |
| get-proto | 1.0.1 | MIT | Jordan Harband | https://github.com/ljharb/get-proto |
| gopd | 1.2.0 | MIT | Jordan Harband | https://github.com/ljharb/gopd |
| has-symbols | 1.1.0 | MIT | Jordan Harband | https://github.com/ljharb/has-symbols |
| has-tostringtag | 1.0.2 | MIT | Inspect JS | https://github.com/inspect-js/has-tostringtag |
| hasown | 2.0.4 | MIT | Jordan Harband y colaboradores | https://github.com/inspect-js/hasOwn |
| math-intrinsics | 1.1.0 | MIT | ECMAScript Shims | https://github.com/es-shims/math-intrinsics |

### 1.1 `electron-updater` (actualización automática)

Se añade como dependencia de producción. Datos del registro npm (versión 6.8.9); confirma la versión final instalada.

| Paquete | Versión | Licencia | URL |
|---|---|---|---|
| electron-updater | 6.8.9 | MIT | https://github.com/electron-userland/electron-builder |
| builder-util-runtime | 9.7.0 | MIT | https://github.com/electron-userland/electron-builder |
| fs-extra | 10.1.0 | MIT | https://github.com/jprichardson/node-fs-extra |
| jsonfile | 6.2.1 | MIT | https://github.com/jprichardson/node-jsonfile |
| universalify | 2.0.1 | MIT | https://github.com/RyanZim/universalify |
| graceful-fs | 4.2.11 | ISC | https://github.com/isaacs/node-graceful-fs |
| js-yaml | 4.3.2 | MIT | https://github.com/nodeca/js-yaml |
| argparse | 2.0.1 | Python-2.0 | https://github.com/nodeca/argparse |
| lazy-val | 1.0.5 | MIT | https://github.com/develar/lazy-val |
| lodash.isequal | 4.5.0 | MIT | https://lodash.com/ |
| lodash.escaperegexp | 4.1.2 | MIT | https://lodash.com/ |
| semver | 7.7.4 | ISC | https://github.com/npm/node-semver |
| tiny-typed-emitter | 2.1.0 | MIT | https://github.com/binier/tiny-typed-emitter |
| sax | 1.6.1 | BlueOak-1.0.0 | https://github.com/isaacs/sax-js |

(Además reutiliza `debug` y `ms`, ya listados arriba.)

---

## 2. Paquetes de Python (backend)

Cierre transitivo de `backend/requirements.txt` (`faster-whisper`, `fastapi`, `uvicorn[standard]`, `soundcard`, `numpy`, `requests`, `python-multipart`, `httpx`, `openai`), calculado con los metadatos del entorno virtual. Versiones de Python: 3.14 (licencia PSF-2.0).

> `soundfile` se retiró de `requirements.txt` en la versión 1.6.0 porque ningún módulo lo importaba; su biblioteca nativa libsndfile ya no se distribuye.

| Paquete | Versión | Licencia | Autor / titular | URL |
|---|---|---|---|---|
| faster-whisper | 1.2.1 | MIT | Guillaume Klein (SYSTRAN) | https://github.com/SYSTRAN/faster-whisper |
| ctranslate2 | 4.8.0 | MIT | OpenNMT | https://github.com/OpenNMT/CTranslate2 |
| onnxruntime | 1.27.0 | MIT | Microsoft Corporation | https://onnxruntime.ai |
| av (PyAV) | 17.1.0 | BSD-3-Clause | WyattBlue, Jeremy Lainé | https://github.com/PyAV-Org/PyAV |
| tokenizers | 0.23.1 | Apache-2.0 | Nicolas Patry, Anthony Moi (Hugging Face) | https://github.com/huggingface/tokenizers |
| huggingface_hub | 1.21.0 | Apache-2.0 | Hugging Face, Inc. | https://github.com/huggingface/huggingface_hub |
| hf-xet | 1.5.1 | Apache-2.0 | Hugging Face, Inc. | https://github.com/huggingface/xet-core |
| fsspec | 2026.6.0 | BSD-3-Clause | Martin Durant | https://github.com/fsspec/filesystem_spec |
| filelock | 3.29.4 | MIT | Bernát Gábor | https://github.com/tox-dev/py-filelock |
| tqdm | 4.68.3 | MPL-2.0 AND MIT | tqdm developers | https://tqdm.github.io |
| PyYAML | 6.0.3 | MIT | Kirill Simonov | https://pyyaml.org/ |
| packaging | 26.2 | Apache-2.0 OR BSD-2-Clause | Donald Stufft y colaboradores | https://github.com/pypa/packaging |
| mcp (SDK de Model Context Protocol) | 2.3.0 | MIT | Anthropic, PBC | https://github.com/modelcontextprotocol/python-sdk |
| mcp-types | 2.3.0 | MIT | Anthropic, PBC | https://github.com/modelcontextprotocol/python-sdk |
| sse-starlette | 3.5.0 | BSD-3-Clause | sysid | https://github.com/sysid/sse-starlette |
| httpx2 | 2.13.1 | BSD-3-Clause | Encode OSS Ltd. | https://github.com/encode/httpx |
| httpcore2 | 2.13.1 | BSD-3-Clause | Encode OSS Ltd. | https://github.com/encode/httpcore |
| jsonschema | 4.26.0 | MIT | Julian Berman | https://github.com/python-jsonschema/jsonschema |
| jsonschema-specifications | 2025.9.1 | MIT | Julian Berman | https://github.com/python-jsonschema/jsonschema-specifications |
| referencing | 0.37.0 | MIT | Julian Berman | https://github.com/python-jsonschema/referencing |
| rpds-py | 2026.9.1 | MIT | Julian Berman | https://github.com/crate-py/rpds |
| attrs | 26.1.0 | MIT | Hynek Schlawack | https://www.attrs.org |
| PyJWT | 2.15.1 | MIT | José Padilla | https://github.com/jpadilla/pyjwt |
| truststore | 0.10.4 | MIT | Seth Michael Larson, David Glick | https://github.com/sethmlarson/truststore |
| opentelemetry-api | 1.45.1 | Apache-2.0 | OpenTelemetry Authors | https://github.com/open-telemetry/opentelemetry-python |
| pywin32 | 312 | PSF-2.0 | Mark Hammond y colaboradores | https://github.com/mhammond/pywin32 |
| flatbuffers | 25.12.19 | Apache-2.0 | Google / Derek Bailey | https://google.github.io/flatbuffers/ |
| protobuf | 7.35.1 | BSD-3-Clause | Google LLC | https://developers.google.com/protocol-buffers/ |
| numpy | 2.4.6 | BSD-3-Clause AND 0BSD AND MIT AND Zlib AND CC0-1.0 | NumPy Developers | https://numpy.org |
| fastapi | 0.138.1 | MIT | Sebastián Ramírez | https://github.com/fastapi/fastapi |
| starlette | 1.3.1 | BSD-3-Clause | Tom Christie, Marcelo Trylesinski | https://github.com/Kludex/starlette |
| uvicorn | 0.49.0 | BSD-3-Clause | Tom Christie (Encode), Marcelo Trylesinski | https://uvicorn.dev/ |
| h11 | 0.16.0 | MIT | Nathaniel J. Smith | https://github.com/python-hyper/h11 |
| httptools | 0.8.0 | MIT | Yury Selivanov | https://github.com/MagicStack/httptools |
| websockets | 16.0 | BSD-3-Clause | Aymeric Augustin | https://github.com/python-websockets/websockets |
| watchfiles | 1.2.0 | MIT | Samuel Colvin | https://github.com/samuelcolvin/watchfiles |
| python-dotenv | 1.2.2 | BSD-3-Clause | Saurabh Kumar | https://github.com/theskumar/python-dotenv |
| colorama | 0.4.6 | BSD-3-Clause | Jonathan Hartley | https://github.com/tartley/colorama |
| click | 8.4.2 | BSD-3-Clause | Pallets | https://github.com/pallets/click/ |
| python-multipart | 0.0.32 | Apache-2.0 | Andrew Dunham, Marcelo Trylesinski | https://github.com/Kludex/python-multipart |
| pydantic | 2.13.4 | MIT | Samuel Colvin y colaboradores | https://github.com/pydantic/pydantic |
| pydantic_core | 2.46.4 | MIT | Samuel Colvin y colaboradores | https://github.com/pydantic/pydantic |
| annotated-types | 0.7.0 | MIT | Adrian Garcia Badaracco, Samuel Colvin, Zac Hatfield-Dodds | https://github.com/annotated-types/annotated-types |
| annotated-doc | 0.0.4 | MIT | Sebastián Ramírez | https://github.com/fastapi/annotated-doc |
| typing-inspection | 0.4.2 | MIT | Pydantic Services Inc. | https://github.com/pydantic/typing-inspection |
| typing_extensions | 4.15.0 | PSF-2.0 | Python Software Foundation | https://github.com/python/typing_extensions |
| anyio | 4.14.1 | MIT | Alex Grönholm | https://github.com/agronholm/anyio |
| sniffio | 1.3.1 | MIT OR Apache-2.0 | Nathaniel J. Smith | https://github.com/python-trio/sniffio |
| idna | 3.18 | BSD-3-Clause | Kim Davies | https://github.com/kjd/idna |
| httpx | 0.28.1 | BSD-3-Clause | Tom Christie (Encode) | https://github.com/encode/httpx |
| httpcore | 1.0.9 | BSD-3-Clause | Tom Christie (Encode) | https://www.encode.io/httpcore/ |
| certifi | 2026.6.17 | MPL-2.0 | Kenneth Reitz | https://github.com/certifi/python-certifi |
| requests | 2.34.2 | Apache-2.0 | Kenneth Reitz y mantenedores | https://github.com/psf/requests |
| urllib3 | 2.7.0 | MIT | Andrey Petrov y colaboradores | https://github.com/urllib3/urllib3 |
| charset-normalizer | 3.4.7 | MIT | Ahmed R. TAHRI | https://github.com/jawah/charset_normalizer |
| openai | 2.44.0 | Apache-2.0 | OpenAI | https://github.com/openai/openai-python |
| jiter | 0.15.0 | MIT | Samuel Colvin | https://github.com/pydantic/jiter/ |
| distro | 1.9.0 | Apache-2.0 | Nir Cohen | https://github.com/python-distro/distro |
| SoundCard | 0.4.6 | BSD-3-Clause | Bastian Bechtold | https://github.com/bastibe/SoundCard |
| cffi | 2.0.0 | MIT | Armin Rigo, Maciej Fijałkowski | https://github.com/python-cffi/cffi |
| pycparser | 3.0 | BSD-3-Clause | Eli Bendersky | https://github.com/eliben/pycparser |
| typer | 0.25.1 | MIT | Sebastián Ramírez | https://github.com/fastapi/typer |
| rich | 15.0.0 | MIT | Will McGugan | https://github.com/Textualize/rich |
| markdown-it-py | 4.2.0 | MIT | Chris Sewell | https://github.com/executablebooks/markdown-it-py |
| mdurl | 0.1.2 | MIT | Taneli Hukkinen | https://github.com/executablebooks/mdurl |
| Pygments | 2.20.0 | BSD-2-Clause | Georg Brandl y colaboradores | https://pygments.org |
| shellingham | 1.5.4 | ISC | Tzu-ping Chung | https://github.com/sarugaku/shellingham |
| setuptools | 81.0.0 | MIT | Python Packaging Authority | https://github.com/pypa/setuptools |

Nota: `certifi` y `tqdm` incluyen archivos bajo MPL-2.0 (copyleft débil, a nivel de archivo). Se distribuyen sin modificar; el código fuente está disponible en los enlaces de la tabla.

Instalados en el entorno de desarrollo pero **no** dependencias del proyecto ni importados por él (no se incluyen en el instalador): `torch`, `openai-whisper`, `numba`, `llvmlite`, `tiktoken`, `pydub`, `sympy`, `mpmath`, `networkx`, `Jinja2`, `MarkupSafe`, `regex`, `more-itertools`.

---

## 3. Bibliotecas nativas incluidas en las ruedas de Python

Algunas ruedas de Windows empaquetan DLL de terceros. Estas son las observadas en el entorno virtual actual.

| Componente | Procede de | Licencia | Nota |
|---|---|---|---|
| OpenBLAS (`libscipy_openblas64_*.dll`) | numpy | BSD-3-Clause | |
| Microsoft Visual C++ runtime (`msvcp140*.dll`) | numpy, llvmlite | Redistribuible de Microsoft | Redistribución permitida según las condiciones del Visual C++ Redistributable. |
| `ctranslate2.dll` | ctranslate2 | MIT | Motor de inferencia de Whisper. |
| Intel OpenMP runtime (`libiomp5md.dll`) | ctranslate2 | Licencia del runtime OpenMP de Intel/LLVM | Redistribuible. |
| `cudnn64_9.dll` (0,3 MB, cargador) | ctranslate2 | Licencia NVIDIA cuDNN (propietaria, redistribuible) | La app usa solo CPU; no se necesita. Conviene excluirlo del instalador. |
| `onnxruntime.dll` | onnxruntime | MIT | |
| Silero VAD v6 (`faster_whisper/assets/silero_vad_v6.onnx`) | faster-whisper | MIT, © Silero Team | Modelo de detección de voz; https://github.com/snakers4/silero-vad |
| FFmpeg 8.x compilado como biblioteca (`av.libs/avcodec-*`, `avformat-*`, `avutil-*`, `swresample-*`, `swscale-*`, `avfilter-*`, `avdevice-*`) | av (PyAV) | LGPL-2.1+/3+ según el binario; ver nota | La cadena de licencia interna del binario indica "LGPL version 3 or later". |
| libdav1d, libvpx, libopus, libwebp, libvpl, SVT-AV1 | av (PyAV) | BSD / MIT / BSD-3-Clause-Clear | Permisivas. |
| libmp3lame (LAME) | av (PyAV) | LGPL-2.0-or-later | Enlace dinámico. |
| libopencore-amrnb/amrwb | av (PyAV) | Apache-2.0 | |
| **libx264-165** y **libx265** | av (PyAV) | **GPL-2.0-or-later** (o licencia comercial) | **Presentes físicamente en `av.libs/` de la rueda.** Compatibles con la licencia del proyecto (AGPL-3.0-or-later). Código fuente: https://code.videolan.org/videolan/x264 y https://bitbucket.org/multicoreware/x265_git, en las versiones que fija la rueda PyAV 17.1.0 (https://github.com/PyAV-Org/pyav-ffmpeg). |
| libgcc_s_seh, libstdc++, libwinpthread, libiconv, zlib | av (PyAV) | GPL-3.0-or-later con GCC Runtime Library Exception / MIT / LGPL-2.1 / zlib | Bibliotecas de tiempo de ejecución de MinGW. |

Fuentes: contenido de `backend/venv/Lib/site-packages/av.libs`, `_soundfile_data`, `ctranslate2`, `numpy.libs` y metadatos de cada rueda.

### Python y PyInstaller

- **Python 3.14**: licencia PSF-2.0 (https://docs.python.org/3/license.html). Sus componentes embebidos (OpenSSL, libffi, expat, zlib, etc.) conservan sus licencias permisivas.
- **PyInstaller** (herramienta que congela el backend): GPL-2.0-or-later **con excepción especial** que permite usarlo para distribuir programas no libres, incluido el cargador (bootloader) que queda dentro del ejecutable. El proyecto `pyinstaller-hooks-contrib` es Apache-2.0 / GPL-2.0 según el hook. No impone obligaciones sobre el código propio.

---

## 4. Electron, Chromium y Node.js

La aplicación de escritorio se ejecuta sobre **Electron 42.5.0**.

| Componente | Licencia | Titular | URL |
|---|---|---|---|
| Electron | MIT | Electron contributors / GitHub Inc. | https://www.electronjs.org |
| Chromium y sus bibliotecas | BSD-3-Clause y otras (ver archivo) | The Chromium Authors y terceros | https://www.chromium.org |
| Node.js | MIT y otras | Node.js contributors / OpenJS Foundation | https://nodejs.org |

El instalador generado por `electron-builder` incluye los archivos de licencia oficiales de Electron:

- `LICENSE.electron.txt`: licencia MIT de Electron.
- `LICENSES.chromium.html`: licencias de Chromium y de todos sus componentes de terceros.

Estos archivos deben permanecer en la carpeta de instalación junto al ejecutable.

---

## 5. FFmpeg

La aplicación invoca `ffmpeg.exe` como **proceso independiente** (no lo enlaza) para convertir y trocear audio.

- **Proyecto:** FFmpeg, https://ffmpeg.org. © 2000-2026 los desarrolladores de FFmpeg.
- **Licencia del binario distribuido:** GNU LGPL, versión 2.1 o posterior. Compilación **win64-lgpl** de BtbN (https://github.com/BtbN/FFmpeg-Builds), sin `--enable-gpl` y sin `--enable-nonfree`. No contiene componentes GPL (libx264, libx265 y similares) ni propietarios (libfdk-aac).
- **Texto de la licencia:** se incluye junto al binario (`LICENSE.txt` / `COPYING.LGPLv2.1` del archivo de la compilación) y está en https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html.
- **Código fuente y configuración de compilación:** el código fuente de la versión exacta distribuida está en https://ffmpeg.org/releases/ (y en https://git.ffmpeg.org/ffmpeg.git), y los scripts y la configuración de compilación en https://github.com/BtbN/FFmpeg-Builds. La versión, la etiqueta y la configuración exactas (`ffmpeg -version`, `ffmpeg -buildconf`) deben anotarse aquí al fijar el binario: **[VERSIÓN Y ETIQUETA EXACTAS: rellenar al incorporar el binario]**.
- **Sustitución por el usuario:** como `ffmpeg.exe` es un ejecutable separado en `resources/bin/`, el usuario puede reemplazarlo por otra compilación compatible de FFmpeg.
- **Códecs incluidos relevantes:** el soporte MP3 usa LAME (LGPL-2.0+). Otras bibliotecas permisivas o LGPL del build conservan sus propias licencias (consúltese `ffmpeg -L` y la documentación de BtbN).

---

## 6. Modelos de voz

Los modelos de voz **no van dentro del instalador**: se descargan desde Hugging Face la primera vez que se usan. Se reconoce aquí su autoría.

| Modelo | Licencia | Titular | Origen |
|---|---|---|---|
| Whisper (tiny, base, small, medium, large) | MIT | © 2022 OpenAI | https://github.com/openai/whisper |
| faster-whisper-* (Systran): conversión de Whisper a formato CTranslate2 | MIT | SYSTRAN; pesos originales de OpenAI | https://huggingface.co/Systran |
| Silero VAD v6 (incluido en faster-whisper) | MIT | Silero Team | https://github.com/snakers4/silero-vad |

---

## 7. Tipografías

Licencia **SIL Open Font License 1.1 (OFL-1.1)**: https://openfontlicense.org. Permite uso, copia y redistribución, incluso comercial, siempre que se conserve el aviso de copyright y la licencia y no se vendan las fuentes por separado.

| Fuente | Titular del copyright | Origen |
|---|---|---|
| Inter | © The Inter Project Authors | https://github.com/rsms/inter |
| Outfit | © The Outfit Project Authors | https://github.com/Outfitio/Outfit-Fonts |
| JetBrains Mono | © The JetBrains Mono Project Authors | https://github.com/JetBrains/JetBrainsMono |

Al empaquetar los archivos de fuente en la aplicación, incluye junto a ellos el archivo `OFL.txt` de cada familia.

---

## 8. Modelos de lenguaje (LLM): no incluidos

La aplicación **no distribuye ningún LLM**. El análisis local usa [Ollama](https://ollama.com) (licencia MIT, no incluido), y el usuario descarga el modelo que elija directamente desde Ollama; cada modelo se rige por su propia licencia (por ejemplo MIT para Phi, Apache-2.0 para Qwen3 y Mistral 7B, Llama Community License para Llama). Revisa los detalles en [docs/LICENCIAS.md](docs/LICENCIAS.md).

Si el usuario activa el modo nube, las peticiones van a la API de OpenAI con su propia clave y se rigen por los términos de OpenAI.

---

## 9. Herramientas de compilación que no se distribuyen

Estas herramientas se usan solo para construir la aplicación y **no** forman parte del instalador, por lo que sus licencias no imponen obligaciones al producto final: Vite (MIT), `@vitejs/plugin-react` (MIT), Rolldown (MIT), lightningcss (MPL-2.0), electron-builder (MIT), oxlint (MIT), concurrently (MIT), wait-on (MIT), PyInstaller (GPL-2.0 con excepción), pytest (MIT). En el árbol de desarrollo de npm hay además utilidades menores con licencias WTFPL, BlueOak-1.0.0, Python-2.0 o MPL-2.0; todas son permisivas y ninguna se distribuye. No hay paquetes GPL, LGPL ni AGPL en el árbol de npm.
