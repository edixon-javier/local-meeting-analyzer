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
- **Fase:** DESARROLLO — Proyecto implementado en versión `v1.1.0`.
- **Rama activa:** `main` (producción estable)
- **REGLA:** No modificar la arquitectura base sin revisar este archivo primero.
- **REGLA:** Antes de cualquier cambio de código, revisar la sección `## Control de Versiones (Git)` de este archivo.

## Entorno del Usuario (Instalado y Validado)
- ✅ Python 3.14.6
- ✅ Ollama 0.11.4 con modelo **Phi-3**
- ✅ FFmpeg en `C:\ffmpeg\bin` (en PATH)
- ✅ Node.js v22 + npm v9.6.3
- ✅ Librerías Python adicionales: `openai`, `fastapi`, `whisper`, `soundcard`

## Arquitectura Implementada

### Backend (Python FastAPI)
**Ruta:** `backend/`
- `main.py` — API FastAPI en `http://localhost:8765`
- `config_manager.py` — Gestión de configuraciones persistentes (`config.json`)
- `state.py` — Estado global e inicialización de motores
- `audio_capture.py` — Captura loopback de Windows con `soundcard`
- `transcriber.py` — Whisper local (modelos configurables)
- `analyzer.py` — Soporte dual: Ollama (LLM Local) / OpenAI (LLM Nube), retorna JSON estructurado
- `requirements.txt` — Dependencias Python
- `routers/` — Rutas modulares (`analysis.py`, `system.py`, `history.py`, `recording.py`)

**Endpoints disponibles:**
- `GET /status` — Estado de Ollama, grabación, modelos
- `GET /session` — Estado completo de la sesión actual
- `GET /config` / `POST /config` — Obtener y actualizar preferencias del usuario
- `POST /recording/start` — Iniciar grabación del sistema
- `POST /recording/stop` — Detener y guardar WAV
- `POST /transcribe` — Transcribir archivo WAV con Whisper (soporta diarización textual)
- `POST /analyze` — Analizar transcripción (Ollama / OpenAI)
- `GET /recordings` — Lista de grabaciones guardadas

### Frontend (Electron + React + Vite)
**Ruta:** `frontend/`
- `electron/main.js` — Proceso Electron (frameless window)
- `electron/preload.js` — Bridge seguro Node↔React
- `src/App.jsx` — Estado global y routing (Context API)
- `src/index.css` — Sistema de diseño Dark Mode Premium completo
- `src/api.js` — Capa de comunicación con backend (Axios)
- `src/components/TitleBar.jsx` — Barra de título personalizada
- `src/components/Sidebar.jsx` — Nav + historial + estado del sistema
- `src/components/RecordScreen.jsx` — Pantalla de grabación con pulso visual
- `src/components/AnalysisScreen.jsx` — Dashboard de resultados IA
- `src/components/SettingsScreen.jsx` — Configuración de hardware y motores de IA (Local vs Nube)
- `src/components/StatusBar.jsx` — Barra de estado inferior
- `src/components/Toast.jsx` — Notificaciones flotantes

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
- 📁 Historial de grabaciones
- 🎨 UI Premium Dark Mode (Slate/Indigo)

## Decisiones Descartadas
- ❌ Extensión de navegador — sustituida por app de escritorio nativa para capturar audio del sistema operativo sin restricciones de permisos web.
- ❌ Diarización de audio (Pyannote) — descartada por alto consumo de RAM/GPU. **Reemplazada exitosamente** por Diarización Textual (pasando los segmentos de tiempo a través del LLM para agrupar por contexto).

## Estructura de Carpetas
```
f:\Proyectos\Extension-reuniones\
├── .agents/skills/meeting_analyzer_context/SKILL.md
├── backend/
│   ├── main.py, audio_capture.py, transcriber.py, analyzer.py, config_manager.py, state.py
│   ├── requirements.txt, config.json
│   ├── routers/        (endpoints divididos)
│   └── recordings/     (archivos WAV generados)
├── frontend/
│   ├── electron/main.js, preload.js
│   ├── src/ (App.jsx, components/, index.css, api.js, context/)
│   └── package.json
├── start.bat           (punto de entrada único)
├── .gitignore
└── .agents/skills/meeting_analyzer_context/SKILL.md
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

**Flujo estándar para una feature:**
```
develop → feature/nombre → (PR/merge) → develop → release/x.y.z → main → tag vX.Y.Z
```

**Flujo para un fix urgente en producción:**
```
main → fix/nombre → main → tag vX.Y.Z+1 → merge back a develop
```

---

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

---

### Versionado Semántico (SemVer)

`vMAJOR.MINOR.PATCH`

| Incrementar | Cuándo |
|-------------|--------|
| `MAJOR` | Cambio de arquitectura que rompe compatibilidad |
| `MINOR` | Nueva funcionalidad retrocompatible |
| `PATCH` | Corrección de bug sin nuevas features |

**Versión actual del proyecto:** `v1.1.0`

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

### Flujo de Trabajo para el Agente

Cuando el agente realice cambios de código, debe seguir este flujo:

1. **Identificar el tipo de cambio** (feature / fix / refactor / docs)
2. **Verificar la rama actual** con `git branch --show-current`
3. **Crear rama** si el cambio es significativo: `git checkout -b feature/<nombre>`
4. **Ejecutar el checklist pre-commit** antes de hacer `git add`
5. **Redactar el mensaje** siguiendo Conventional Commits
6. **Actualizar `## Historial de Versiones`** en este SKILL.md si el cambio amerita un registro
7. **Sugerir al usuario** el tag de versión si el merge es a `main`

---

## Historial de Versiones

> Este registro se actualiza cada vez que se completa un cambio significativo y se hace merge a `main`.

| Versión | Fecha | Descripción | Rama |
|---------|-------|-------------|------|
| `v1.3.0` | 2026-07-02 | Probador de audio en tiempo real: medidores de nivel RMS en Configuración y Grabación, grabación de prueba temporal y reproductor integrado. | `develop` |
| `v1.2.0` | 2026-07-02 | Chat global de historial (RAG): Búsqueda semántica/palabras clave, snippets automáticos, HistoryChatScreen con badges interactivos y navegación directa. | `main` |
| `v1.1.0` | 2026-06-26 | Análisis Híbrido: Integración de OpenAI API, Diarización Textual, nueva pantalla SettingsScreen y gestión de `config.json`. | `main` |
| `v1.0.0` | 2026-06-25 | Release inicial: grabación loopback, Whisper local, análisis Phi-3/Ollama, UI Electron Premium Dark Mode | `main` |
