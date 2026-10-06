# Requisitos del sistema — Local Meeting Analyzer

Local Meeting Analyzer transcribe y analiza tus reuniones **en tu propio equipo**. Eso significa que el rendimiento depende de tu hardware. Esta guía explica qué necesitas, por qué, y qué esperar si tu equipo es más modesto.

> **Importante:** la aplicación es solo para **Windows**. No hay versiones para macOS, Linux, Windows de 32 bits ni Windows en ARM.

## 1. Resumen

| | **Mínimo** | **Recomendado** |
|---|---|---|
| **Sistema operativo** | Windows 10 de 64 bits (versión 1809 o posterior) o Windows 11 | Igual que el mínimo, con las actualizaciones al día |
| **Procesador** | x64 con **4 núcleos** y soporte **AVX2** | 6 núcleos o más |
| **Memoria RAM** | **8 GB** | **16 GB** |
| **Almacenamiento** | **10 GB libres** | SSD con **20 GB libres** |
| **Audio** | Un micrófono | Un micrófono |
| **Software** | **Ollama** instalado (la app te guía) | Ollama instalado |
| **GPU** | No necesaria | Opcional: NVIDIA o AMD compatible |
| **Internet** | Solo para descargar la app y los modelos, actualizaciones y OpenAI opcional | Igual |

**Desglose de los 10 GB de espacio libre:**

| Concepto | Espacio aproximado |
|---|---|
| La aplicación | ~1 GB |
| Modelo de lenguaje `qwen3:4b` (Ollama) | ~2.5 GB |
| Modelos de voz Whisper | ~0.5–1.5 GB |
| Grabaciones | ~30 MB por hora de audio (MP3 a 64 kbps) |
| Ollama y margen de trabajo | El resto hasta los 10 GB |

Por ejemplo, 100 horas de reuniones ocupan unos 3 GB de grabaciones. Si piensas acumular muchas horas, necesitarás más espacio libre.

## 2. Por qué cada requisito

### Windows 10 (1809 o posterior) o Windows 11, 64 bits
La app captura el audio del sistema (loopback) y del micrófono con las funciones de audio de Windows, y se distribuye como aplicación de 64 bits. Es la versión mínima que soportamos y probamos. Windows 10 de 32 bits, versiones anteriores a la 1809 y Windows en ARM no están soportados.

### CPU x64 de 4 núcleos con AVX2
Toda la transcripción se ejecuta en la **CPU** (con `faster-whisper`) y el análisis con IA usa Ollama. Ambos usan instrucciones **AVX2** para ir a una velocidad razonable. En procesadores sin AVX2 pueden funcionar muy despacio o directamente no arrancar. Con menos de 4 núcleos, la transcripción y el análisis tardarán bastante más y la transcripción en vivo puede quedarse retrasada.

La mayoría de procesadores Intel Core desde la 4.ª generación (Haswell, 2013) y AMD Ryzen (2017) incluyen AVX2; algunos Celeron y Pentium económicos no.

### 8 GB de RAM
Funcionan a la vez la interfaz de la app, el servicio interno de transcripción con su modelo Whisper cargado, y el modelo de lenguaje de Ollama. Además suele estar abierta la herramienta de videollamada. Valores orientativos de memoria:

| Componente | RAM aproximada |
|---|---|
| Interfaz de la app y servicio interno | 0.5–1 GB |
| Whisper `tiny` / `base` | ~0.3–0.6 GB |
| Whisper `small` | ~1 GB |
| Whisper `medium` | ~2.5 GB |
| Whisper `large` | 4 GB o más |
| LLM `qwen3:4b` en Ollama | ~3–4 GB |
| LLM `qwen2.5:1.5b` o `llama3.2:1b` | ~1.5–2 GB |

Son cifras aproximadas y varían según la versión y la configuración. Con 8 GB, la combinación `small` + `qwen3:4b` es posible pero ajustada si tienes muchas otras aplicaciones abiertas. **Con 16 GB** puedes usar modelos más grandes con holgura.

### 10 GB de espacio libre (mejor en SSD)
Los modelos son archivos grandes que se descargan una vez (véase el desglose en la sección 1). Un **SSD** acelera mucho el arranque y la carga de modelos; en un disco duro mecánico (HDD) todo funciona, pero la primera carga de un modelo tarda bastante más. Se recomiendan **20 GB** libres para tener margen para varios modelos y muchas grabaciones.

### Un micrófono
Para grabar tu propia voz. La app puede capturar el audio que reproduce tu equipo (por ejemplo, a los demás participantes de una videollamada) y el de tu micrófono; sin micrófono, solo se grabará el audio del sistema.

### Ollama instalado
El análisis con IA local (resumen, tareas, decisiones, chat) lo ejecuta **Ollama**, un programa gratuito e independiente que debes tener instalado en tu equipo. **La app te guía para instalarlo** y descargar el modelo (`qwen3:4b` por defecto). Ollama atiende en `localhost:11434`. Sin Ollama, la grabación y la transcripción funcionan, pero el análisis con IA local no estará disponible (salvo que uses OpenAI de forma opcional).

