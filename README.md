# Local Meeting Analyzer

Local Meeting Analyzer es una aplicación de escritorio **Híbrida (Privacidad-Primero)** para Windows que graba el audio del sistema o micrófono, lo transcribe y lo analiza mediante Inteligencia Artificial.

Concebida para capturar el valor de tus reuniones sin comprometer tu privacidad, realiza la transcripción y el análisis **de manera local en tu equipo** por defecto usando Whisper y Ollama (Qwen3). Opcionalmente, permite delegar el procesamiento a modelos en la nube (OpenAI) con tu propia clave API para mayor velocidad y precisión; solo en ese caso el audio o el texto de tus reuniones salen de tu equipo.

## ✨ Características

- 🎙️ **Grabación Nativa de Audio**: Captura el audio del sistema operativo (loopback en Windows) o de tu micrófono.
- 📝 **Transcripción Local Inteligente**: Utiliza modelos locales de Whisper (tiny, base, small, medium, large) que se descargan la primera vez que los usas.
- ⚡ **Transcripción en Vivo**: Visualiza la transcripción en tiempo real palabra por palabra.
- 🧠 **Análisis Híbrido Estructurado**: Extrae el resumen, tareas, decisiones, tono y categorías de la reunión usando Ollama (Local) o OpenAI (Cloud, opcional).
- 👥 **Diarización Textual**: Reconoce a los diferentes hablantes (Hablante A, B) basándose en el contexto del diálogo.
- 💬 **Asistente de Chat RAG**: Chatea de forma interactiva con el contenido de una reunión o realiza búsquedas semánticas sobre *todo tu historial* de reuniones.
- 🛡️ **Privacidad Primero**: Tus datos, grabaciones y metadatos se guardan localmente. Sin cuentas, sin telemetría, sin anuncios. La nube (OpenAI) solo se usa si tú la activas con tu propia clave API.
- 🤖 **Servidor MCP Local (Model Context Protocol)**: Conecta agentes externos (Claude, Cursor, Antigravity) para consultar tareas, resúmenes y transcripciones de forma privada (ver [docs/MCP-INTEGRACION.md](docs/MCP-INTEGRACION.md)).
- 🎧 **Exportación y Gestión Rápida de Audios**: Descarga copias de tus grabaciones o ábrelas directamente en el Explorador de Windows para compartirlas al instante en Slack, Teams o correo.
- 🎨 **Interfaz Moderna (UI/UX)**: Diseño premium en Dark Mode (Slate/Indigo) con animaciones fluidas construido sobre Electron y React.

## ⬇️ Descarga e Instalación (usuarios)

> Solo para **Windows**. Si quieres ejecutar el proyecto desde el código fuente, ve a la sección *Instalación y Uso (desarrollo)* más abajo.

1. **Microsoft Store (recomendado)**: instálala desde [ENLACE DE MICROSOFT STORE] (próximamente). Se actualiza sola y evita, en general, las advertencias de SmartScreen.
2. **GitHub Releases**: descarga el instalador `.exe` desde [URL DEL REPOSITORIO]/releases. Windows SmartScreen puede mostrar una advertencia al ejecutarlo; consulta [docs/DISTRIBUCION.md](docs/DISTRIBUCION.md) para saber por qué ocurre y cómo proceder.

**Primeros pasos tras instalar:**

