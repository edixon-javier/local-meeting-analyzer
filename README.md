<p align="center">
  <img src="icon.png" width="96" height="96" alt="Local Meeting Analyzer Web Logo" style="border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.3);" />
</p>

<h1 align="center">Local Meeting Analyzer — Web Oficial & Showcase</h1>

<p align="center">
  <strong>Landing page de alto rendimiento, nivel Silicon Valley, para la presentación y distribución de Local Meeting Analyzer.</strong><br>
  Construida con Vite 5, React 18, Tailwind CSS y microinteracciones de última generación inspiradas en Linear, Raycast y Granola.
</p>

<p align="center">
  <a href="https://vitejs.dev/"><img src="https://img.shields.io/badge/Bundler-Vite%205-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite 5"></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/Framework-React%2018-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 18"></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Styles-Tailwind%20CSS%203-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS"></a>
  <a href="https://vercel.com/"><img src="https://img.shields.io/badge/Deploy-Vercel-000000?style=flat-square&logo=vercel&logoColor=white" alt="Vercel"></a>
  <a href="https://local-meeting-analyzer.vercel.app/"><img src="https://img.shields.io/badge/Status-Live%20Production-10B981?style=flat-square&logo=statuspage&logoColor=white" alt="Estado en Vivo"></a>
  <a href="https://github.com/edixon-javier/local-meeting-analyzer/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-AGPL%20v3.0-blue?style=flat-square&logo=gnu&logoColor=white" alt="Licencia AGPL v3.0"></a>
</p>

<p align="center">
  <a href="https://local-meeting-analyzer.vercel.app/"><strong>🌐 Ver Sitio Web en Vivo</strong></a> •
  <a href="https://github.com/edixon-javier/local-meeting-analyzer"><strong>💻 Repositorio Principal (Desktop App)</strong></a> •
  <a href="DESIGN.md"><strong>🎨 Sistema de Diseño (DESIGN.md)</strong></a> •
  <a href="#-distribución-directa-del-instalador-exe"><strong>📦 Descarga Directa</strong></a>
</p>

---

## 🌟 Visión y Experiencia de Usuario

Esta rama (`website`) aloja la experiencia web interactiva oficial de **Local Meeting Analyzer**. Diseñada con una estética de *"Bóveda Digital de Alta Velocidad"* (paleta Dark Mode profunda, bordes sutiles, mallas de gradientes e iluminación focal reactiva):

1. **Hero & Módulo de Memoria Local**:
   - Titular de alto impacto enfocado en beneficios tangibles: *"Transcribe tus reuniones y llamadas en tiempo real. Directo en tu PC, sin bots ni suscripciones."*
   - Cluster orgánico con silueta de cerebro inclinado hacia el margen derecho, conectando conceptos flotantes (WASAPI, Faster-Whisper, Ollama, Privacidad) con el núcleo de memoria mediante líneas punteadas dinámicas en bucle.
   - Notas contextuales difuminadas integradas en el primer pliegue de la pantalla.
   - Botones simétricos con degradado verde esmeralda y efecto de brillo (*shimmer*).

2. **Ingeniería Local-First (Bento Grid Asimétrico)**:
   - Visualización modular de capacidades técnicas: Ollama Local (Ámbar), Loopback WASAPI (Cian), Whisper CPU (Violeta), Diarización de Hablantes (Fucsia), Servidor MCP (Índigo) y Asistente RAG (Esmeralda).

3. **Demostración Interactiva del Software**:
   - Simulador visual de la aplicación de escritorio con transmisión SSE de transcripción en tiempo real y selector de pestañas (Grabación, Análisis, Historial, Ajustes).

4. **Matriz de Privacidad & Bóveda**:
   - Diagrama de flujo de datos animado con un botón interactivo de *"Probar Bloqueo Cloud"* que ilustra cómo el tráfico externo es bloqueado en favor del almacenamiento local en `%APPDATA%`.

5. **Requisitos de Hardware & Terminal Interactivo**:
   - Tarjetas comparativas de requisitos mínimos vs. recomendados con bloques de terminal interactivos para copiar comandos de Ollama en un clic (`ollama run qwen2.5:7b`).

---

## 📦 Distribución Directa del Instalador (.exe)

Para garantizar que los usuarios puedan descargar el software sin depender de GitHub Releases ni toparse con errores 404 (especialmente útil si el repositorio principal es privado):

