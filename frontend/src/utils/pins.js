// src/utils/pins.js
// Grabaciones fijadas (acceso rápido). Se guardan en localStorage como un array de nombres de archivo.
// Todo acceso al almacenamiento va en try/catch: puede lanzar (modo privado, datos bloqueados) o venir corrupto.

export const PINS_KEY = 'pinned_recordings_v1'

// Normaliza cualquier valor a un array de strings únicos y no vacíos
function sanitize(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((f) => typeof f === 'string' && f))]
}

export function loadPins() {
  try {
    const raw = localStorage.getItem(PINS_KEY)
    return raw ? sanitize(JSON.parse(raw)) : []
  } catch {
    return []
  }
}

export function savePins(pins) {
  try {
    localStorage.setItem(PINS_KEY, JSON.stringify(sanitize(pins)))
    return true
  } catch {
    return false
  }
}

// Devuelve una lista nueva: añade el archivo (al principio) si no estaba, o lo quita si estaba
export function togglePin(pins, filename) {
  if (!filename) return sanitize(pins)
  const list = sanitize(pins)
  return list.includes(filename)
    ? list.filter((f) => f !== filename)
    : [filename, ...list]
}

// Migra una fijada al renombrar la grabación, conservando su posición
export function renamePin(pins, oldFilename, newFilename) {
  const list = sanitize(pins)
  if (!oldFilename || !newFilename || !list.includes(oldFilename)) return list
  return sanitize(list.map((f) => (f === oldFilename ? newFilename : f)))
}

export function removePin(pins, filename) {
  return sanitize(pins).filter((f) => f !== filename)
}
