# Distribución — Local Meeting Analyzer

Guía práctica para empaquetar, publicar y actualizar la app en Windows x64.

| Canal | Formato | Firma | Actualizaciones |
|---|---|---|---|
| **Principal: Microsoft Store** | `.appx` | Microsoft lo firma gratis al publicarlo | Las gestiona la Store |
| **Secundario: GitHub Releases** | Instalador NSIS `.exe` | Sin firma (por ahora) | `electron-updater` (cada 6 h) |

El usuario final no necesita Python ni Node: el backend va congelado con PyInstaller y `ffmpeg.exe` va incluido. Solo necesita **Ollama** para el análisis 100 % local (ver `docs/REQUISITOS.md`).

---

## 1. Qué contiene el paquete

```
resources/
├─ app.asar                      ← frontend (dist/) + electron/
├─ backend/meeting-backend.exe   ← backend FastAPI congelado (PyInstaller onedir) + _internal/
├─ bin/ffmpeg.exe                ← build LGPL (ver §8)
└─ app-update.yml                ← solo NSIS: a dónde mira electron-updater
```

**Datos del usuario.** Electron lanza el backend con `MEETING_ANALYZER_DATA_DIR = app.getPath('userData')`, así que `config.json`, `recordings/` y `logs/` **no** se escriben en la carpeta de instalación (que en MSIX es de solo lectura):

| Instalación | Carpeta de datos |
|---|---|
| NSIS (`.exe`) | `%APPDATA%\Local Meeting Analyzer\` (se conserva al desinstalar) |
| Microsoft Store | Windows la redirige a `%LOCALAPPDATA%\Packages\<PFN>\LocalCache\Roaming\Local Meeting Analyzer\` (se borra al desinstalar) |
| Desarrollo (`npm run dev`) | Sin cambios: `backend/config.json` y `backend/recordings/` |

Los modelos de Whisper **no** van en el paquete: se descargan de Hugging Face la primera vez (`%USERPROFILE%\.cache\huggingface`).

---

## 2. Build local

**Requisitos:** Windows x64, Node 22, el venv del backend (`npm run setup`) y `bin/ffmpeg.exe` (LGPL, ver §8).

```powershell
# Todo en uno: congela el backend, compila el frontend y genera NSIS + AppX
npm run dist:win

