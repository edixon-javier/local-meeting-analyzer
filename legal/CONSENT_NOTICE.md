<!--
Texto orientativo redactado de buena fe; no constituye asesoría legal. Las secciones 1 a 3 contienen el texto EXACTO de interfaz que se implementará
en la app (cada cadena tiene un id estable). La sección 4 es material informativo, no exhaustivo.
-->

# Aviso de consentimiento de grabación — Local Meeting Analyzer

Este documento tiene dos objetivos:

1. Definir **el texto exacto en español** que la app muestra para recordar al usuario su obligación de informar a los participantes y obtener su consentimiento (secciones 1 y 2).
2. Dar al usuario **material práctico** (un guion para leer al inicio de la reunión y un mensaje corto para el chat) y una **visión general, no exhaustiva**, de por qué esto importa (secciones 3 y 4).

La app **no verifica** que el usuario haya cumplido estas obligaciones. El aviso es un recordatorio, no un sustituto del asesoramiento legal.

---

## 1. Modal de consentimiento (una sola vez, antes de la primera grabación)

### Textos

| id | Texto |
|---|---|
| `consent.modal.title` | Antes de grabar tu primera reunión |
| `consent.modal.body.p1` | Esta app graba el audio de tu micrófono y del sistema para transcribirlo y analizarlo en tu equipo. |
| `consent.modal.body.p2` | En muchos lugares la ley exige avisar a los participantes y obtener su consentimiento antes de grabar. Esa responsabilidad es tuya. |
| `consent.modal.body.p3` | Tus grabaciones y transcripciones se quedan en este equipo, salvo que elijas usar OpenAI en Ajustes. |
| `consent.modal.checkbox` | Entiendo que debo informar a los participantes y obtener su consentimiento cuando la ley lo exija |
| `consent.modal.confirm` | Entendido, continuar |
| `consent.modal.cancel` | Ahora no |
| `consent.modal.learnMore` | Más información |
| `consent.blocked.message` | Para grabar, primero debes aceptar el aviso de consentimiento. |

### Comportamiento recomendado

- Se muestra **una sola vez**: la primera vez que el usuario intenta iniciar una grabación (antes de capturar audio). No debe mostrarse al abrir la app.
- La casilla **empieza desmarcada** y el botón `consent.modal.confirm` permanece **deshabilitado** hasta que se marque.
- `consent.modal.cancel` cierra el modal sin grabar. Si el usuario intenta grabar de nuevo, se vuelve a mostrar el modal (y puede mostrarse `consent.blocked.message`).
- Guardar la aceptación **solo en local**, junto con una versión del texto (por ejemplo `consentVersion: 1`) y la fecha. Si el texto cambia de forma relevante, se incrementa la versión y se vuelve a pedir la aceptación. No se envía a ningún servidor.
- `consent.modal.learnMore` debe abrir la sección «Legal» de la app o la Política de Privacidad / este aviso.
- Accesibilidad: `role="dialog"`, `aria-modal="true"`, título enlazado con `aria-labelledby`, foco inicial en el modal, foco atrapado dentro, y la tecla Esc equivale a «Ahora no» (nunca a aceptar).
- Opcional: en Ajustes, una entrada «Ver aviso de grabación» que reabra el texto.

---

## 2. Recordatorio persistente junto al botón de grabar

Una línea corta, siempre visible junto al botón de grabar (**máximo 90 caracteres**).

| id | Texto |
|---|---|
| `consent.reminder.text` | Avisa a los participantes y pide su consentimiento antes de grabar. |
| `consent.reminder.tooltip` | La app no verifica que los participantes hayan dado su consentimiento. Es tu responsabilidad. |

Alternativas aceptables para `consent.reminder.text`:

- `Antes de grabar, informa a los participantes y obtén su consentimiento.`
- `Grabar sin avisar puede ser ilegal: informa a los participantes.`

---

## 3. Guion para el inicio de la reunión

### 3.1 Para leer en voz alta (versión estándar)

> «Buenos días a todos. Antes de empezar, les aviso que voy a grabar el audio de esta reunión. Lo haré para transcribirla y generar un resumen y las tareas acordadas con ayuda de inteligencia artificial. La grabación se guarda en mi equipo y la usaré solo para elaborar el acta de esta reunión. Si alguien prefiere no ser grabado, por favor que lo diga ahora y no grabaré. ¿Alguna objeción? Si no hay ninguna, doy inicio a la grabación.»

Variantes que se pueden añadir según el caso:

