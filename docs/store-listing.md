<!--
NOTA PARA EL DESARROLLADOR: borrador de la ficha de Microsoft Store (Partner Center). Los textos que
se pegan en la Tienda están dentro de bloques de código para copiarlos sin formato. Los marcadores
entre corchetes ([...]) los debes completar tú. Los textos legales (privacidad, EULA) son borradores
que debe revisar un abogado antes de publicarlos.
-->

# Ficha de Microsoft Store (borrador)

Idioma principal de la ficha: **Español**. Se recomienda crear también una ficha en inglés.

## 1. Datos básicos

| Campo | Valor |
|---|---|
| **Nombre de la app** (reservar en Partner Center) | Local Meeting Analyzer |
| **Categoría** | Productividad |
| **Subcategoría** | La que ofrezca Partner Center más cercana a «Productividad personal» o «Negocios» |
| **Sitio web** | https://local-meeting-analyzer.vercel.app |
| **Correo de soporte** | [CORREO DE CONTACTO] |
| **URL de la política de privacidad** (obligatoria: usa el micrófono) | https://local-meeting-analyzer.vercel.app/privacy (copia de `docs/privacy.html` servida desde la web) |
| **Copyright** | © 2026 [NOMBRE DEL TITULAR] |
| **Términos de licencia** | Enlaza `LICENSE` (AGPL-3.0-or-later) y `legal/EULA.txt` (sin el bloque de nota para el desarrollador). Añade a la descripción: "Software libre (AGPL-3.0). Código fuente: https://github.com/edixon-javier/local-meeting-analyzer". |

## 2. Descripción corta (máx. 100 caracteres)

```
Graba, transcribe y resume tus reuniones con IA local en tu PC. Privado por defecto.
```

## 3. Descripción completa

> Las dos primeras líneas **deben** declarar la dependencia de Ollama (Microsoft Store exige informar de los requisitos de software adicionales). La Tienda usa texto plano: no hay Markdown, los guiones son simples y las líneas en blanco separan párrafos.

```
Requiere Ollama (gratuito) instalado para el análisis con IA local.
La app te guía para instalarlo.

Local Meeting Analyzer convierte tus reuniones en texto, resúmenes y tareas sin que tus grabaciones salgan de tu PC.

Graba el audio de tu micrófono y el audio del sistema (por ejemplo, tus videollamadas), transcríbelo con Whisper en tu equipo y obtén un resumen, las tareas acordadas y las decisiones con un modelo de IA local.

PRIVACIDAD PRIMERO
- Tus grabaciones, transcripciones y análisis se guardan en tu equipo.
- La transcripción y el análisis son locales por defecto.
- Sin cuentas, sin telemetría y sin anuncios.
- Opcional: usa OpenAI con tu propia clave API. Solo en ese caso el audio o el texto de la reunión se envían a OpenAI.

CARACTERÍSTICAS
- Grabación del audio del sistema y del micrófono.
- Transcripción local con Whisper (modelos tiny, base, small y medium).
- Transcripción en vivo mientras grabas.
- Análisis con IA: resumen, tareas, decisiones, tono y categorías.
- Reconocimiento textual de hablantes (Hablante A, B...) con nombres que puedes editar.
- Chat con IA sobre una reunión concreta o sobre todo tu historial.
- Marcadores y búsqueda en el historial de reuniones.
- Exportación del acta de la reunión.
- Interfaz moderna en modo oscuro.

REQUISITOS
- Windows 10 de 64 bits (versión 1809 o posterior) o Windows 11.
- Procesador x64 de 4 núcleos con AVX2, 8 GB de RAM y 10 GB de espacio libre.
- Un micrófono.
- Ollama instalado (gratuito, la app te guía). No se necesita GPU.
- Conexión a Internet solo para descargar los modelos de IA la primera vez, para actualizaciones y para el uso opcional de OpenAI.

IMPORTANTE
- Eres responsable de informar a los participantes y obtener su consentimiento cuando la ley lo exija antes de grabar.
- Las transcripciones y resúmenes generados por IA pueden contener errores. Verifícalos antes de tomar decisiones importantes.
```

