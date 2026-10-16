# Registro de cambios

Todos los cambios relevantes de **Local Meeting Analyzer** se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[Versionado Semántico](https://semver.org/lang/es/) (SemVer: `MAYOR.MENOR.PARCHE`).

> **Versionado: SemVer.** `MAYOR` cambia cuando hay incompatibilidades (p. ej. formato de `config.json` o de los
> metadatos de reuniones), `MENOR` cuando se añade funcionalidad compatible y `PARCHE` para correcciones.
> La versión se mantiene sincronizada en `frontend/package.json` (la que usan electron-builder y la tienda),
> `package.json` (raíz) y `backend/core/version.py` (API y `/status`), y debe coincidir con la etiqueta `vX.Y.Z`
> que dispara la publicación (el CI comprueba que la etiqueta coincida con `frontend/package.json`).

El historial anterior al 1.6.0 se reconstruyó a partir de las etiquetas y de los commits del repositorio.

## [1.6.2] - 2026-10-16

### Corregido

- **IA local mucho más rápida en Windows.** Cada consulta a Ollama esperaba unos 2 segundos de más porque
  `localhost` se resolvía primero a IPv6; ahora se usa `127.0.0.1`. El estado del sistema responde en milisegundos
  en lugar de ~2 s y el análisis, el chat y la configuración de Ollama dejan de pagar esa espera en cada llamada.
- Configuración muestra los modelos de Ollama que tienes instalados (antes la consulta caducaba y siempre aparecía
  la lista de respaldo).
- El aviso de consentimiento empaquetado ya no incluye la nota para el desarrollador.

## [1.6.1] - 2026-10-16

### Añadido

- **Conectar OpenAI desde la bienvenida.** En el paso "Motor de IA", la opción "Usar mi clave de OpenAI" guía en
  tres pasos: abrir la página de claves, pegar la clave (botón Pegar y aviso si no empieza por `sk-`) y probarla.
  Solo se guarda si la prueba funciona; los errores se explican (clave no válida, cuenta sin saldo con enlace a
  facturación) y se indica qué se envía a OpenAI.
- **Configuración:** enlace "Conseguir una clave" para OpenAI, Claude, Gemini y Groq; se eliminan los espacios al
  pegar una clave y se avisa si su formato no es el esperado.
- Notas de cada versión con instrucciones de instalación para quien descarga.

### Corregido

- El botón para mostrar u ocultar una clave de API aparecía vacío (faltaban sus iconos).
- Los documentos legales (licencia y términos de uso, política de privacidad) ya no muestran marcadores ni la nota
  para el desarrollador en el instalador.

## [1.6.0] - 2026-10-16

Primera versión preparada para su distribución pública en Windows x64.

### Añadido

- **Empaquetado e instalación.** El backend se congela con PyInstaller (el usuario no necesita Python ni Node) y
  se incluye `ffmpeg` (build LGPL). Se generan un instalador NSIS (`.exe`) y un paquete MSIX/AppX para Microsoft
  Store. Los datos del usuario (configuración, grabaciones y registros) viven en la carpeta de datos de la
  aplicación y no en la carpeta de instalación.
- **Actualizaciones automáticas.** El instalador `.exe` se actualiza desde GitHub Releases (`electron-updater`) sin
  interrumpir grabaciones ni transcripciones en curso; la versión de Microsoft Store la actualiza la propia Store.
- **Integración continua (GitHub Actions).** Pruebas del backend y de la interfaz, lint, empaquetado y borrador de
  GitHub Release al publicar una etiqueta `v*`.
- **Documentos legales.** Política de privacidad, contrato de licencia (EULA), aviso de consentimiento de grabación
  y avisos de software de terceros. Se pueden abrir desde Ajustes > Acerca de / Legal.
- **Asistente de bienvenida (primer arranque).** Presentación, comprobación de hardware, guía de Ollama
  (instalación, inicio y descarga del modelo), descarga del modelo de voz y aviso de consentimiento antes de
  grabar. Se puede volver a abrir desde Ajustes > Ayuda y soporte.
- **Registros locales y soporte.** `backend.log` y `main.log` con rotación (1 MB), registro de errores no
  controlados y enmascarado de claves de API. En Ajustes > Ayuda y soporte: **Reportar problema** (abre un
  formulario con versión y sistema ya completados), **Copiar diagnóstico** y **Abrir carpeta de registros**. No hay
  telemetría: nada se envía automáticamente.
- **Interfaz de errores.** El `ErrorBoundary` ofrece "Copiar detalles" y "Reportar problema" además de recargar.
- Plantillas de incidencias de GitHub (error y sugerencia) y guía de soporte en `docs/SOPORTE.md`.
- Pruebas de interfaz con Vitest y Testing Library (`npm test`).
- La versión de la aplicación se expone en `GET /status` (`version`) y en Ajustes.
- **Servidor MCP (Model Context Protocol).** Claude Desktop, Cursor y otros asistentes compatibles pueden consultar
  reuniones, resúmenes, transcripciones y tareas. Funciona con la app instalada (`meeting-backend.exe --mcp`, sin
  Python) y Ajustes > Asistentes de IA (MCP) genera la configuración lista para copiar.
- **Dictado en cualquier aplicación.** Atajo global para dictar e insertar el texto en el cursor de otros programas,
  con modo literal o "Ideas claras" (pulido) e historial de dictados. Local por defecto; Groq u OpenAI opcionales.
- **Más proveedores de IA (opcionales, con tu clave):** Anthropic Claude (transcribe en local y envía solo texto) y
  Google Gemini, además de OpenAI.
- **Exportación de tareas** a calendario (`.ics`) y hoja de cálculo (`.csv`), y recuento de tareas pendientes.
- **Chat mejorado:** respuestas en streaming con Markdown, conversaciones guardadas y preguntas sugeridas.
- **Acceso rápido** en la barra lateral: reuniones fijadas, pendientes de analizar y recientes.
- **Nombres legibles** ("Reunión · 6 oct, 19:56"), duración real y tema de cada reunión en Historial; al renombrar
  se sugiere el tema.
- Descargar el audio de una reunión y mostrarlo en el Explorador.

### Cambiado

- **Configuración reorganizada** en secciones con un panel de resumen (incluido adónde van tus datos), aviso de
  cambios sin guardar e índice de secciones.
- **Estado del motor unificado** en la barra inferior (modelo que transcribe y que analiza según el proveedor real),
  con avisos en la barra lateral solo cuando algo requiere atención.
- Pulido general de interfaz y accesibilidad: foco visible, diálogos con teclado (Esc, foco atrapado),
  notificaciones accesibles y estados de carga.

- **Licencia.** El proyecto pasa a ser software libre bajo **AGPL-3.0-or-later** (`LICENSE`). El antiguo EULA
  se convierte en "Licencia y términos de uso", compatible con la AGPL.
- **Privacidad por defecto.** El proveedor de IA predeterminado es **local** (Ollama + Whisper). Se eliminó el
  respaldo silencioso a OpenAI cuando Ollama no responde: ahora solo ocurre si el usuario activa
  "Usar la nube (OpenAI) si el modelo local no está disponible" en Ajustes > Privacidad (`allow_cloud_fallback`,
  desactivado por defecto) y hay una clave de API. En caso contrario se muestra: "El modelo local no está
  disponible. Inicia Ollama o activa el uso de la nube en Ajustes." El audio nunca se envía a OpenAI con el
  proveedor local.
- **Clave de API protegida.** `GET /config` ya no devuelve la clave en claro (valor enmascarado y `has_api_key`).
  Ajustes muestra "Clave guardada (••••1234)"; dejar el campo vacío conserva la clave, escribir otra la reemplaza y
  hay un botón para borrarla. Los valores enmascarados nunca sobrescriben la clave guardada.
- **Modelo de lenguaje por defecto: `qwen3:4b`** (Apache-2.0, buen español, ~2.5 GB). Se envía `think: false` a
  Ollama y se elimina cualquier bloque `<think>…</think>` antes de interpretar el JSON. Las instalaciones
  existentes conservan el modelo que ya tenían configurado; la lista de respaldo pasa a `qwen3:4b`, `qwen3:1.7b`,
  `phi3`, `mistral` y `llama3.2`.
- **Fuentes autoalojadas** (Inter, Outfit y JetBrains Mono con `@fontsource`): ya no se consulta Google Fonts y la
  política de seguridad de contenido (CSP) es más estricta.
- El modelo Whisper se carga en la primera transcripción local, no al arrancar el backend (el arranque deja de
  depender de una descarga).
- Versiones unificadas en 1.6.0 (antes: 1.0.0, 1.2.0 y la etiqueta v1.5.0 no coincidían).
- El antiguo `CHANGELOG.md` (checklist de auditoría Open Source) pasa a `docs/AUDITORIA-OPEN-SOURCE.md`.

### Corregido

- Los errores internos del backend devuelven una respuesta JSON 500 con un mensaje claro (y cabeceras CORS) en lugar
  de hacer creer a la interfaz que el servidor está caído; el detalle técnico queda solo en el registro.
- El toast al perder la conexión con Ollama ya no promete un respaldo en la nube que no esté activado.
- Renombrar una grabación conserva todos sus metadatos y acepta títulos con caracteres no válidos en Windows.
- Los micrófonos ya no aparecen con el nombre duplicado ("Micrófono - Micrófono (…)").
- El dictado ya no envía audio a un servicio en la nube distinto del elegido ni cae a la nube cuando se eligió el
  modo local.

### Eliminado

- Limpieza del repositorio: módulos heredados del backend (`analyzer.py`, `audio_capture.py`,
  `config_manager.py`, `state.py`, `transcriber.py`) y recursos de plantilla sin uso del frontend.
- La dependencia `soundfile` (ningún módulo la usaba).

### Seguridad

- Las claves de API (`sk-…`) se enmascaran en todos los registros y diagnósticos; el diagnóstico oculta además el
  nombre de usuario de Windows en las rutas.
- `mailto:` se admite únicamente para "Reportar problema"; el resto de esquemas distintos de `http(s)` se siguen
  bloqueando al abrir enlaces externos.

## [1.5.0] - 2026-09-24

### Añadido

- **Minutas ejecutivas.** Exportación de reportes ejecutivos en PDF formal, Markdown estructurado y portapapeles
  (HTML/Markdown).
- **Renombrado interactivo de hablantes.** Modal para cambiar "Hablante A" por el nombre real, con persistencia en
  el JSON de la reunión y sincronización con el chat sobre el historial.
- `ErrorBoundary` global en React para atrapar errores de la interfaz.
- Estados de carga en el botón de iniciar grabación y retroalimentación visual mientras el backend prepara el audio.
- Auditoría de preparación Open Source (README, arquitectura por capas, accesibilidad básica).
- Primeras acciones de CI/CD y pruebas de interfaz; protección de `config.json` (con claves) fuera del control de
  versiones y archivo `config.example.json`.

### Cambiado

- Rediseño del flujo de controles de grabación (pausa, reanudar, finalizar, cancelar y marcadores) y del panel de
  transcripción en vivo (diseño, accesibilidad y disposición).
- Nueva identidad visual: icono de la aplicación.

### Corregido

- Los pulsos de la animación de grabación bloqueaban clics; se corrigió el desbordamiento del área visible.

## [1.4.0] - 2026-09-18

### Añadido

- **Transcripción en vivo (SSE).** Streaming palabra por palabra con Faster-Whisper, segmentación por VAD,
  reconexión inteligente, vista en la pantalla de grabación con auto-scroll no intrusivo y cancelación limpia de
  recursos.

## [1.3.2] - 2026-09-18

### Añadido

- Suite de 22 pruebas automatizadas del backend.
- Circuit breaker robusto en la capa de red del frontend.

### Corregido

- Protección frente a *path traversal* en el acceso a archivos de audio.
- Pérdida de datos al guardar metadatos de reuniones en distintos formatos de audio (uso de `splitext`).
- Cancelación efectiva de la transcripción con Whisper.
- Fugas de conexiones SSE.
- Desplazamiento de la ventana y recorte de la barra de título causados por `scrollIntoView`; solapamientos de
  diseño; progreso en vivo de la transcripción.
- Se fuerza el proveedor OpenAI cuando así se selecciona.

## [1.3.1] - 2026-07-02

### Cambiado

- El audio se escribe a disco en streaming mientras se graba (evita agotar la memoria en reuniones largas).

### Corregido

- Compatibilidad con micrófonos Bluetooth e híbridos en Windows (`cbSize` / `SubFormat`).

## [1.3.0] - 2026-07-02

### Añadido

- **Probador de audio en tiempo real:** medidores de nivel RMS en Configuración y Grabación, grabación de prueba
  temporal y reproductor integrado.

### Corregido

- Parámetro de invalidación de caché del reproductor de audio en Configuración.

## [1.2.0] - 2026-07-02

### Añadido

- **Chat global sobre el historial (RAG):** búsqueda semántica y por palabras clave, fragmentos automáticos y
  pantalla `HistoryChatScreen` con insignias interactivas y navegación directa a la reunión.
- Carga de audio existente por arrastrar y soltar para analizarlo.

## [1.1.0] - 2026-06-26

### Añadido

- **Análisis híbrido:** integración con la API de OpenAI como alternativa al análisis local.
- Diarización textual de hablantes.
- Pantalla de Configuración (`SettingsScreen`) y gestión de `config.json`.

## [1.0.0] - 2026-06-25

### Añadido

- Versión inicial: grabación de audio del sistema (loopback) y micrófono, transcripción local con Whisper, análisis
  con Phi-3 mediante Ollama e interfaz de escritorio con Electron (modo oscuro premium).
