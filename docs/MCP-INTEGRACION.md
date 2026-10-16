# Integración con Model Context Protocol (MCP)

Local Meeting Analyzer incluye un servidor nativo **Model Context Protocol (MCP)** que permite a modelos y agentes de IA (como Claude Desktop, Cursor, Antigravity, VS Code, etc.) acceder de manera controlada y 100% privada a los datos de tus reuniones.

---

## 🔒 Privacidad y Arquitectura

- **Local y seguro:** El servidor MCP lee directamente los archivos JSON y grabaciones almacenados en tu equipo (`recordings/`).
- **Sin conexión requerida:** Funciona en modo `stdio` de manera offline, incluso cuando la aplicación de escritorio está cerrada.
- **Solo lectura de grabaciones:** Tus archivos originales permanecen inalterados.

---

## 🛠️ Herramientas (Tools) Disponibles

| Herramienta | Descripción | Argumentos |
|---|---|---|
| `list_meetings` | Lista todas las reuniones con fecha, tamaño, duración estimada, categoría, tono y resumen previo. | Ninguno |
| `get_meeting_summary` | Obtiene el resumen ejecutivo estructurado, acuerdos, tareas y notas de una reunión. | `meeting_identifier` (nombre de archivo `.wav` o `.json`, o ruta) |
| `get_meeting_transcript` | Obtiene la transcripción completa y opcionalmente los segmentos de diálogo por hablante con marcas de tiempo. | `meeting_identifier`, `include_segments` (bool) |
| `get_all_action_items` | Extrae y consolida todas las tareas y compromisos pendientes entre todas las reuniones del historial. | `filter_completed` (opcional: True/False/None) |
| `search_meetings` | Búsqueda semántica y por palabras clave en transcripciones y resúmenes de todo el historial. | `query` (str), `max_results` (int, defecto: 5) |

---

## 📄 Recursos (Resources) Disponibles

- `meeting://summary/{filename}` — Minuta ejecutiva formateada en Markdown.
- `meeting://transcript/{filename}` — Transcripción textual completa de la reunión.

---

## ⚙️ Configuración en Clientes de IA

### Con la aplicación instalada (recomendado)

No necesitas Python: el ejecutable del backend incluye el servidor MCP (`meeting-backend.exe --mcp`).

1. Abre la app → **Configuración → Asistentes de IA (MCP)**.
2. Pulsa **Copiar configuración**. El bloque ya trae la ruta exacta de tu instalación y la carpeta de datos, por ejemplo:

```json
{
  "mcpServers": {
    "local-meeting-analyzer": {
      "command": "C:\\Users\\TU_USUARIO\\AppData\\Local\\Programs\\Local Meeting Analyzer\\resources\\backend\\meeting-backend.exe",
      "args": ["--mcp"],
      "env": { "MEETING_ANALYZER_DATA_DIR": "C:\\Users\\TU_USUARIO\\AppData\\Roaming\\Local Meeting Analyzer" }
    }
  }
}
```

3. Pégalo en la configuración de tu asistente y reinícialo:
   - **Claude Desktop (Windows):** `%APPDATA%\Claude\claude_desktop_config.json`
   - **Cursor / Antigravity / VS Code:** su archivo de configuración MCP (`mcpServers`).

> **Privacidad:** el servidor MCP solo funciona en tu equipo, pero el asistente que lo usa puede enviar a su
> proveedor en la nube la información que consulte.

### Desde el código fuente (desarrollo)

### 1. Claude Desktop

Abre tu archivo de configuración de Claude Desktop:
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Agrega el servidor dentro de `mcpServers` (también puedes usar `main.py --mcp` en lugar de `mcp_server.py`):

```json
{
  "mcpServers": {
    "meeting-analyzer": {
      "command": "F:\\Proyectos\\Extension-reuniones\\backend\\venv\\Scripts\\python.exe",
      "args": [
        "F:\\Proyectos\\Extension-reuniones\\backend\\mcp_server.py"
      ]
    }
  }
}
```

> **Nota:** Ajusta la ruta a tu entorno de Python y la ubicación del repositorio en tu equipo.

### 2. Antigravity / Cursor / VS Code

En la sección de configuración de MCP (`mcp_servers` o `cursor.json`):

```json
{
  "mcpServers": {
    "meeting-analyzer": {
      "command": "python",
      "args": ["backend/mcp_server.py"]
    }
  }
}
```

---

## 🎧 Gestión y Exportación de Audios

La aplicación permite descargar y compartir los archivos de audio de las reuniones directamente desde la interfaz:

1. **Mostrar en carpeta (Explorador de Windows):**
   - Hace clic en el botón de carpeta en la tarjeta del Historial o en el reproductor de la reunión.
   - Abre el Explorador de Windows con el archivo seleccionado para arrastrarlo a Slack, Teams, WhatsApp o adjuntarlo por correo.
2. **Descargar audio:**
   - Permite guardar una copia del archivo `.wav` o `.mp3` en cualquier carpeta del sistema (Descargas, Documentos, etc.) mediante el diálogo de guardado nativo.
