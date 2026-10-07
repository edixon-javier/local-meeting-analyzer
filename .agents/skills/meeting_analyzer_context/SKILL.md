---
name: meeting_analyzer_context
description: Contexto principal, arquitectura y reglas del proyecto de Grabación y Análisis de Reuniones.
---

# Contexto del Proyecto: Meeting Analyzer

## Visión del Producto
Una aplicación de escritorio que graba el audio del sistema operativo (loopback), lo transcribe y lo analiza con IA. Originalmente concebida como una herramienta 100% local, el proyecto ha evolucionado a un paradigma **"Híbrido Privacidad-Primero"**:
- Por defecto, todo el procesamiento (transcripción y análisis) es **100% local** (Whisper + Ollama), garantizando máxima privacidad sin envío de datos a la nube.
- Opcionalmente, el usuario puede habilitar **procesamiento en la nube (OpenAI)** desde los ajustes para obtener análisis más rápidos y complejos, delegando la capa de LLM a proveedores externos.

## Estado Actual
- **Fase:** DESARROLLO — Proyecto implementado en versión `v1.2.0` (estable) / `v1.3.1` (en desarrollo/develop).
- **Rama activa:** `develop` (desarrollo activo) / `main` (producción estable).
- **REGLA:** No modificar la arquitectura base sin revisar este archivo primero.
- **REGLA:** Antes de cualquier cambio de código, revisar la sección `## Control de Versiones (Git)` de este archivo.

## Entorno del Usuario (Instalado y Validado)
- ✅ Python 3.14.6
- ✅ Ollama 0.11.4 con modelo **Phi-3**
- ✅ FFmpeg disponible en el PATH (o el binario incluido en `bin/` del repositorio)
- ✅ Node.js v22 + npm v9.6.3
- ✅ Librerías Python adicionales: `openai`, `fastapi`, `whisper`, `soundcard`, `pydantic`

## Arquitectura Implementada

### Backend (Python FastAPI - Arquitectura Limpia/Modular)
**Ruta:** `backend/`
- `main.py` — Punto de entrada de la API FastAPI en `http://localhost:8765`.
- `requirements.txt` — Dependencias de Python.
- `config.json` — Almacén persistente de preferencias del usuario.
- `core/` — Módulos de configuración global del sistema.
  - `config.py` — Gestión y persistencia de `config.json` (`system_config`).
- `domain/` — Definición de contratos y modelos de dominio.
  - `interfaces.py` — Interfaces abstractas del sistema (`IAudioCapture`, `ITranscriber`, `IAnalyzer`, `IMetadataRepository`).
- `services/` — Lógica de negocio e implementaciones de interfaces.
  - `audio_service.py` — Captura de audio (loopback y micrófono), medidor RMS en tiempo real, streaming directo a disco para evitar OOM y compatibilidad con Bluetooth/dispositivos híbridos.
  - `live_transcription_service.py` — Streaming en tiempo real palabra por palabra con Faster-Whisper, segmentación VAD, timestamps por palabra, emisión SSE y gestión de sesiones.
  - `transcription_service.py` — Transcripción local usando modelos Whisper.
  - `analysis_service.py` — Procesamiento de análisis híbrido con Ollama (Phi-3) y OpenAI (GPT-4o), diarización textual por contexto y chat.
  - `session_manager.py` — Gestión en memoria del estado de la sesión activa del usuario.
  - `metadata_repository.py` — Lectura, escritura y almacenamiento de archivos de metadatos `.json` en el historial.
  - `ollama_heartbeat.py` — Monitoreo periódico del estado de Ollama y push de eventos SSE.
- `api/routers/` — Controladores HTTP modulares.
  - `system.py` — Ajustes de configuración, selección de dispositivos, estado general y SSE `/events`.
  - `recording.py` — Iniciar, parar, pausar, reanudar, cancelar grabación, SSE en vivo `/recording/live-transcription`, control de prueba y niveles RMS en tiempo real.
  - `analysis.py` — Transcripción, análisis estructurado dual, chat individual y consulta RAG con historial global.
  - `history.py` — Listado, borrado, renombrado y subida externa de archivos en el historial.

*Nota sobre archivos legados:* Los antiguos archivos de la raíz del backend (`audio_capture.py`, `transcriber.py`, `analyzer.py`, `config_manager.py`, `state.py`) correspondían al pipeline inicial monolítico y fueron eliminados por no tener ningún importador activo.

