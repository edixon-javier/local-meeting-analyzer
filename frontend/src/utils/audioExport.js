// src/utils/audioExport.js
// Utilidades para descargar, guardar y revelar grabaciones de audio

import { getAudioDownloadUrl } from '../api'

/**
 * Descarga o guarda el archivo de audio de la reunión en el sistema del usuario.
 * Si corre en Electron, abre el diálogo nativo para guardar en la ubicación preferida.
 * Si corre en web, activa la descarga mediante enlace HTML5 con cabecera attachment.
 */
export async function downloadAudioRecording(rec, showToast) {
  if (!rec || (!rec.path && !rec.filename)) {
    showToast?.({ type: 'error', message: 'Grabación de audio no válida' })
    return false
  }

  const audioPath = rec.path || rec.filename
  const filename = rec.filename || audioPath.split(/[/\\]/).pop() || 'grabacion.wav'

  if (window.electronAPI?.saveAudioFile) {
    try {
      const saved = await window.electronAPI.saveAudioFile(filename, audioPath)
      if (saved) {
        showToast?.({ type: 'success', message: 'Audio guardado correctamente' })
        return true
      }
      return false
    } catch (err) {
      showToast?.({ type: 'error', message: `Error al guardar audio: ${err.message}` })
      return false
    }
  }

  // Fallback web / navegador estándar
  try {
    const downloadUrl = getAudioDownloadUrl(audioPath, filename)
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    showToast?.({ type: 'success', message: 'Iniciando descarga de audio...' })
    return true
  } catch (err) {
    showToast?.({ type: 'error', message: `Error al descargar audio: ${err.message}` })
    return false
  }
}

/**
 * Muestra el archivo de audio seleccionado en el Explorador de archivos del sistema operativo.
 * En Electron abre el explorador con el archivo resaltado.
 * En navegador web copia la ruta al portapapeles.
 */
export async function revealAudioRecording(rec, showToast) {
  if (!rec || (!rec.path && !rec.filename)) {
    showToast?.({ type: 'error', message: 'Grabación de audio no válida' })
    return false
  }

  const audioPath = rec.path || rec.filename

  if (window.electronAPI?.showItemInFolder) {
    try {
      const revealed = await window.electronAPI.showItemInFolder(audioPath)
      if (revealed) {
        showToast?.({ type: 'info', message: 'Mostrando archivo en el Explorador' })
        return true
      }
      showToast?.({ type: 'warning', message: 'No se encontró el archivo de audio en disco' })
      return false
    } catch (err) {
      showToast?.({ type: 'error', message: `Error al abrir carpeta: ${err.message}` })
      return false
    }
  }

  // Fallback web / navegador estándar
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(audioPath)
      showToast?.({ type: 'info', message: 'Ruta del archivo copiada al portapapeles' })
      return true
    }
  } catch {
    // ignorar fallo de clipboard
  }
  showToast?.({ type: 'info', message: 'Disponible al ejecutar en la aplicación de escritorio' })
  return false
}

/**
 * Copia la ruta local del archivo de audio al portapapeles.
 */
export async function copyAudioPath(rec, showToast) {
  const audioPath = rec?.path || rec?.filename
  if (!audioPath) return false
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(audioPath)
      showToast?.({ type: 'success', message: 'Ruta del archivo copiada al portapapeles' })
      return true
    }
  } catch {
    showToast?.({ type: 'error', message: 'No se pudo copiar la ruta' })
    return false
  }
  return false
}