- El binario oficial para Windows (`Meeting-Analyzer.exe`) se encuentra empaquetado directamente en el directorio `public/`.
- Al compilar con Vite, el archivo se sitúa en la raíz de producción (`dist/Meeting-Analyzer.exe`).
- Tanto el botón de la barra de navegación como el botón principal del Hero ejecutan la descarga directa mediante atributos HTML5 `download="Meeting-Analyzer.exe"`, mostrando al instante una notificación flotante de confirmación (`¡Descarga iniciada: Meeting-Analyzer.exe!`).

---

## 🚀 Despliegue en Producción (Vercel)

El sitio está optimizado para desplegarse automáticamente en **Vercel** desde la rama `website`:

### Configuración de `vercel.json`
```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "cleanUrls": true,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" }
      ]
    }
  ]
}
```

### Pasos para Conectar en el Dashboard de Vercel:
1. Conecta tu repositorio de GitHub `edixon-javier/local-meeting-analyzer`.
2. En **Settings** → **Git**:
   - **Production Branch**: `website`
3. En **Settings** → **Build & Development Settings**:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Cada `git push origin website` disparará un nuevo despliegue instantáneo con SSL global.

---

## 💻 Desarrollo Local

Para ejecutar y probar la landing page en tu entorno de desarrollo:

### 1. Clonar o acceder a la rama `website`
```bash
git checkout website
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Iniciar el servidor de desarrollo Vite
```bash
npm run dev
```
Abre en tu navegador: `http://localhost:5173`

### 4. Compilar para producción y previsualizar
```bash
npm run build
npm run preview
```
Previsualiza la versión compilada en: `http://localhost:4173`

---

## 📁 Estructura del Código

```text
├── public/
│   ├── Meeting-Analyzer.exe     # Binario oficial empaquetado para descarga directa
│   ├── icon.png                 # Logotipo oficial en alta resolución
│   └── assets/                  # Favicons y recursos gráficos estáticos
├── src/
│   ├── components/
│   │   ├── Navbar.jsx           # Barra de navegación fija con backdrop blur y botón de descarga
│   │   ├── Hero.jsx             # Sección principal con titular esmeralda y CTA simétrico
│   │   ├── Buttons.jsx          # Botones con gradientes animados, bordes shimmer y toasts
│   │   ├── InformationGatheringVisual.jsx # Cluster de cerebro con líneas dinámicas SVG
│   │   ├── BackgroundScatteredNotes.jsx   # Notas ambientales difuminadas en el primer giro
│   │   ├── BentoGrid.jsx        # Cuadrícula bento de ingeniería local-first
│   │   ├── AppMockup.jsx        # Maqueta interactiva de la app con streaming SSE
│   │   ├── PrivacySection.jsx   # Diagrama de flujo de bóveda y simulador de bloqueo
│   │   ├── RequirementsSection.jsx # Tarjetas de hardware y terminal copyable
│   │   ├── FaqSection.jsx       # Acordeón de preguntas frecuentes consecutivas
│   │   └── Footer.jsx           # Pie de página con logotipo y enlaces legales
│   ├── App.jsx                  # Composición principal y orden semántico
│   ├── index.css                # Directivas de Tailwind y animaciones personalizadas
│   └── main.jsx                 # Punto de entrada de React 18
├── DESIGN.md                    # Manual del Sistema de Diseño y tokens visuales
├── tailwind.config.js           # Configuración de paletas, resplandores y tipografías
├── vercel.json                  # Cabeceras de seguridad y build settings para Vercel
└── vite.config.js               # Configuración del empaquetador Vite y plugin React
```

---

## 🎨 Sistema de Diseño (Design Tokens)

El diseño sigue las directrices especificadas en [`DESIGN.md`](DESIGN.md):
- **Canvas Base**: `#070A12` con rejilla sutil de puntos radiales.
- **Tarjetas y Superficies**: `#0F1629/80` con desenfoque de fondo (`backdrop-blur-xl`) y bordes internos `border-white/[0.08]`.
- **Acento Primario**: Gradiente Verde Esmeralda (`#10B981`) a Cerceta (`#14B8A6`).
- **Acentos Funcionales**:
  - Cian Eléctrico (`#06B6D4`): Captura WASAPI y velocidad en tiempo real.
  - Violeta (`#8B5CF6`) y Fucsia (`#D946EF`): Whisper, Ollama y Diarización.
  - Ámbar (`#F59E0B`): Avisos y diferenciación con la nube.

---

## ⚖️ Licencia

Distribuido bajo la licencia **GNU AGPL v3.0**. Consulta el archivo [`LICENSE`](https://github.com/edixon-javier/local-meeting-analyzer/blob/main/LICENSE) en el repositorio principal.