# O por partes
npm run build:backend                 # → backend/dist/meeting-backend/ (~250 MB)
cd frontend
npm run electron:build                # vite build + electron-builder (targets de package.json)
npm run dist:nsis                     # solo el .exe (más rápido para probar)
```

Salida en `frontend/dist-electron/`:

- `LocalMeetingAnalyzer-Setup-<versión>.exe` + `.blockmap` + `latest.yml`
- `LocalMeetingAnalyzer-<versión>-x64.appx`
- `win-unpacked/` (la app sin instalar, útil para probar)

**Notas**

- `scripts/build-backend.js` usa `backend/venv`. Para otro intérprete: `set BACKEND_PYTHON=C:\ruta\python.exe`.
- El build local se probó con Python 3.14 + PyInstaller 6.22. **CI usa Python 3.12**, que es la versión de referencia para releases.
- El spec (`backend/meeting_backend.spec`) excluye `torch`, `openai-whisper`, `numba`, etc. Pueden estar en tu venv de desarrollo, pero el backend no los usa.
- El spec aplica el *hotfix* de `soundcard` al venv antes de congelar; en la app instalada no se puede parchear.
- Pruebas del backend (aisladas en una carpeta temporal, no tocan tu `config.json` ni tus grabaciones):
  `cd backend && venv\Scripts\python -m unittest discover -s tests -v`

---

## 3. Proceso de release (GitHub)

1. Sube la versión en `frontend/package.json` (por ejemplo `1.3.0`). La versión de la Store será `1.3.0.0`.
2. Haz commit y crea el tag con **el mismo número**: `git tag v1.3.0 && git push origin v1.3.0`.
3. CI (`.github/workflows/build.yml`) hace lo siguiente:
   - Instala Python 3.12 y ejecuta las pruebas del backend.
   - Descarga FFmpeg LGPL y falla si el build es GPL.
   - Congela el backend y genera NSIS + AppX.
   - Crea un **borrador** de GitHub Release con el `.exe`, el `.blockmap` y el `latest.yml`.
   - El `.appx` queda como artefacto del workflow (*windows-installers*).
4. Revisa el borrador en GitHub → **Publish release**. Desde ese momento las instalaciones `.exe` se actualizan solas.
5. Descarga el `.appx` del artefacto y súbelo a Partner Center (§4).

> CI falla si el tag no coincide con `frontend/package.json`. En CI, `publish.owner` y `publish.repo` se sustituyen automáticamente por el repositorio real.

**Auto-update (solo `.exe`):** la primera búsqueda es unos 10 s tras arrancar y luego cada 6 h. Si hay una versión nueva, se descarga y aparece el diálogo «Hay una actualización lista — Reiniciar ahora / Más tarde». Con «Más tarde», se instala al cerrar la app. Si hay una grabación o transcripción en curso, el diálogo espera. Sin conexión, o si el repositorio no existe, el error solo se registra. Los borradores de release son invisibles para el updater hasta publicarlos.

---

## 4. Publicar en Microsoft Store (paso a paso)

1. **Cuenta.** Regístrate gratis como desarrollador individual en <https://storedeveloper.microsoft.com>.
2. **Reserva el nombre.** En Partner Center → *Apps and games* → *New product* → *MSIX or PWA app* → reserva **Local Meeting Analyzer**. Debe coincidir con `appx.displayName`.
3. **Copia la identidad del paquete.** Ve a *Product management* → *Product identity* y copia estos valores en `frontend/package.json` → `build.appx`:

   | Partner Center | `package.json` |
   |---|---|
   | `Package/Identity/Name` | `identityName` (hoy `REEMPLAZAR.PartnerCenter.PackageIdentityName`) |
   | `Package/Identity/Publisher` (`CN=...`) | `publisher` (hoy `CN=REEMPLAZAR-PartnerCenter-PackageIdentityPublisher`) |
   | `Package/Properties/PublisherDisplayName` | `publisherDisplayName` |

4. **Genera el paquete** (`npm run dist:win` o el artefacto de CI). No hace falta firmarlo: la Store lo firma.
5. **Crea la submission:**
   - **Pricing and availability:** gratis o de pago, y los mercados.
   - **Properties:** categoría *Productividad*. Indica que la app usa el micrófono.
   - **Age ratings:** completa el cuestionario IARC.
   - **Packages:** sube el `.appx`.
   - **Store listings:** usa los textos de `docs/store-listing.md`.
6. **Capacidad restringida `runFullTrust`.** Partner Center pide justificarla. Texto sugerido:
   > *Es una aplicación de escritorio Electron (Win32) empaquetada como MSIX. Necesita runFullTrust para ejecutar su motor local de transcripción (proceso auxiliar incluido en el paquete), capturar el audio del micrófono y del sistema, y comunicarse con Ollama en localhost. No usa la capacidad para nada más.*
7. **Política de privacidad (obligatoria, porque usa el micrófono).** Publica `docs/privacy.html` con GitHub Pages: *Settings → Pages → Deploy from a branch → `main` / `/docs`*. La URL será `https://<usuario>.github.io/<repo>/privacy.html`. Pégala en *Properties → Privacy policy URL*.
8. **Dependencia de Ollama.** Las políticas de la Store exigen declarar el software externo **en las dos primeras líneas de la descripción**. Por ejemplo:
   > *Requiere Ollama (gratuito, https://ollama.com) para el análisis con IA 100 % local. También puedes usar tu propia clave de OpenAI.*
9. **Envía a certificación.** Para cada actualización, sube un `.appx` con una versión mayor.

**Capacidades declaradas:** `runFullTrust` (obligatoria para Electron), `internetClient` (descarga de modelos, OpenAI opcional) y `microphone`.

**Probar el `.appx` sin la Store** (opcional): activa el modo desarrollador. Firma el paquete con un certificado de prueba cuyo `CN` coincida con `publisher` (`signtool sign`), o registra la carpeta descomprimida con `Add-AppxPackage -Register AppxManifest.xml`. Puedes validarlo con *Windows App Certification Kit* (WACK).

---

## 5. Instalador `.exe` sin firma: SmartScreen

Como el `.exe` no está firmado, Windows SmartScreen mostrará **«Windows protegió su PC»** al abrirlo. Indica a los usuarios:

1. Haz clic en **Más información**.
2. Pulsa **Ejecutar de todas formas**.

El instalador es *per-user*: no pide permisos de administrador y se instala en `%LOCALAPPDATA%\Programs\`. Crea accesos directos en el escritorio y en el menú Inicio, y muestra el EULA (`legal/EULA.txt`). Para la mayoría de usuarios conviene recomendar la versión de la **Microsoft Store**, que no muestra este aviso.

---

## 6. Firma de código a futuro

| Opción | Coste | Requisitos / notas |
|---|---|---|
| **SignPath Foundation** | Gratis | Solo proyectos open source con licencia aprobada por la OSI y repositorio público. Los builds deben salir de CI (GitHub Actions + acción de SignPath) y cada release se aprueba a mano. |
| **Azure Artifact Signing** (antes *Trusted Signing*) | ~9,99 USD/mes | **Verifica la elegibilidad de tu país**: se ofreció primero a organizaciones de EE. UU., Canadá, UE y Reino Unido, y a individuos de EE. UU. y Canadá. Se integra con electron-builder (`win.azureSignOptions`). |
| **Certificado OV** | ~200-400 USD/año | Desde 2023 la clave debe estar en un token/HSM (físico o en la nube), lo que complica firmar en CI. La reputación de SmartScreen se gana con descargas; ni OV ni EV la dan al instante. |

**Cuando tengas certificado:**

- Configura la firma en `build.win` (`signtoolOptions` o `azureSignOptions`).
- **Añade `publisherName`** (por ejemplo `win.signtoolOptions.publisherName` o `win.azureSignOptions.publisherName`) con el nombre exacto del certificado.
- Desde ese momento, electron-updater **verifica la firma** de cada actualización antes de instalarla. Hoy **no** está definido a propósito: sin firma, la verificación rechazaría todas las actualizaciones.
- Las versiones ya instaladas sin `publisherName` aceptan la primera versión firmada sin problema. Si más adelante cambias de certificado, `publisherName` acepta una lista: incluye el nombre antiguo y el nuevo para no cortar las actualizaciones.

---

## 7. Marcadores pendientes

| Dónde | Valor | De dónde sale |
|---|---|---|
| `frontend/package.json` → `build.appx.identityName` | `REEMPLAZAR.PartnerCenter.PackageIdentityName` | Partner Center → Product identity |
| `frontend/package.json` → `build.appx.publisher` | `CN=REEMPLAZAR-PartnerCenter-PackageIdentityPublisher` | Partner Center → Product identity |
| `frontend/package.json` → `build.appx.publisherDisplayName` | `REEMPLAZAR con PublisherDisplayName...` | Partner Center → Product identity |
| `frontend/package.json` → `build.publish.owner` / `repo` | `REEMPLAZAR-usuario-github` / `REEMPLAZAR-repositorio` | Tu repositorio de GitHub. CI los sustituye solo; cámbialos para builds locales que vayas a distribuir. |

---

## 8. FFmpeg: usar un build LGPL

- El `bin/ffmpeg.exe` local de desarrollo es un build **GPLv3** de gyan.dev (`--enable-gpl`, x264/x265). **No lo distribuyas.**
- Para releases usa el build **LGPL** estático de BtbN: <https://github.com/BtbN/FFmpeg-Builds/releases> → `ffmpeg-master-latest-win64-lgpl.zip`. Copia `bin/ffmpeg.exe` a `bin/` en la raíz del repo. CI lo descarga solo y falla si `-buildconf` contiene `--enable-gpl` o `--enable-nonfree`. Para builds reproducibles, puedes fijar una rama de release (`ffmpeg-nX.Y-latest-win64-lgpl-X.Y.zip`).
- La app solo usa ffmpeg para codificar MP3 y convertir audio. El build LGPL incluye `libmp3lame`, así que no se pierde nada.
- Cumplimiento LGPL: `ffmpeg.exe` es un ejecutable aparte (no se enlaza). Incluye su aviso de licencia y un enlace al código fuente en `THIRD_PARTY_NOTICES.md`. PyAV (`av`, usado por faster-whisper para decodificar audio) también trae DLLs de FFmpeg con licencia LGPL dentro del backend congelado.
