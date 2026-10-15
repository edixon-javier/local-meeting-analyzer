# Local Meeting Analyzer — Landing Page Web

Esta rama (`website`) contiene el sitio web y landing page oficial de presentación y descarga de **Local Meeting Analyzer**.

## 🚀 Despliegue en 1 Clic (Vercel o Netlify)

Dado que el repositorio principal es privado, puedes conectar esta rama a **Vercel** o **Netlify** de forma 100% gratuita con soporte de repositorios privados y SSL automático.

### Opción A: Despliegue en Vercel (Recomendado)

1. Ve a [vercel.com](https://vercel.com) e inicia sesión con tu cuenta de GitHub (`edixon-javier`).
2. Haz clic en **"Add New..."** → **"Project"**.
3. Selecciona el repositorio privado **`local-meeting-analyzer`**.
4. En la configuración del proyecto:
   - **Production Branch**: cambia de `main` a `website`.
   - **Framework Preset**: selecciona *Other* (sitio estático).
   - **Root Directory**: deja `./` (la raíz de la rama).
5. Haz clic en **"Deploy"**. En 5 segundos tendrás tu URL pública (ej. `local-meeting-analyzer.vercel.app`) y cada cambio que subas a la rama `website` se desplegará automáticamente.

### Opción B: Despliegue en Netlify

1. Ve a [app.netlify.com](https://app.netlify.com) e inicia sesión con GitHub.
2. Selecciona **"Add new site"** → **"Import an existing project"** → **"GitHub"**.
3. Autoriza y elige **`edixon-javier/local-meeting-analyzer`**.
4. Configura:
   - **Branch to deploy**: `website`.
   - **Publish directory**: `.` (o dejar en blanco).
5. Haz clic en **"Deploy site"**. ¡Listo!

## 📁 Estructura de la Web

- `index.html`: Página principal responsive con presentación del producto, comparativa de privacidad, requisitos, reproductor interactivo y FAQs.
- `styles.css`: Estilos visuales Dark Mode premium (paleta Slate/Indigo) con animaciones CSS.
- `script.js`: Control de pestañas interactivas, simulación de streaming de transcripción y acordeón de preguntas frecuentes.
- `assets/icon.png`: Icono oficial de la aplicación.
- `vercel.json` & `netlify.toml`: Cabeceras de seguridad y optimizaciones de caché para despliegue sin configuración adicional.