**Endpoints disponibles:**
- **Sistema & Configuración (`/api/routers/system.py`):**
  - `GET /status` — Estado de Ollama, grabación, procesamiento y proveedor activo.
  - `GET /config` / `POST /config` — Obtener y actualizar preferencias del usuario.
  - `GET /audio/devices` — Lista de dispositivos de entrada disponibles (micrófonos y loopback).
  - `GET /status/ollama-models` — Modelos de Ollama instalados localmente.
  - `GET /events` — Canal de Server-Sent Events (SSE) para transmitir estados del sistema en tiempo real.
- **Grabación (`/api/routers/recording.py`):**
  - `POST /recording/start` — Iniciar grabación y sesión de streaming SSE.
  - `POST /recording/stop` — Detener grabación, finalizar stream en vivo y guardar archivo WAV/MP3.
  - `POST /recording/pause` — Pausar grabación y streaming de transcripción en vivo.
  - `POST /recording/resume` — Reanudar grabación y streaming de transcripción en vivo.
  - `POST /recording/cancel` — Cancelar grabación y transcripción en vivo liberando todos los recursos.
  - `GET /recording/live-transcription` — Canal SSE en tiempo real palabra por palabra con reconexión segura.
  - `POST /recording/test/start` / `/test/stop` — Iniciar/detener grabación de prueba temporal.
  - `GET /recording/test/levels` — Obtener niveles RMS en tiempo real de micrófono y sistema.
- **Transcripción & Análisis (`/api/routers/analysis.py`):**
  - `POST /transcribe` — Transcribir archivo de audio (soporta diarización por LLM).
  - `POST /analyze` — Ejecutar análisis estructurado (resumen, decisiones, tareas, tono, categoría).
  - `POST /chat` — Enviar pregunta de chat para una reunión específica.
  - `POST /chat/history` — Consulta global RAG basada en keywords en todo el historial de reuniones.
  - `POST /processing/cancel` — Cancelar transcripción/análisis en curso.
- **Historial (`/api/routers/history.py`):**
  - `GET /recordings` — Lista de reuniones guardadas con sus resúmenes y metadatos.
  - `GET /recordings/metadata` — Obtener datos (.json) de una grabación específica por ruta.
  - `POST /recordings/upload` — Subir archivo de audio externo para ser procesado.
  - `POST /recordings/{filename}/rename` — Renombrar grabación y metadatos asociados.
  - `DELETE /recordings/{filename}` — Eliminar archivos de audio y metadatos del disco.

### Frontend (Electron + React + Vite)
**Ruta:** `frontend/`
- `electron/main.js` — Proceso principal de Electron (frameless window, integración IPC y menús).
- `electron/preload.js` — Puente de contexto seguro (preload) entre Node y React.
- `src/App.jsx` — Enrutamiento, control de pantallas e inicialización.
- `src/index.css` — Estilos globales de UI premium Dark Mode (Slate/Indigo) con micro-animaciones.
- `src/api.js` — Cliente Axios configurado con Circuit Breaker para desconexiones, reintentos y mapeo de endpoints.
- `src/context/SystemContext.jsx` — Contexto React que centraliza el estado de la grabación, polling inteligente adaptativo y detector SSE para eventos del backend en tiempo real.
- `src/hooks/useAnalysisPipeline.js` — Hook personalizado de orquestación de caché local, diarización textual, Whisper y flujo de análisis.
- `src/components/` — Componentes y pantallas de la aplicación:
  - `TitleBar.jsx` — Barra superior nativa personalizada.
  - `Sidebar.jsx` — Navegación lateral con estado del sistema e historial rápido.
  - `RecordScreen.jsx` — Grabación del sistema/micro, medidores RMS e importador (Drag & Drop) de audios.
  - `HistoryScreen.jsx` — Panel de administración del historial (renombrar, borrar, descargar).
  - `HistoryChatScreen.jsx` — Asistente de chat global RAG interactivo con badges de reuniones referenciadas.
  - `AnalysisScreen.jsx` — Dashboard con los resultados del análisis (resumen, decisiones, tareas).
  - `ChatPanel.jsx` — Panel lateral de conversación interactiva sobre la reunión actual.
  - `OfflineOverlay.jsx` — Pantalla de bloqueo e indicación visual de backend fuera de línea.
  - `StatusBar.jsx` — Barra de estado inferior (versión, modelos activos).
  - `Toast.jsx` — Notificaciones flotantes rápidas.
  - `analysis/`
    - `TranscriptPanel.jsx` — Visualizador segmentado del diálogo con diarización.
    - `InsightsPanel.jsx` — Desglose de tareas, decisiones e insights estructurados.

## Cómo Ejecutar
1. Doble clic en `start.bat` (instalará dependencias automáticamente la primera vez)
2. O manualmente:
   - `cd backend && venv\Scripts\activate && python main.py`
   - `cd frontend && npm run dev` (en otra terminal)