- **Si usas OpenAI:** «Para generar el resumen, el audio o el texto de la reunión se enviará al servicio de OpenAI.»
- **Si compartirás el resumen:** «Compartiré el resumen con [las personas que corresponda].»
- **Si hay participantes externos o clientes:** «Esta grabación es para uso interno y no se publicará.» (Solo si es cierto.)

### 3.2 Mensaje corto para el chat de la reunión

> Aviso: voy a grabar el audio de esta reunión para transcribirla y resumirla con IA (se guarda en mi equipo). Si no estás de acuerdo, avísame por aquí y la detengo.

Versión corta en inglés, para reuniones internacionales:

> Heads-up: I'm recording the audio of this meeting to transcribe and summarize it with AI (stored on my computer). If you object, tell me here and I'll stop.

### 3.3 Consejos prácticos

- **Avisa antes de pulsar «grabar».** Pon el aviso también en la invitación del calendario.
- **Deja constancia.** Si empiezas la grabación y lees el guion, tu aviso y las respuestas quedan registrados en el propio audio.
- **Si alguien se niega, detén la grabación** y elimina lo ya grabado si corresponde.
- **No des por supuesto que los demás se enteran.** La app captura el audio de tu equipo y las plataformas de videollamada (Teams, Zoom, Meet…) **no mostrarán su aviso de «grabando»** cuando grabas con un programa externo.
- **Ten en cuenta el contexto.** Algunas reuniones (recursos humanos, salud, asuntos legales, menores, información confidencial o sujeta a un acuerdo de confidencialidad) pueden requerir permisos adicionales.

---

## 4. Por qué importa: visión general (no exhaustiva)

> Esta sección es informativa. **No es asesoría legal** ni da conclusiones para ningún país o caso concreto. Las leyes cambian y varían según el lugar de cada participante. Ante cualquier duda, consulta a un abogado.

### 4.1 Consentimiento de una parte frente a consentimiento de todas las partes

- En algunos lugares basta con que **una de las partes** de la conversación (por ejemplo, quien graba) consienta la grabación («consentimiento de una parte»). En Estados Unidos, la normativa federal suele situarse en este modelo.
- En otros lugares se exige el consentimiento de **todas las partes**. Algunos estados de EE. UU., como **California**, siguen este modelo para conversaciones confidenciales.
- Otros países distinguen según el uso que se dé a la grabación (uso personal, prueba en un proceso, divulgación) y pueden sancionar la grabación o la difusión no autorizadas.
- **En reuniones con personas en varios lugares**, puede aplicarse la norma más estricta. Lo prudente es **avisar siempre y obtener consentimiento**.

### 4.2 Unión Europea: RGPD

- La voz y las transcripciones de una persona identificable son **datos personales**.
- Normalmente se necesita una **base legal** para tratarlos (por ejemplo, consentimiento o interés legítimo, art. 6 RGPD) y hay que ser **transparente**: informar de la finalidad, del tiempo de conservación y de los derechos de las personas (arts. 13 y 14).
- Se aplican los principios de **minimización**, **limitación de la finalidad**, **limitación del plazo de conservación** y **seguridad**.
- La excepción doméstica o personal puede no aplicarse si usas la grabación con fines profesionales o empresariales. En el ámbito laboral hay reglas específicas.
- Además del RGPD, las normas nacionales sobre grabación de conversaciones varían de un país a otro.

### 4.3 Latinoamérica: algunos ejemplos

- **Colombia, Ley 1581 de 2012:** exige, por regla general, la autorización previa, expresa e informada de la persona titular de los datos, e informarle la finalidad del tratamiento.
- **México, LFPDPPP:** gira en torno al aviso de privacidad y al consentimiento de la persona titular para el tratamiento de sus datos personales.
- Otros ejemplos de normas de protección de datos en la región: **Argentina** (Ley 25.326), **Brasil** (LGPD, Ley 13.709) y **Perú** (Ley 29.733).
- Aparte de la protección de datos, muchos países tienen **normas penales o de telecomunicaciones** sobre interceptación y grabación de comunicaciones.

### 4.4 Buenas prácticas

1. **Informa antes** de grabar y di para qué la usarás.
2. **Obtén consentimiento** de forma clara (verbal y registrado, o por escrito) y respeta si alguien se niega.
3. **Graba y conserva solo lo necesario** y bórralo cuando ya no lo necesites.
4. **Limita quién accede** a las grabaciones y transcripciones.
5. **Protege tu equipo** (BitLocker, contraseña de Windows) y tu clave de OpenAI.
6. **Piénsalo antes de usar la nube.** Con OpenAI, el audio o el texto salen de tu equipo.
7. **Respeta las reglas de tu empleador** y de la plataforma de videollamadas.

Más información sobre cómo trata la app los datos: [Política de Privacidad](PRIVACY.md).