## 4. Novedades de esta versión (primera publicación)

```
Primera versión pública de Local Meeting Analyzer: grabación del audio del sistema y del micrófono, transcripción local con Whisper, análisis con IA local (Ollama), chat con tu historial y exportación del acta.
```

## 5. Características (viñetas para «Funciones de la aplicación», máx. 20)

1. Graba el audio del sistema y del micrófono
2. Transcripción local con Whisper, sin enviar tu audio a la nube
3. Transcripción en vivo mientras grabas
4. Resumen, tareas, decisiones y tono con IA local
5. Reconocimiento textual de hablantes con nombres editables
6. Chat con IA sobre una reunión o sobre todo tu historial
7. Marcadores, historial y exportación del acta
8. Sin cuentas, telemetría ni anuncios

## 6. Requisitos del sistema (para la ficha)

**Mínimos**
- SO: Windows 10 de 64 bits (versión 1809 o posterior) o Windows 11
- Procesador: x64 de 4 núcleos con soporte AVX2
- Memoria: 8 GB de RAM
- Almacenamiento: 10 GB libres
- Otros: micrófono; Ollama instalado (gratuito, la app guía la instalación)

**Recomendados**
- Procesador de 6 núcleos o más, 16 GB de RAM y SSD con 20 GB libres
- GPU NVIDIA o AMD compatible (opcional; Ollama la aprovecha automáticamente)

Detalle completo: [REQUISITOS.md](REQUISITOS.md).

## 7. Palabras clave (hasta 7)

```
transcripción
reuniones
acta de reunión
Whisper
grabadora de reuniones
resumen con IA
Ollama
```

## 8. Capturas y recursos gráficos sugeridos

- 4 a 6 capturas de pantalla (por ejemplo, 1920×1080): pantalla de grabación con transcripción en vivo, análisis con resumen y tareas, historial, chat con IA, ajustes (proveedor local) y pantalla de privacidad o consentimiento.
- Sin información personal ni nombres reales en las capturas.
- Logotipo de la app en los tamaños que solicite Partner Center.
- Opcional: un tráiler corto mostrando el flujo grabar → transcribir → resumir.

## 9. Clasificación por edades (cuestionario IARC)

La clasificación final la genera IARC a partir de tus respuestas. Respuestas previstas:

| Pregunta | Respuesta |
|---|---|
| Violencia, sangre, miedo | No |
| Contenido sexual o desnudez | No |
| Lenguaje soez | No (la app no incluye contenido propio; solo procesa el audio del usuario) |
| Sustancias controladas (drogas, alcohol, tabaco) | No |
| Humor grosero | No |
| Apuestas o juegos de azar | No |
| Compartición de contenido generado por usuarios | **No.** La app no ofrece ninguna función para publicar o compartir contenido con otros usuarios. |
| Interacción entre usuarios (chat, foros, multijugador) | No. El «chat» es con un asistente de IA local sobre las propias reuniones del usuario, no con otras personas. |
| Compartición de la ubicación | No |
| Compras digitales dentro de la app | **No** (por ahora; si se añaden funciones «Pro», actualiza el cuestionario) |
| Acceso a Internet sin restricciones (navegador) | No. La app no incluye un navegador. |
| Comparte datos personales con terceros | No de forma predeterminada. Solo si el usuario configura su propia clave de OpenAI y lo elige. |
| Uso del micrófono | **Sí.** Declarar la capacidad `microphone`. Graba el audio del usuario y del sistema, a petición suya, con un aviso de consentimiento. |

Resultado esperado: una clasificación apta para público general, sujeta a lo que determine IARC.

## 10. Justificación de la capacidad restringida `runFullTrust`

Partner Center pedirá una justificación para la capacidad restringida `runFullTrust`. Texto listo para pegar (en inglés, que es el idioma de los revisores):

