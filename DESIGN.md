# Design System: Local Meeting Analyzer (Local-First AI & Privacy)

Sigue los estándares de diseño extraídos de referentes de clase mundial ([Linear](https://linear.app), [Raycast](https://raycast.com), [Granola](https://granola.ai) y [Ollama](https://ollama.com)), alineados con la colección [VoltAgent/awesome-design-md](https://github.com/voltagent/awesome-design-md).

---

## 1. Filosofía Visual: "Bóveda Digital de Alta Velocidad"

- **Fondo Base (Canvas)**: `#070A12` con máscara radial y trama sutil de puntos (`28px`).
- **Superficies Elevadas (Glass / Bento)**: `#0F1629/80` con `backdrop-blur-xl`, borde superior de luz (`border border-white/[0.08]` e `inset 0 1px 0 0 rgba(255,255,255,0.12)`).
- **Semántica de Color**:
  - **Cian Eléctrico (`#06B6D4`) & Azul (`#3B82F6`)**: Captura nativa WASAPI en Windows y velocidad en CPU.
  - **Violeta (`#8B5CF6`) a Fucsia (`#D946EF`)**: Inteligencia local con Ollama (Qwen 2.5 / Phi-3 / Llama 3) y servidor MCP.
  - **Verde Esmeralda (`#10B981`)**: Garantía absoluta de privacidad 100% local (`%APPDATA%`, cero telemetría, AGPL-3.0).
  - **Ámbar / Rojo (`#F59E0B` / `#EF4444`)**: Alertas y riesgos de herramientas convencionales en la nube (bots intrusivos, costos por usuario).

---

## 2. Tipografía

- **Titulares & Display**: *Outfit* / *Inter* (`tracking-tight font-bold text-white`).
- **Cuerpo de Texto**: *Inter* (`text-slate-300 leading-relaxed`, contraste WCAG AA > 4.5:1).
- **Métricas & Datos Técnicos**: *JetBrains Mono* (`font-mono text-xs text-cyan-300`).

---

## 3. Catálogo de Componentes Visuales

### 3.1 Botón Primario de Alta Conversión (`PrimaryShimmerButton`)
- **Gradiente Dinámico**: `from-cyan-400 via-blue-500 to-violet-600` con animación de flujo continuo.
- **Efecto Shimmer**: Barrido diagonal de luz translúcida cada 3.5 segundos.
- **Halo Luminoso**: `shadow-[0_0_35px_-5px_rgba(6,182,212,0.45)]` que transiciona a violeta al pasar el cursor.
- **Micro-interacción**: Desplazamiento sutil del icono de descarga en hover y feedback táctil (`active:scale-[0.98]`).
- **Sub-badge**: `v1.2 • Instalador .exe • 100% Offline`.

### 3.2 Botón Secundario (`SecondaryGitHubButton`)
- **Superficie**: `bg-slate-900/80 backdrop-blur-md` con borde `border-white/15`.
- **Efecto Hover**: Borde iluminado en cian `hover:border-cyan-400/50` y halo sutil.
- **Insignia**: Badge integrado `AGPL-3.0`.

### 3.3 Tarjetas Asimétricas con Seguimiento de Cursor (`SpotlightCard`)
- Seguimiento continuo de coordenadas `mouseX` y `mouseY` renderizando un gradiente radial (`radial-gradient(550px circle at x y, rgba(6,182,212,0.15), transparent 80%)`).
- Cada tarjeta contiene una micro-demostración viva (ondas WASAPI duales, renombrado de participantes o conector MCP).

### 3.4 Visualizador de Arquitectura Local en `#privacidad`
- Diagrama interactivo de flujo que demuestra el camino del audio:
  `[Zoom/Teams/Meet + Mic]` ➔ `[CPU Local: Faster-Whisper + Ollama]` ➔ `[Disco Local: %APPDATA%]`.
- Línea de conexión externa cortada con un escudo verde esmeralda y señal de bloqueo (`0 KB enviados a Internet • Cero Bots`).
- Matriz comparativa con columna propia elevada, fondo en gradiente esmeralda y badge `RECOMENDADO • SOBERANÍA TOTAL`.

---

## 4. Estándar de Calidad y Rendimiento

1. **Rendimiento**: Animaciones aceleradas por hardware (`transform` y `opacity`) a 60 FPS sin Cumulative Layout Shift (CLS = 0).
2. **Accesibilidad**: Contraste mínimo de 4.5:1 verificado en todos los textos sobre fondos oscuros.
3. **Responsividad**: Diseñado y probado para resoluciones móviles (`375px`) y escritorios amplios (`1440px+`).
