# Soporte — Local Meeting Analyzer

Cómo pedir ayuda, qué información incluir y dónde están los registros de la aplicación.

> **Nada se envía automáticamente.** La aplicación no recopila telemetría ni informes de fallos: los registros se
> guardan solo en tu equipo y tú decides si los compartes.

## 1. Canales de soporte

| Canal | Para qué | Dónde |
|---|---|---|
| **GitHub Issues** (principal, gratuito) | Errores, dudas de uso y sugerencias | `https://github.com/edixon-javier/local-meeting-analyzer/issues` |
| **Correo** (secundario) | Si no tienes cuenta de GitHub o el asunto es sensible | `[CORREO DE SOPORTE]` |
| **Discord** (opcional, más adelante) | Comunidad y consultas rápidas | Aún no disponible |

Desde la aplicación, **Ajustes > Ayuda y soporte > Reportar problema** abre el canal disponible con la versión y el
sistema ya completados: un nuevo issue de GitHub o, si el repositorio no está configurado, un correo.

El soporte es de mejor esfuerzo y sin plazos garantizados.

## 2. Qué incluir en un reporte

1. **Qué pasó** y **qué esperabas que pasara**.
2. **Pasos para reproducirlo** (numerados).
3. **Versión de la aplicación** y **sistema** (Windows 10/11). Si usas el botón *Reportar problema* ya vienen puestos.
4. Cómo la instalaste: instalador `.exe` (GitHub) o Microsoft Store.
5. **El diagnóstico** (ver §4), pegado en el reporte.
6. Qué motor usabas: local (Ollama + Whisper) u OpenAI, y el modelo.

**No incluyas**: transcripciones, audios, claves de API ni datos de tus reuniones. El diagnóstico no los contiene,
pero revísalo antes de publicarlo: es un texto público si lo pegas en GitHub.

## 3. Dónde están los registros

La aplicación guarda dos archivos con rotación automática (1 MB; se conservan los anteriores):

| Archivo | Contenido |
|---|---|
| `main.log` (+ `main.log.old`) | Proceso principal de Electron, salida del backend al arrancar y errores/avisos de la interfaz |
| `backend.log` (+ `backend.log.1` … `.5`) | Motor local (FastAPI): arranque, modelos, errores del análisis y de la transcripción |

Ubicación:

| Instalación | Carpeta de registros |
|---|---|
| Instalador `.exe` (NSIS) | `%APPDATA%\Local Meeting Analyzer\logs` |
| Microsoft Store (MSIX) | Windows la redirige a `%LOCALAPPDATA%\Packages\<nombre del paquete>\LocalCache\Roaming\Local Meeting Analyzer\logs` |
| Desarrollo (`npm run dev`) | `main.log` en `%APPDATA%\local-meeting-analyzer\logs` y `backend.log` en `backend\logs` |

Lo más cómodo es **Ajustes > Ayuda y soporte > Abrir carpeta de registros**, que abre la carpeta correcta en cada caso.

Las claves de API (`sk-…`) se enmascaran como `sk-***` antes de escribirse en los registros, y nunca se registra el
texto de las transcripciones.

## 4. Cómo copiar el diagnóstico

1. Abre **Ajustes > Ayuda y soporte**.
2. Pulsa **Copiar diagnóstico**. Se copia al portapapeles un texto con:
   - versión de la aplicación, Electron, Chrome y Node; versión de Windows y arquitectura;
   - memoria RAM total y libre;
   - el estado del motor local (`/status`);
   - las últimas 150 líneas de `main.log` y de `backend.log`.
3. Pégalo (Ctrl+V) en el reporte. Si la aplicación no abre, copia esos mismos archivos desde la carpeta de registros.

Las rutas del diagnóstico sustituyen tu nombre de usuario de Windows por `%USERPROFILE%`.

Si el motor local no responde (pantalla "Servidor Desconectado"), **Ajustes** sigue mostrando la sección de soporte para
que puedas copiar el diagnóstico igualmente.

## 5. Problemas frecuentes

- **"El modelo local no está disponible."** Ollama no está en ejecución. Ábrelo (o ejecuta `ollama serve`) y comprueba
  que el modelo está descargado (`ollama pull qwen3:4b`). La nube solo se usa si lo activas en
  *Ajustes > Privacidad*.
- **La primera transcripción tarda.** Whisper descarga su modelo la primera vez (se hace una sola vez).
- **El asistente de bienvenida no aparece.** Puedes abrirlo en *Ajustes > Ayuda y soporte > Ver bienvenida de nuevo*.

Más información: [requisitos](REQUISITOS.md), [distribución](DISTRIBUCION.md) y [política de privacidad](../legal/PRIVACY.md).