```
Local Meeting Analyzer is a desktop application built with Electron. It requires the runFullTrust restricted capability because it launches and manages a bundled local backend process (a Python speech-recognition service) that runs the Whisper speech-to-text model entirely on the user's device, and because it captures the system audio output (WASAPI loopback) together with the microphone to record meetings at the user's request. These Win32 components cannot run inside the AppContainer sandbox of a UWP app.

The application talks to its backend and to the Ollama service that the user installs locally only over localhost. It stores its data in its own application data folder, and reads or writes other files only when the user explicitly chooses them (for example, importing an audio file or exporting meeting minutes). It does not require administrator privileges, does not install services or drivers, and does not change system settings.

No audio or text leaves the device unless the user explicitly configures their own API key for an optional cloud provider (OpenAI, Anthropic Claude, Google Gemini or Groq for dictation) and selects it. Dictation is local by default. The app has no telemetry, no accounts and no ads. A privacy policy is available at the URL provided in the listing.
```

Referencia en español (no es necesario pegarla):

> La aplicación de escritorio, creada con Electron, necesita `runFullTrust` porque inicia y gestiona un proceso de backend local incluido en el paquete (un servicio de reconocimiento de voz en Python) que ejecuta el modelo Whisper íntegramente en el dispositivo del usuario, y porque captura el audio de salida del sistema (WASAPI loopback) junto con el micrófono para grabar reuniones a petición del usuario. Estos componentes Win32 no pueden ejecutarse en el sandbox AppContainer de una app UWP. La app se comunica con su backend y con el Ollama instalado localmente solo mediante `localhost`, guarda sus datos en su propia carpeta de datos y solo lee o escribe otros archivos cuando el usuario los elige. No requiere privilegios de administrador, no instala servicios ni controladores ni cambia la configuración del sistema. Ningún audio ni texto sale del dispositivo salvo que el usuario configure su propia clave de OpenAI. No hay telemetría, cuentas ni anuncios.

> **Verifica antes de pegar** que cada afirmación sea cierta para tu build empaquetado (en especial: sin privilegios de administrador, sin servicios ni controladores, y que el audio de loopback se captura desde el proceso empaquetado).

### Capacidades del manifiesto (revisar con el `AppxManifest.xml` real)

| Capacidad | Para qué |
|---|---|
| `runFullTrust` (restringida) | Proceso de backend local y captura del audio del sistema (véase arriba) |
| `microphone` | Grabar el micrófono del usuario |
| `internetClient` | Descargar modelos, comprobar actualizaciones y uso opcional de OpenAI |

## 11. Notas para certificación

Texto sugerido (en inglés) para el campo «Notas para certificación»:

```
No account or sign-in is required.
The app records meetings (system audio and microphone) and transcribes them locally with Whisper. Whisper models are downloaded from Hugging Face on first use, so an Internet connection is needed the first time.
AI analysis (summary, tasks, decisions) uses Ollama, a free third-party program that must be installed separately; the app guides the user through installing it (the listing discloses this requirement). Transcription works without Ollama.
To test: launch the app, accept the recording consent notice, choose the microphone and system audio mode in the Record screen, record a short clip, and open it from History.
The microphone permission is requested by Windows the first time the app records. Nothing is sent to any server unless the user enters their own OpenAI API key and selects OpenAI as the provider.
```

## 12. Lista de comprobación antes de enviar

- [ ] La política de privacidad está publicada en una URL pública y funciona (sin la nota de borrador y sin marcadores `[...]`).
- [ ] El EULA final (revisado por un abogado) está pegado o enlazado.
- [ ] Las dos primeras líneas de la descripción mencionan la dependencia de Ollama.
- [ ] El nombre «Local Meeting Analyzer» está reservado en Partner Center.
- [ ] Las capturas no muestran datos personales.
- [ ] Cuestionario IARC respondido y capacidad `microphone` declarada.
- [ ] Justificación de `runFullTrust` pegada y verificada.
- [ ] Notas para certificación pegadas.
- [ ] Documentos `THIRD_PARTY_NOTICES.md` y licencias de modelos revisados.
