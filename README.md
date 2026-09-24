# Meeting Analyzer

Meeting Analyzer es una aplicación de escritorio **Híbrida (Privacidad-Primero)** que graba el audio del sistema o micrófono, lo transcribe y lo analiza mediante Inteligencia Artificial.

Concebida para capturar el valor de tus reuniones sin comprometer tu privacidad, realiza la transcripción y el análisis **100% de manera local** por defecto usando Whisper y Ollama (Phi-3). Opcionalmente, permite delegar el procesamiento a modelos en la nube (OpenAI GPT-4o) para mayor velocidad y precisión.

## ✨ Características

- 🎙️ **Grabación Nativa de Audio**: Captura el audio del sistema operativo (loopback en Windows) o de tu micrófono.
- 📝 **Transcripción Local Inteligente**: Utiliza modelos locales de Whisper (tiny, base, small) integrados.
- ⚡ **Transcripción en Vivo**: Visualiza la transcripción en tiempo real palabra por palabra.
- 🧠 **Análisis Híbrido Estructurado**: Extrae el resumen, tareas, decisiones, tono y categorías de la reunión usando Ollama (Local) o OpenAI (Cloud).
- 👥 **Diarización Textual**: Reconoce a los diferentes hablantes (Hablante A, B) basándose en el contexto del diálogo.
- 💬 **Asistente de Chat RAG**: Chatea de forma interactiva con el contenido de una reunión o realiza búsquedas semánticas sobre *todo tu historial* de reuniones.
- 🛡️ **Privacidad Primero**: Tus datos, grabaciones y metadatos se guardan localmente. Sin suscripciones forzadas ni subida de audios de fondo.
- 🎨 **Interfaz Moderna (UI/UX)**: Diseño premium en Dark Mode (Slate/Indigo) con animaciones fluidas construido sobre Electron y React.

## 🚀 Arquitectura

El proyecto se divide en dos grandes piezas:
- **Backend (Python + FastAPI)**: Responsable de la captura de audio en streaming (evitando desbordamientos de memoria - OOM), orquestación de modelos Whisper, comunicación con Ollama/OpenAI y almacenamiento local de metadatos (JSON) y audios (WAV/MP3).
- **Frontend (Electron + React + Vite)**: Aplicación nativa de escritorio sin bordes, que se comunica con el backend mediante una capa robusta de peticiones HTTP y Server-Sent Events (SSE) para actualizaciones en vivo de estado, transcripción y salud del motor de IA.

## 📦 Requisitos Previos

Asegúrate de tener instalados los siguientes componentes antes de iniciar:

- **Node.js**: v18 o superior.
- **Python**: 3.10 a 3.14.
- **FFmpeg**: Configurado y accesible en el `PATH` del sistema.
- **Ollama** (Opcional pero recomendado para procesamiento local): [Descargar Ollama](https://ollama.com/) y tener instalado el modelo `phi3` (`ollama run phi3`).

## 🛠️ Instalación y Uso

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/tu-usuario/meeting-analyzer.git
   cd meeting-analyzer
   ```

2. **Inicio Rápido (Windows)**
   Simplemente haz doble clic en el archivo `start.bat`. Este script instalará automáticamente las dependencias de Python y Node.js si faltan, y levantará tanto el backend como la aplicación de Electron.

   *Alternativamente, para inicializar el entorno de desarrollo:*
   ```bash
   npm run setup
   npm run dev
   ```

3. **Ejecución Manual**
   Si prefieres levantar los servicios de forma manual en terminales separadas:
   
   **Backend:**
   ```bash
   cd backend
   python -m venv venv
   venv\Scripts\activate
   pip install -r requirements.txt
   python main.py
   ```
   
   **Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## ⚙️ Variables de Entorno y Configuración

El proyecto gestiona sus configuraciones a través de la UI (Pantalla de Ajustes), la cual persiste las opciones en el archivo `backend/config.json`.
Si deseas forzar el puerto del backend, puedes crear un archivo `.env` en la raíz del proyecto:

```env
BACKEND_PORT=8765
```

## 🤝 Contribuciones

¡Las contribuciones son bienvenidas! Revisa la estrategia de ramas y las convenciones de Commits (`Conventional Commits`) en nuestro manual para desarrolladores antes de enviar un Pull Request. 

## 📄 Licencia

Distribuido bajo la Licencia MIT. Consulta el archivo `LICENSE` para más información.