1. Instala **[Ollama](https://ollama.com/)** (gratuito), necesario para el análisis con IA local. La app te guía para instalarlo y descargar el modelo `qwen3:4b`.
2. Abre la aplicación y acepta el aviso de consentimiento de grabación.
3. La primera vez que transcribas, la app descargará el modelo de voz de Whisper (requiere conexión a Internet).
4. ¡Graba tu primera reunión!

## 💻 Requisitos

Resumen (detalle y razones en **[docs/REQUISITOS.md](docs/REQUISITOS.md)**):

| | Mínimo | Recomendado |
|---|---|---|
| **Sistema** | Windows 10 de 64 bits (1809 o posterior) o Windows 11 | — |
| **CPU** | x64 de 4 núcleos con AVX2 | 6 núcleos o más |
| **RAM** | 8 GB | 16 GB |
| **Disco** | 10 GB libres | SSD con 20 GB libres |
| **Otros** | Micrófono y [Ollama](https://ollama.com/) instalado | — |

- La **GPU no es necesaria**: Ollama usa automáticamente una GPU NVIDIA/AMD compatible si existe.
- Se necesita **Internet** solo para la descarga inicial de la app y los modelos, las actualizaciones y el uso opcional de OpenAI.
- En equipos modestos, la app sugiere modelos Whisper `tiny`/`base` y modelos de lenguaje más ligeros.

## 🚀 Arquitectura

El proyecto se divide en dos grandes piezas:
- **Backend (Python + FastAPI)**: Responsable de la captura de audio en streaming (evitando desbordamientos de memoria - OOM), orquestación de modelos Whisper, comunicación con Ollama/OpenAI y almacenamiento local de metadatos (JSON) y audios (MP3).
- **Frontend (Electron + React + Vite)**: Aplicación nativa de escritorio sin bordes, que se comunica con el backend mediante una capa robusta de peticiones HTTP y Server-Sent Events (SSE) para actualizaciones en vivo de estado, transcripción y salud del motor de IA.

## 📦 Requisitos Previos (desarrollo)

Para ejecutar el proyecto desde el código fuente, asegúrate de tener instalados los siguientes componentes antes de iniciar:

- **Node.js**: v18 o superior.
- **Python**: 3.10 a 3.14.
- **FFmpeg**: Configurado y accesible en el `PATH` del sistema.
- **Ollama** (necesario para el análisis con IA local; alternativamente puedes usar OpenAI): [Descargar Ollama](https://ollama.com/) y tener instalado el modelo `qwen3:4b` (`ollama pull qwen3:4b`).

## 🛠️ Instalación y Uso (desarrollo)

1. **Clonar el repositorio**
   ```bash
   git clone [URL DEL REPOSITORIO]
   cd <carpeta-del-repositorio>
   ```

2. **Inicio Rápido (Windows)**
   Simplemente haz doble clic en el archivo `start.bat`. Este script instalará automáticamente las dependencias de Python y Node.js si faltan, y levantará tanto el backend como la aplicación de Electron.

   *Alternativamente, para inicializar el entorno de desarrollo:*
   ```bash
   npm run setup
   npm run dev
   ```

3. **Ejecución Manual**
   Si prefieres levantar los servicios de forma manual en terminales separadas:
   
   **Backend:**
   ```bash
   cd backend
   python -m venv venv
   venv\Scripts\activate
   pip install -r requirements.txt
   python main.py
   ```
   
   **Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## ⚙️ Variables de Entorno y Configuración

El proyecto gestiona sus configuraciones a través de la UI (Pantalla de Ajustes), la cual persiste las opciones en el archivo `config.json` dentro de la carpeta de datos de la aplicación (`%APPDATA%\Local Meeting Analyzer\` en la app instalada; al ejecutar desde el código fuente puede ubicarse en `backend/config.json`). Si configuras una clave de OpenAI, se guarda localmente en ese archivo **en texto plano**: no lo subas a ningún repositorio ni lo compartas.
Si deseas forzar el puerto del backend, puedes crear un archivo `.env` en la raíz del proyecto:

```env
BACKEND_PORT=8765
```

## 🔒 Privacidad y Datos

Local Meeting Analyzer está diseñada para que tus reuniones se queden en tu equipo:

- **Local por defecto**: la transcripción (faster-whisper, en CPU) y el análisis (Ollama, en `localhost:11434`) se ejecutan en tu equipo.
- **Almacenamiento local**: grabaciones (MP3 + JSON con transcripción, análisis y nombres de hablantes), `config.json` y `logs` se guardan en `%APPDATA%\Local Meeting Analyzer\`. **No están cifrados**: te recomendamos activar BitLocker.
- **OpenAI es opcional**: solo se usa si introduces tu propia clave API **y** lo eliges como proveedor, o activas expresamente «usar la nube si el modelo local no está disponible». En ese caso el audio y/o el texto se envían a OpenAI, bajo sus términos.
- **Conexiones de red**: descarga de modelos (Whisper desde Hugging Face; modelos de Ollama desde ollama.com), comprobación de actualizaciones (GitHub Releases; la versión de Microsoft Store la actualiza la Tienda) y, solo si lo activas, OpenAI. «Reportar problema» abre tu navegador o correo con un informe prellenado; no se envía nada automáticamente.
- **Sin telemetría, cuentas, anuncios ni venta de datos.**
- **Eliminar tus datos**: borra grabaciones desde la pantalla Historial; para eliminar todo, desinstala la app y borra la carpeta `%APPDATA%\Local Meeting Analyzer\`.

⚠️ **Grabar a otras personas**: eres responsable de informar a los participantes y de obtener su consentimiento cuando la ley lo exija. Consulta [legal/CONSENT_NOTICE.md](legal/CONSENT_NOTICE.md).

Detalle completo en la [Política de Privacidad](legal/PRIVACY.md).

## 🤝 Contribuciones

¡Las contribuciones son bienvenidas! Revisa la estrategia de ramas y las convenciones de Commits (`Conventional Commits`) en nuestro manual para desarrolladores antes de enviar un Pull Request. 

## ⚖️ Legal

- [Política de Privacidad](legal/PRIVACY.md) (versión web: [docs/privacy.html](docs/privacy.html))
- [Licencia y términos de uso](legal/EULA.txt)
- [Aviso de consentimiento de grabación](legal/CONSENT_NOTICE.md)
- [Avisos de componentes de terceros y licencias de modelos](THIRD_PARTY_NOTICES.md)

## 📄 Licencia

Local Meeting Analyzer es software libre bajo la **GNU Affero General Public License v3.0 o posterior** (AGPL-3.0-or-later). Consulta el archivo [`LICENSE`](LICENSE). Los avisos sobre consentimiento, privacidad y exactitud de la IA están en [`legal/EULA.txt`](legal/EULA.txt), y las licencias de los componentes de terceros en [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

El nombre "Local Meeting Analyzer" y su logotipo no se licencian con el código: si publicas una versión modificada, usa otro nombre.
