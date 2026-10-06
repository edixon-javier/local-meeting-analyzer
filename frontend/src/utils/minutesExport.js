// src/utils/minutesExport.js
// Generador y exportador de Minutas Ejecutivas en Markdown, Rich HTML y PDF

export const formatTime = (seconds) => {
  if (seconds === undefined || seconds === null) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function generateExecutiveMarkdown({
  title = 'Reunión',
  date = '',
  category = 'General',
  tone = 'Profesional',
  durationInsight = '',
  summary = [],
  keyDecisions = [],
  actionItems = [],
  segments = [],
  transcript = '',
  bookmarks = []
}) {
  let md = `# 📋 Minuta Ejecutiva: ${title}\n\n`
  
  if (date) {
    md += `**Fecha:** ${date}  \n`
  }
  md += `**Categoría:** ${category || 'Sin categoría'} | **Tono:** ${tone || 'Neutro'}  \n`
  if (durationInsight) {
    md += `**Observación:** ${durationInsight}  \n`
  }
  md += `\n---\n\n`

  md += `## 📌 Resumen Ejecutivo\n`
  if (summary && summary.length > 0) {
    summary.forEach(point => {
      md += `- ${point}\n`
    })
  } else {
    md += `*Sin puntos de resumen disponibles.*\n`
  }
  md += `\n`

  if (bookmarks && bookmarks.length > 0) {
    md += `## 🔖 Momentos Clave Marcados\n`
    bookmarks.forEach(bm => {
      const timeStr = formatTime(bm.time)
      const noteStr = bm.note ? ` - ${bm.note}` : ''
      md += `- **[${timeStr}]**${noteStr}\n`
    })
    md += `\n`
  }

  md += `## 🎯 Decisiones Clave\n`
  if (keyDecisions && keyDecisions.length > 0) {
    keyDecisions.forEach(d => {
      md += `- ${d}\n`
    })
  } else {
    md += `*No se registraron decisiones específicas.*\n`
  }
  md += `\n`

  md += `## ✅ Tareas y Compromisos\n`
  if (actionItems && actionItems.length > 0) {
    md += `| Estado | Tarea | Responsable | Fecha Límite |\n`
    md += `| :---: | :--- | :--- | :--- |\n`
    actionItems.forEach(item => {
      const task = item.task || 'Tarea pendiente'
      const assignee = item.assignee || 'Sin asignar'
      const deadline = item.deadline || 'Sin fecha'
      const statusBox = item.completed ? '[x]' : '[ ]'
      const taskDisplay = item.completed ? `~~${task}~~` : task
      md += `| ${statusBox} | ${taskDisplay} | **${assignee}** | ${deadline} |\n`
    })
  } else {
    md += `*No se identificaron tareas pendientes.*\n`
  }
  md += `\n`

  md += `## 📝 Transcripción Completa\n`
  if (segments && segments.length > 0) {
    segments.forEach(seg => {
      const spk = seg.speaker || 'Hablante'
      const time = `[${formatTime(seg.start)} - ${formatTime(seg.end)}]`
      md += `**${time} ${spk}:** ${seg.text}\n\n`
    })
  } else if (transcript) {
    md += `${transcript}\n`
  } else {
    md += `*Sin transcripción disponible.*\n`
  }

  return md
}

export function generateExecutiveHtml({
  title = 'Reunión',
  date = '',
  category = 'General',
  tone = 'Profesional',
  durationInsight = '',
  summary = [],
  keyDecisions = [],
  actionItems = [],
  segments = [],
  transcript = '',
  bookmarks = []
}) {
  const summaryList = (summary && summary.length > 0)
    ? summary.map(s => `<li style="margin-bottom: 6px;">${s}</li>`).join('')
    : '<li><em>Sin resumen disponible.</em></li>'

  const bookmarksSection = (bookmarks && bookmarks.length > 0)
    ? `
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 18px; color: #b45309; border-bottom: 1px solid #fef3c7; padding-bottom: 6px; margin-bottom: 12px;">🔖 Momentos Clave Marcados (${bookmarks.length})</h2>
        <ul style="padding-left: 20px; color: #1e293b; font-size: 14px;">
          ${bookmarks.map(bm => `<li style="margin-bottom: 6px;"><strong style="color: #b45309; font-family: monospace;">[${formatTime(bm.time)}]</strong> ${bm.note || 'Momento clave marcado'}</li>`).join('')}
        </ul>
      </div>
    `
    : ''

  const decisionsList = (keyDecisions && keyDecisions.length > 0)
    ? keyDecisions.map(d => `<li style="margin-bottom: 6px;">${d}</li>`).join('')
    : '<li><em>No se registraron decisiones específicas.</em></li>'

  const taskRows = (actionItems && actionItems.length > 0)
    ? actionItems.map(item => `
        <tr style="border-bottom: 1px solid #e2e8f0; ${item.completed ? 'background: #f8fafc;' : ''}">
          <td style="padding: 10px; text-align: center; font-size: 15px;">${item.completed ? '✅' : '⬜'}</td>
          <td style="padding: 10px; font-weight: 500; color: ${item.completed ? '#64748b' : '#1e293b'}; ${item.completed ? 'text-decoration: line-through;' : ''}">${item.task || ''}</td>
          <td style="padding: 10px;"><span style="background: ${item.completed ? '#f1f5f9' : '#e0e7ff'}; color: ${item.completed ? '#64748b' : '#3730a3'}; padding: 3px 8px; border-radius: 9999px; font-size: 12px; font-weight: 600;">${item.assignee || 'Sin asignar'}</span></td>
          <td style="padding: 10px; color: #64748b; font-size: 13px;">${item.deadline || 'Sin fecha'}</td>
        </tr>
      `).join('')
    : `<tr><td colspan="4" style="padding: 12px; text-align: center; color: #64748b;"><em>No se identificaron tareas pendientes.</em></td></tr>`

  const transcriptContent = (segments && segments.length > 0)
    ? segments.map(seg => `
        <div style="margin-bottom: 12px; padding: 8px 12px; background: #f8fafc; border-left: 3px solid #6366f1; border-radius: 4px;">
          <div style="font-size: 12px; color: #475569; margin-bottom: 4px;">
            <strong style="color: #4338ca;">👥 ${seg.speaker || 'Hablante'}</strong> &nbsp;
            <span style="color: #94a3b8;">⏱️ ${formatTime(seg.start)} - ${formatTime(seg.end)}</span>
          </div>
          <p style="margin: 0; color: #1e293b; font-size: 13px; line-height: 1.5;">${seg.text}</p>
        </div>
      `).join('')
    : `<pre style="white-space: pre-wrap; font-family: inherit; font-size: 13px; color: #334155;">${transcript || 'Sin transcripción disponible.'}</pre>`

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 800px; margin: 0 auto; color: #0f172a; line-height: 1.6;">
      <div style="border-bottom: 2px solid #6366f1; padding-bottom: 16px; margin-bottom: 24px;">
        <h1 style="font-size: 24px; margin: 0 0 8px 0; color: #1e1b4b;">📋 Minuta Ejecutiva: ${title}</h1>
        <div style="font-size: 13px; color: #475569; display: flex; gap: 12px; flex-wrap: wrap;">
          ${date ? `<span>📅 <strong>Fecha:</strong> ${date}</span> &bull;` : ''}
          <span>🏷️ <strong>Categoría:</strong> ${category || 'General'}</span> &bull;
          <span>🎭 <strong>Tono:</strong> ${tone || 'Neutro'}</span>
        </div>
        ${durationInsight ? `<p style="margin: 8px 0 0; font-size: 13px; color: #64748b; font-style: italic;">💡 ${durationInsight}</p>` : ''}
      </div>

      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 18px; color: #312e81; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px;">📌 Resumen Ejecutivo</h2>
        <ul style="padding-left: 20px; color: #1e293b; font-size: 14px;">
          ${summaryList}
        </ul>
      </div>

      ${bookmarksSection}

      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 18px; color: #312e81; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px;">🎯 Decisiones Clave</h2>
        <ul style="padding-left: 20px; color: #1e293b; font-size: 14px;">
          ${decisionsList}
        </ul>
      </div>

      <div style="margin-bottom: 28px;">
        <h2 style="font-size: 18px; color: #312e81; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px;">✅ Tareas y Compromisos</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
          <thead>
            <tr style="background: #f1f5f9; color: #475569; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
              <th style="padding: 10px; text-align: center; width: 40px;">OK</th>
              <th style="padding: 10px;">Tarea</th>
              <th style="padding: 10px; width: 140px;">Responsable</th>
              <th style="padding: 10px; width: 120px;">Fecha Límite</th>
            </tr>
          </thead>
          <tbody>
            ${taskRows}
          </tbody>
        </table>
      </div>

      <div style="margin-top: 32px;">
        <h2 style="font-size: 18px; color: #312e81; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 16px;">📝 Transcripción Completa</h2>
        <div style="margin-top: 12px;">
          ${transcriptContent}
        </div>
      </div>
    </div>
  `
}

export async function copyExecutiveMinutes(data, showToast) {
  const md = generateExecutiveMarkdown(data)
  const html = generateExecutiveHtml(data)

  try {
    if (navigator.clipboard && window.ClipboardItem) {
      const textBlob = new Blob([md], { type: 'text/plain' })
      const htmlBlob = new Blob([html], { type: 'text/html' })
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': textBlob,
          'text/html': htmlBlob,
        })
      ])
    } else {
      await navigator.clipboard.writeText(md)
    }
    showToast?.({ 
      type: 'success', 
      message: '📋 Minuta copiada al portapapeles (lista para Slack/Email)' 
    })
    return true
  } catch (err) {
    try {
      await navigator.clipboard.writeText(md)
      showToast?.({ 
        type: 'success', 
        message: '📋 Minuta en Markdown copiada al portapapeles' 
      })
      return true
    } catch (fallbackErr) {
      showToast?.({ 
        type: 'error', 
        message: 'Error al copiar al portapapeles: ' + (fallbackErr.message || err.message) 
      })
      return false
    }
  }
}

export function downloadExecutiveMarkdown(data, filename, showToast) {
  try {
    const md = generateExecutiveMarkdown(data)
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const safeTitle = (filename || data.title || 'minuta')
      .replace(/[^\w\d\-_.]/g, '_')
      .replace(/_{2,}/g, '_')
    a.download = `minuta_ejecutiva_${safeTitle}.md`
    a.href = url
    a.click()
    URL.revokeObjectURL(url)
    showToast?.({ type: 'success', message: '📥 Archivo Markdown (.md) descargado' })
    return true
  } catch (err) {
    showToast?.({ type: 'error', message: 'Error al descargar Markdown: ' + err.message })
    return false
  }
}

export async function exportExecutivePdf(data, filename, showToast) {
  const safeTitle = (filename || data.title || 'minuta')
    .replace(/[^\w\d\-_.]/g, '_')
    .replace(/_{2,}/g, '_')
  const defaultFilename = `minuta_ejecutiva_${safeTitle}.pdf`

  if (window.electronAPI?.exportPDF) {
    try {
      const success = await window.electronAPI.exportPDF(defaultFilename)
      if (success) {
        showToast?.({ type: 'success', message: '📥 PDF exportado correctamente' })
        return true
      } else {
        showToast?.({ type: 'info', message: 'Exportación a PDF cancelada' })
        return false
      }
    } catch (err) {
      showToast?.({ type: 'error', message: 'Error al exportar PDF: ' + err.message })
      return false
    }
  } else {
    // Fallback estándar en navegador o cuando no está disponible la API nativa de Electron
    try {
      showToast?.({ 
        type: 'info', 
        message: '🖨️ Abriendo diálogo de impresión (selecciona "Guardar como PDF")' 
      })
      setTimeout(() => {
        window.print()
      }, 250)
      return true
    } catch (err) {
      showToast?.({ type: 'error', message: 'Error al iniciar impresión PDF: ' + err.message })
      return false
    }
  }
}
