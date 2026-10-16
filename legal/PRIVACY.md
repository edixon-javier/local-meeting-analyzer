<!--
Borrador redactado de buena fe; no constituye asesoría legal. Los datos del Titular usan la identidad
pública del proyecto en GitHub. Mantén sincronizado este archivo con docs/privacy.html (versión web
publicada en https://local-meeting-analyzer.vercel.app/privacy y URL de privacidad de Microsoft Store).
-->

# Política de Privacidad de Local Meeting Analyzer

**Entrada en vigor y última actualización:** 16 de octubre de 2026

## Resumen en pocas líneas

- **Tus datos se quedan en tu equipo.** Las grabaciones, transcripciones, análisis y ajustes se guardan en tu perfil de Windows. El Titular no los recibe ni puede verlos.
- **Procesamiento local por defecto.** La transcripción (faster-whisper) y el análisis con IA (Ollama) se ejecutan en tu equipo.
- **Sin cuentas, telemetría, analítica, anuncios ni venta de datos.**
- **Solo salen datos de tu equipo si tú lo decides:** si introduces tu propia clave de un servicio de IA en la nube (OpenAI, Anthropic Claude, Google Gemini o Groq) y lo eliges como proveedor (o activas expresamente el respaldo en la nube), el audio y/o el texto correspondientes se envían a ese servicio.
- **El dictado es local por defecto.** Si eliges Groq u OpenAI para el dictado, el audio de lo que dictas se envía a ese servicio.
- **El servidor MCP es local**, pero el asistente de IA que tú conectes (por ejemplo, Claude Desktop o Cursor) puede enviar a su propio proveedor la información que le pidas consultar.
- **Hay descargas puntuales** de modelos de IA (Hugging Face y Ollama) y comprobaciones de actualización. No incluyen tu contenido.
- **Los datos no están cifrados por la App.** Te recomendamos activar BitLocker.
- **Tú eres responsable de informar a las personas a las que grabas** y de obtener su consentimiento cuando la ley lo exija.

## 1. Quién es el responsable

Local Meeting Analyzer (la «App») es publicada por **edixon-javier**, autor del proyecto (<https://github.com/edixon-javier>) (el «Titular», «nosotros»). Contacto: a través de GitHub Issues (<https://github.com/edixon-javier/local-meeting-analyzer/issues>).

La App funciona **en tu equipo**. El Titular **no recibe, no almacena y no tiene acceso** a tus grabaciones, transcripciones, análisis, nombres de participantes ni ajustes. En la práctica, respecto del contenido de tus reuniones, quien decide qué se graba, con qué finalidad y durante cuánto tiempo eres **tú**.

## 2. Qué datos trata la App y dónde se guardan

Todos los datos se guardan **localmente**, en la carpeta de tu perfil de usuario:

```
%APPDATA%\Local Meeting Analyzer\
```

En la versión de Microsoft Store (MSIX), Windows redirige esa ubicación a la carpeta privada del paquete de la App. El contenido es el mismo.

| Ubicación | Qué contiene |
|---|---|
| `recordings\` | El audio de cada grabación en formato MP3 y un archivo JSON por grabación con: la **transcripción**, el **análisis de IA** (resumen, tareas, decisiones), los segmentos con marcas de tiempo, los **marcadores** que añadas y el **mapa de hablantes**, con los nombres reales de los participantes que tú escribas. |
| `recordings\dictations\` | Por cada **dictado**: el audio, el texto reconocido y el texto final insertado, la fecha, el modo y el proveedor usados, y el **nombre del programa y el título de la ventana** donde dictaste (para que puedas buscar en tu historial de dictados). |
| `config.json` | Tus ajustes. Si las configuras, incluye tus **claves API** (OpenAI, Anthropic, Google Gemini, Groq), **guardadas localmente en texto plano**. |
| `logs\` | Registros de diagnóstico locales para ayudarte a resolver problemas. |
| Almacenamiento interno de la interfaz | Las **conversaciones del chat** (por reunión y con el historial), las reuniones **fijadas** y preferencias de la interfaz. Se guardan en tu perfil de Windows, en los datos de la propia App. |

**Datos personales de terceros.** El audio contiene la voz de las personas que participan en la reunión, y la transcripción y el mapa de hablantes pueden contener sus nombres y lo que dijeron. Son datos personales de esas personas. La asignación de hablantes («Hablante A», «Hablante B»…) se basa en el contexto de la conversación y en los nombres que tú mismo escribes; la App no pretende identificar a nadie por su voz.

**Sin cifrado.** La App no cifra estos archivos en disco. Consulta la sección «Seguridad».

## 3. Cómo se procesan tus datos

**Por defecto, todo el procesamiento es local:**

- **Transcripción:** se realiza con faster-whisper, en la CPU de tu equipo.
- **Análisis, resumen, chat y búsqueda:** se realizan con un modelo de lenguaje que ejecuta **Ollama** en tu equipo (`localhost:11434`). Ollama es un programa independiente de terceros que tú instalas; la App solo se comunica con él dentro de tu propio equipo.
- La interfaz de la App y su servicio interno se comunican entre sí mediante conexiones locales (`localhost`).

**Opcional: servicios de IA en la nube.** La App solo envía contenido a un servicio en la nube si introduces **tu propia clave API** de ese servicio **y** lo eliges en Ajustes. Según el servicio:

| Servicio | Cuándo se usa | Qué se envía |
|---|---|---|
| **OpenAI** | Lo eliges como proveedor de IA, o activas expresamente «usar la nube si el modelo local no está disponible» | El **audio** (para transcribir) y el **texto** de la reunión (resumen, tareas, chat). Con el respaldo activado, solo el texto, y solo cuando Ollama no responde. |
| **Anthropic (Claude)** | Lo eliges como proveedor de IA | Solo el **texto**: la transcripción se hace en tu equipo con faster-whisper y el texto se envía a Claude para el análisis y el chat. |
| **Google (Gemini)** | Lo eliges como proveedor de IA | El **audio** (para transcribir) y el **texto** de la reunión. |
| **Groq** | Lo eliges como motor del **dictado** | El **audio del dictado** y, si usas el modo «Ideas claras», su texto para pulirlo. No se usa para las reuniones. |

**El dictado** (insertar texto dictado en el cursor de otros programas) se transcribe **en tu equipo por defecto**. Si eliges Groq u OpenAI para el dictado y ese servicio no está disponible, la App transcribe en tu equipo: **nunca envía el contenido a un servicio distinto del que elegiste**.

Cada servicio trata los datos según **sus propios términos y su política de privacidad**, sobre los que el Titular no tiene control. Si no configuras claves ni eliges estos servicios, la App no envía tu contenido a ninguno de ellos.

**Servidor MCP (Model Context Protocol).** La App incluye un servidor MCP que se ejecuta **en tu equipo** y permite que un asistente de IA que tú configures (por ejemplo, Claude Desktop, Cursor o Antigravity) consulte tus reuniones: listas, resúmenes, transcripciones y tareas. El servidor no se conecta a Internet, pero **el asistente que lo usa puede enviar a su proveedor en la nube** la información que obtenga. Solo se activa si lo añades a la configuración de ese asistente; revisa su política de privacidad antes de hacerlo.

## 4. Conexiones de red

Estas son **todas** las conexiones a Internet que la App puede iniciar:

| | Conexión | Cuándo | Qué se envía |
|---|---|---|---|
| a | **Descarga de modelos:** modelos de voz Whisper desde **Hugging Face**; modelos de lenguaje desde **ollama.com** (los descarga Ollama) | La primera vez que usas un modelo, o cuando pides descargarlo | Ningún dato tuyo. Solo los metadatos habituales de cualquier petición web (por ejemplo, tu dirección IP). |
| b | **OpenAI, Anthropic (Claude), Google (Gemini) o Groq** | Solo si introduces tu clave API de ese servicio **y** lo eliges en Ajustes (o activas el respaldo en la nube con OpenAI) | Lo indicado en la tabla de la sección 3, bajo los términos y la política de privacidad de cada servicio |
| c | **Comprobación de actualizaciones** | Versión de GitHub: la App consulta GitHub Releases. Versión de Microsoft Store: actualiza Microsoft Store, no la App | Metadatos habituales de la petición (por ejemplo, tu IP y la versión instalada). Con Microsoft Store, aplican las políticas de Microsoft. |
| d | **«Reportar problema»** | Solo cuando pulsas ese botón | **La App no envía nada automáticamente.** Abre tu navegador o tu cliente de correo con un informe prellenado, y tú decides si lo envías y si adjuntas registros (logs). |

Cualquier otra comunicación de la App ocurre dentro de tu propio equipo (`localhost`).

## 5. Qué no recopilamos

- **No hay telemetría ni analítica** de uso, ni informes de fallos automáticos.
- **No hay cuentas de usuario** ni registro.
- **No hay publicidad** ni rastreadores.
- **No vendemos ni compartimos datos**, porque no los recibimos.
- Las tipografías están incluidas en la App; no se consultan servicios externos de fuentes (por ejemplo, Google Fonts).

## 6. Terceros

La App puede interactuar con los siguientes terceros, cada uno con sus propias condiciones y políticas de privacidad:

- **OpenAI** (opcional, solo con tu clave API): <https://openai.com/policies/>
- **Anthropic** (Claude; opcional, solo con tu clave API): <https://www.anthropic.com/legal/privacy>
- **Google** (Gemini; opcional, solo con tu clave API): <https://policies.google.com/privacy>
- **Groq** (dictado; opcional, solo con tu clave API): <https://groq.com/privacy-policy/>
- **Hugging Face** (descarga de modelos de voz): <https://huggingface.co/privacy>
- **Ollama** (programa local de IA y descarga de modelos de lenguaje desde ollama.com): <https://ollama.com>
- **GitHub** (versión descargada de GitHub Releases y comprobación de actualizaciones): <https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement>
- **Microsoft** (distribución y actualización a través de Microsoft Store): <https://privacy.microsoft.com/privacystatement>

El Titular no controla las prácticas de estos terceros. Los modelos de IA que descargas tienen además sus propias licencias; consulta `THIRD_PARTY_NOTICES.md`.

## 7. Conservación y eliminación

La App conserva tus datos **hasta que tú los elimines**. No hay borrado automático ni copia en servidores del Titular.

- **Eliminar una grabación:** desde la pantalla **Historial**, borra la grabación. Se eliminan su audio y su archivo JSON (es un borrado normal de archivos de Windows, no un borrado seguro).
- **Eliminar un dictado:** desde el **historial de dictados** de la App; se eliminan su audio y su archivo JSON.
- **Eliminar tus claves API:** quítalas en Ajustes o borra `config.json`.
- **Eliminar conversaciones del chat:** bórralas desde la lista de conversaciones del chat; también se eliminan al desinstalar la App.
- **Eliminar todo:** desinstala la App y borra la carpeta `%APPDATA%\Local Meeting Analyzer\`. En la versión de Microsoft Store, Windows suele eliminar también los datos privados del paquete al desinstalar; si quieres asegurarte, borra antes tus grabaciones desde el Historial y comprueba que la carpeta ya no exista.
- **Datos enviados a servicios en la nube:** borrarlos en tu equipo no los elimina de OpenAI, Anthropic, Google o Groq. Su conservación se rige por los términos de cada servicio; consúltalos o contacta con ellos.
- **Copias de seguridad:** si copiaste archivos a otros lugares (nube, discos externos, correo), debes eliminarlos allí por tu cuenta.

## 8. Seguridad

- Los datos se guardan **solo en tu equipo y sin cifrar** por la App. Cualquier persona o programa con acceso a tu cuenta de Windows o a tu disco podría leerlos.
- **Recomendamos activar BitLocker** (o el cifrado de dispositivo de Windows), usar una contraseña de Windows robusta y bloquear la sesión cuando te ausentes.
- Tus claves API se guardan en texto plano en `config.json`. No compartas esa carpeta ni subas ese archivo a repositorios, correos o servicios en la nube. Si crees que alguna se expuso, revócala desde tu cuenta en ese servicio.
- Antes de adjuntar registros (`logs\`) a un reporte, revísalos: pueden contener información técnica de tu equipo, como rutas o nombres de archivo.
- Comparte las grabaciones y transcripciones solo con quienes corresponda.

## 9. Tu responsabilidad al grabar a otras personas

Grabar audio y tratar los datos de otras personas puede estar regulado por leyes sobre grabación de comunicaciones, protección de datos, relaciones laborales y confidencialidad. **Eres el único responsable de informar a los participantes y de obtener su consentimiento cuando la ley lo exija**, y de cumplir las normas de tu país, de tu empleador y de la plataforma de videollamadas que uses. La App te muestra un recordatorio, pero no verifica que hayas cumplido esas obligaciones. Consulta `legal/CONSENT_NOTICE.md` para ver un aviso orientativo y un guion de ejemplo.

Si usas la App con fines profesionales o empresariales, es posible que tú (o tu organización) seas el responsable del tratamiento de los datos de los participantes y tengas obligaciones propias de transparencia, base legal, conservación y seguridad.

## 10. Menores de edad

La App no está dirigida a menores de 13 años (o a la edad mínima aplicable en tu país), no tiene cuentas y no recopila datos de menores de forma intencionada. Si grabas a menores, por ejemplo en un contexto educativo, necesitas la autorización de sus padres o tutores cuando la ley lo exija.

## 11. Tus derechos

Como los datos **nunca llegan al Titular**, los controlas tú directamente y en todo momento:

- **Acceso:** puedes abrir la carpeta `%APPDATA%\Local Meeting Analyzer\` y ver todo lo que la App guarda. Los archivos usan formatos abiertos (MP3 y JSON).
- **Rectificación:** puedes corregir los nombres de los hablantes y editar el contenido desde la App.
- **Eliminación:** puedes borrar grabaciones desde el Historial o borrar toda la carpeta (véase la sección 7).
- **Portabilidad:** puedes copiar tus archivos o exportar el acta de una reunión.
- **Oposición y limitación:** puedes dejar de usar la App, desactivar los servicios en la nube o desinstalarla en cualquier momento.

**Si eres un participante grabado por otra persona** y quieres ejercer tus derechos sobre tu voz o tus datos, debes dirigirte a **quien realizó la grabación**, que es quien la tiene y la controla. El Titular no tiene acceso a esos datos y no puede localizarlos, modificarlos ni borrarlos.

**Marco normativo.** Esta política busca ser compatible con los principios generales del **Reglamento General de Protección de Datos de la UE (RGPD)** (licitud, transparencia, minimización, limitación de la finalidad y del plazo de conservación, e integridad y confidencialidad) y con leyes de protección de datos de Latinoamérica, como la **Ley 1581 de 2012 de Colombia** y la **Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) de México**. Esto es una declaración de intención y no una certificación ni una garantía de cumplimiento en todas las jurisdicciones.

## 12. Cambios en esta política

Podemos actualizar esta política, por ejemplo si cambian las funciones de la App. Publicaremos la nueva versión con su fecha de entrada en vigor en el repositorio del proyecto y, cuando el cambio sea relevante, en las notas de la versión. Te recomendamos revisarla de vez en cuando. Si continúas usando la App después de la fecha de entrada en vigor, se entenderá que conoces la nueva versión.

## 13. Contacto

Para preguntas sobre esta política: abre una consulta en GitHub Issues (<https://github.com/edixon-javier/local-meeting-analyzer/issues>).
Repositorio del proyecto: **<https://github.com/edixon-javier/local-meeting-analyzer>**.
