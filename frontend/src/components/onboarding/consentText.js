// src/components/onboarding/consentText.js
// Textos EXACTOS de legal/CONSENT_NOTICE.md (cada cadena conserva su id estable).

export const CONSENT_TEXT = {
  'consent.modal.title': 'Antes de grabar tu primera reunión',
  'consent.modal.body.p1': 'Esta app graba el audio de tu micrófono y del sistema para transcribirlo y analizarlo en tu equipo.',
  'consent.modal.body.p2': 'En muchos lugares la ley exige avisar a los participantes y obtener su consentimiento antes de grabar. Esa responsabilidad es tuya.',
  'consent.modal.body.p3': 'Tus grabaciones y transcripciones se quedan en este equipo, salvo que elijas un servicio en la nube (OpenAI, Claude o Gemini) en Ajustes.',
  'consent.modal.checkbox': 'Entiendo que debo informar a los participantes y obtener su consentimiento cuando la ley lo exija',
  'consent.modal.confirm': 'Entendido, continuar',
  'consent.modal.cancel': 'Ahora no',
  'consent.modal.learnMore': 'Más información',
  'consent.blocked.message': 'Para grabar, primero debes aceptar el aviso de consentimiento.',
  'consent.reminder.text': 'Avisa a los participantes y pide su consentimiento antes de grabar.',
  'consent.reminder.tooltip': 'La app no verifica que los participantes hayan dado su consentimiento. Es tu responsabilidad.',
}

// Material práctico de la sección 3 del aviso (se muestra en «Más información»).
export const CONSENT_SCRIPT =
  'Buenos días a todos. Antes de empezar, les aviso que voy a grabar el audio de esta reunión. ' +
  'Lo haré para transcribirla y generar un resumen y las tareas acordadas con ayuda de inteligencia artificial. ' +
  'La grabación se guarda en mi equipo y la usaré solo para elaborar el acta de esta reunión. ' +
  'Si alguien prefiere no ser grabado, por favor que lo diga ahora y no grabaré. ' +
  '¿Alguna objeción? Si no hay ninguna, doy inicio a la grabación.'

export const CONSENT_TIPS = [
  'Avisa antes de pulsar «grabar» y, si puedes, ponlo también en la invitación del calendario.',
  'Si alguien se niega, detén la grabación y elimina lo ya grabado si corresponde.',
  'Las plataformas de videollamada (Teams, Zoom, Meet…) no mostrarán su aviso de «grabando» cuando grabas con un programa externo.',
  'Algunas reuniones (recursos humanos, salud, asuntos legales, menores o información confidencial) pueden requerir permisos adicionales.',
]

export const t = (id) => CONSENT_TEXT[id]