### GPU: no es necesaria
La transcripción con Whisper se ejecuta siempre en la CPU. Si tu equipo tiene una **GPU NVIDIA o AMD compatible**, Ollama la aprovecha **automáticamente** para acelerar el análisis con IA; no tienes que configurar nada.

### Internet: solo en momentos puntuales
- Descargar la app (o actualizarla).
- Descargar los modelos de voz Whisper (la primera vez que usas cada uno) y los modelos de lenguaje de Ollama.
- Comprobar actualizaciones.
- Usar OpenAI, **solo si lo activas tú** con tu propia clave.

Después de la descarga inicial, la transcripción y el análisis locales funcionan **sin conexión**. Consulta la [Política de Privacidad](../legal/PRIVACY.md) para el detalle de las conexiones.

## 3. Cómo comprobar tu equipo

- **Versión de Windows:** pulsa `Win + R`, escribe `winver` y pulsa Intro.
- **RAM, procesador y tipo de sistema:** *Configuración > Sistema > Acerca de*.
- **Núcleos de CPU y uso:** *Administrador de tareas > Rendimiento > CPU*.
- **Espacio libre:** abre el Explorador de archivos y mira la unidad `C:`.
- **Desde PowerShell:**

  ```powershell
  Get-CimInstance Win32_Processor | Select-Object Name, NumberOfCores, NumberOfLogicalProcessors
  [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
  ```

- **AVX2:** Windows no lo muestra directamente. Busca el modelo de tu procesador en la web del fabricante, o usa la herramienta gratuita *Coreinfo* de Microsoft Sysinternals (`coreinfo -f` y busca `AVX2`).

## 4. Qué pasa en equipos más modestos

Si tu equipo está por debajo del mínimo o es justo, la app **seguirá funcionando en la mayoría de los casos, pero más despacio**. La app te sugiere modelos más ligeros (Whisper `tiny` o `base` y modelos de lenguaje más pequeños).

| Situación | Qué esperar | Qué hacer |
|---|---|---|
| Menos de 8 GB de RAM | Lentitud por uso del archivo de paginación; posibles errores de memoria al cargar `qwen3:4b` o Whisper `medium`/`large` | Usa Whisper `tiny` o `base` y un modelo de lenguaje ligero; cierra otras aplicaciones |
| CPU con menos de 4 núcleos | Transcripción y análisis mucho más lentos; la transcripción en vivo puede retrasarse | Usa Whisper `tiny` o `base`; transcribe al terminar la reunión; usa un modelo ligero |
| CPU sin AVX2 | Puede no funcionar, o ir extremadamente lento | Equipo no recomendado; valora usar OpenAI de forma opcional |
| Disco duro mecánico (HDD) | Arranque y carga de modelos lentos | Funciona; considera un SSD |
| Menos de 10 GB libres | Fallos al descargar modelos o al guardar grabaciones | Libera espacio o elige modelos más pequeños |
| Sin micrófono | No se grabará tu voz | Captura solo el audio del sistema |
| Sin internet en el primer uso | No se podrán descargar los modelos | Conéctate una vez para descargarlos |

### Modelos sugeridos según el equipo

| Tu equipo | Modelo Whisper | Modelo de lenguaje (Ollama) |
|---|---|---|
| Por debajo del mínimo | `tiny` o `base` | `qwen2.5:1.5b` o `llama3.2:1b` |
| Mínimo | `base` o `small` | `qwen3:4b` (o `qwen3:1.7b` si va lento) |
| Recomendado | `small` o `medium` | `qwen3:4b` |
| Con GPU compatible | Igual que arriba | El análisis se acelera solo, sin configurar nada |

**Whisper (tamaños aproximados):** `tiny` ~75 MB · `base` ~140 MB · `small` ~460 MB · `medium` ~1.5 GB · `large` ~3 GB. Cuanto mayor es el modelo, mejor la precisión y más RAM y tiempo necesita. El modelo se elige en **Ajustes**. Para la transcripción en vivo, la app puede descargar además un modelo ligero.

**Modelos de lenguaje (tamaños aproximados):** `qwen3:4b` ~2.5 GB · `qwen3:1.7b` ~1.4 GB · `llama3.2:1b` ~1.3 GB. Para usar un modelo más ligero, descárgalo con Ollama y selecciónalo en **Ajustes**:

```powershell
ollama pull qwen2.5:1.5b
```

Los modelos más pequeños son más rápidos y ligeros, pero sus resúmenes pueden ser menos precisos.

> **Licencias de los modelos.** Cada modelo (Whisper, `qwen3`, `phi3`, `llama3.2`, etc.) tiene su propia licencia y condiciones de uso, y **no son iguales entre sí**. Se están revisando y se documentan en [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md). Revisa la licencia del modelo que elijas, sobre todo si vas a usar la app con fines comerciales.

## 5. Requisitos para desarrollar (resumen)

Si quieres ejecutar el proyecto desde el código fuente necesitas, además: **Node.js 18 o superior**, **Python 3.10 a 3.14** y **FFmpeg** en el `PATH`. Los pasos completos están en el [README](../README.md).