## Funcionalidades Implementadas
- 🎙️ Grabación de audio del sistema (loopback nativo Windows) o micrófono.
- 📝 Transcripción con Whisper local (modelo seleccionable).
- 🧠 **Análisis Híbrido**: Soporte nativo para Phi-3 (Ollama) local y modelos GPT-4o (OpenAI) en la nube.
  - Resumen en 3 puntos clave
  - Tareas pendientes con responsable y fecha
  - Tono de la reunión
  - Categorización automática
  - Decisiones clave
  - Observación de densidad
- 👥 **Diarización Textual**: Separación de hablantes ("Hablante A", etc.) utilizando el LLM estructurado.
- ⚙️ **Configuración Dinámica**: Ajustes de modelos, credenciales de API y modo de grabación persistentes.
- 📁 Historial de grabaciones completo con renombrado y eliminación física.
- 💬 **Chat de Reunión & RAG Global**: Chatea con una reunión en específico o consulta todo el historial consolidado con un buscador semántico basado en keywords.
- 🎛️ **Probador de Audio y RMS**: Comprobación en vivo del volumen RMS del sistema y micrófono antes y durante la grabación.
- ⚡ **Streaming en tiempo real a disco**: Evita el desbordamiento de memoria (OOM) durante grabaciones largas.
- 🎨 UI Premium Dark Mode (Slate/Indigo) con animaciones pulidas e indicador offline.

## Decisiones Descartadas
- ❌ Extensión de navegador — sustituida por app de escritorio nativa para capturar audio del sistema operativo sin restricciones de permisos web.
- ❌ Diarización de audio (Pyannote) — descartada por alto consumo de RAM/GPU. **Reemplazada exitosamente** por Diarización Textual (pasando los segmentos de tiempo a través del LLM para agrupar por contexto).
- ❌ Base de datos pesada (SQL/NoSQL) — reemplazada por almacenamiento local liviano basado en archivos JSON autogestionados de metadatos (caché local rápida, portable y privada).

## Estructura de Carpetas
```
<raíz-del-repositorio>/
├── .agents/
│   └── skills/
│       └── meeting_analyzer_context/
│           └── SKILL.md
├── backend/
│   ├── api/
│   │   └── routers/               # Endpoints modulares (analysis, history, recording, system)
│   ├── core/
│   │   └── config.py              # Clase Config singleton
│   ├── domain/
│   │   └── interfaces.py          # Interfaces abstractas del sistema
│   ├── services/                  # Capa de servicios / lógica de negocio
│   │   ├── audio_service.py
│   │   ├── transcription_service.py
│   │   ├── analysis_service.py
│   │   ├── session_manager.py
│   │   ├── metadata_repository.py
│   │   └── ollama_heartbeat.py
│   ├── recordings/                # WAVs generados y archivos de metadatos .json
│   ├── main.py                    # Punto de entrada FastAPI
│   ├── config.json                # Preferencias del usuario persistidas
│   └── requirements.txt
├── frontend/
│   ├── electron/
│   │   ├── main.js
│   │   └── preload.js
│   ├── src/
│   │   ├── components/            # Componentes React (pantallas, chat, barra de título)
│   │   ├── context/
│   │   │   └── SystemContext.jsx  # Contexto de estado y eventos SSE
│   │   ├── hooks/
│   │   │   └── useAnalysisPipeline.js
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── api.js
│   └── package.json
├── start.bat                      # Lanzador unificado de desarrollo
└── .gitignore
```

---

## Control de Versiones (Git)

> **REGLA CRÍTICA:** El agente DEBE seguir esta guía en cada cambio de código. Nunca sugerir un commit sin verificar el checklist pre-commit.

### Estrategia de Ramas

```
main              → producción estable, siempre deployable. Solo recibe merges de release/* o fix/* urgentes.
develop           → integración continua. Base para todas las features.
feature/<nombre>  → nuevas funcionalidades (ej: feature/export-pdf, feature/speaker-detection)
fix/<nombre>      → correcciones de bugs (ej: fix/whisper-crash, fix/audio-loopback)
release/<versión> → preparación de release (ej: release/1.1.0) — bump de versión, changelog
```

### Mensajes de Commit — Conventional Commits

Formato: `<tipo>(<ámbito>): <descripción imperativa corta>`

| Tipo | Cuándo usarlo |
|------|---------------|
| `feat` | Nueva funcionalidad visible para el usuario |
| `fix` | Corrección de un bug |
| `docs` | Solo cambios en documentación (README, SKILL.md) |
| `style` | Cambios de CSS/formato sin lógica |
| `refactor` | Refactorización sin fix ni nueva feature |
| `perf` | Mejora de rendimiento |
| `test` | Agregar o corregir tests |
| `chore` | Build, dependencias, scripts auxiliares |
| `skill` | Actualizaciones de `.agents/` o `SKILL.md` |

**Ámbitos válidos del proyecto:**
`backend` · `frontend` · `electron` · `audio` · `transcriber` · `analyzer` · `ui` · `api` · `skill` · `deps` · `build` · `config`

### Versionado Semántico (SemVer)

`vMAJOR.MINOR.PATCH`

| Incrementar | Cuándo |
|-------------|--------|
| `MAJOR` | Cambio de arquitectura que rompe compatibilidad |
| `MINOR` | Nueva funcionalidad retrocompatible |
| `PATCH` | Corrección de bug sin nuevas features |

**Versión actual del proyecto:** `v1.2.0` (v1.3.1 en develop)

---

### Checklist Pre-Commit (OBLIGATORIO)

Antes de sugerir o ejecutar cualquier `git add` + `git commit`, verificar:

- [ ] `backend/venv/` → **NO incluir** (ya en `.gitignore`)
- [ ] `backend/recordings/` → **NO incluir** (audios privados del usuario)
- [ ] `backend/config.json` → **NO incluir** si contiene API Keys
- [ ] `backend/__pycache__/` → **NO incluir**
- [ ] `*.pt` → **NO incluir** (modelos Whisper pesados, >100 MB)
- [ ] `frontend/node_modules/` → **NO incluir**
- [ ] `frontend/dist/` → **NO incluir** (artefactos de build)
- [ ] `frontend/dist-electron/` → **NO incluir**
- [ ] `*.log` → **NO incluir**
- [ ] El mensaje de commit sigue el formato Conventional Commits
- [ ] El cambio pertenece a la rama correcta según el tipo (feature/fix/release)

---

## Historial de Versiones

> Este registro se actualiza cada vez que se completa un cambio significativo y se hace merge a `main`.

| Versión | Fecha | Descripción | Rama |
|---------|-------|-------------|------|
| `v1.7.0` | 2026-10-07 | Integración de Servidor MCP y Exportación de Audios: Servidor MCP local (`backend/mcp_server.py`) para agentes externos (Claude, Cursor, Antigravity) con herramientas de reuniones, resúmenes, transcripciones, tareas y búsqueda RAG; exportación nativa de grabaciones en Explorador de Windows y diálogo de guardado. | `feature/mcp-and-audio-export` |
| `v1.5.0` | 2026-09-18 | Minutas Ejecutivas y Renombrado Interactivo de Hablantes: Exportación de reportes ejecutivos (PDF formal, Markdown estructurado y portapapeles con HTML/Markdown), modal interactivo para renombrar hablantes ("Hablante A" -> Nombre real) con persistencia en JSON y sincronización RAG. | `feature/export-and-speaker-rename` |
| `v1.4.0` | 2026-09-18 | Live Transcription SSE: Streaming en tiempo real palabra por palabra con Faster-Whisper, segmentación VAD, reconexión inteligente, UI en RecordScreen con auto-scroll no intrusivo y cancelación limpia de recursos. | `feature/live-transcription` |
| `v1.3.2` | 2026-09-18 | Cierre y Estabilización: Blindaje de seguridad (path traversal), prevención de pérdida de datos (splitext en metadatos multiformato), cancelación en Whisper, prevención de fugas SSE, suite de 22 tests automatizados y circuit breaker robusto. | `feature/mic-tester` |
| `v1.3.1` | 2026-07-02 | Streaming de audio a disco en tiempo real (evita OOM) y corrección de compatibilidad con micrófonos Bluetooth/híbridos (cbSize/SubFormat) en Windows. | `develop` |
| `v1.3.0` | 2026-07-02 | Probador de audio en tiempo real: medidores de nivel RMS en Configuración y Grabación, grabación de prueba temporal y reproductor integrado. | `develop` |
| `v1.2.0` | 2026-07-02 | Chat global de historial (RAG): Búsqueda semántica/palabras clave, snippets automáticos, HistoryChatScreen con badges interactivos y navegación directa. | `main` |
| `v1.1.0` | 2026-06-26 | Análisis Híbrido: Integración de OpenAI API, Diarización Textual, nueva pantalla SettingsScreen y gestión de `config.json`. | `main` |
| `v1.0.0` | 2026-06-25 | Release inicial: grabación loopback, Whisper local, análisis Phi-3/Ollama, UI Electron Premium Dark Mode | `main` |
