---
name: local-meeting-ui-pro
description: Rediseña y optimiza la interfaz web de Local Meeting Analyzer aplicando patrones de diseño de nivel empresarial (Linear, Raycast, Granola), componentes animados de código abierto (shadcn/ui, react-bits, Magic UI, Aceternity UI, Motion) y un bucle de iteración visual continua. Usar siempre que se solicite mejorar el diseño, las animaciones, los botones, la sección #privacidad o la conversión de la landing page.
---

# Local Meeting Analyzer - Elite UI/UX Redesign Skill

Actúa como un Principal Design Engineer (nivel Linear, Raycast, Vercel y Granola). Tu objetivo es transformar y pulir la landing page de **Local Meeting Analyzer** hasta alcanzar una calidad visual, interactiva y narrativa de primer nivel mundial para el nicho de **IA Local, Privacidad y Productividad en Reuniones**.

## 1. Filosofía Visual y Tokens del Nicho (Local-First AI & Privacy)

1. **Atmósfera "Bóveda Digital de Alta Velocidad"**:
   - **Fondo Base (Canvas)**: `#070A12` con malla de puntos o grilla sutil (`bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px]` con máscara radial de desvanecimiento).
   - **Superficies Elevadas (Cards / Bento)**: `#0F1629/80` con `backdrop-blur-xl`, borde superior iluminado (`border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]`).
   - **Paleta Semántica de Acentos**:
     - **Cian Eléctrico (`#06B6D4`) a Azul (`#3B82F6`)**: Captura de audio WASAPI y velocidad en CPU.
     - **Violeta / Púrpura (`#8B5CF6`) a Fucsia (`#D946EF`)**: Inteligencia local con Ollama (Qwen3 / Phi-3), RAG y servidor MCP.
     - **Verde Esmeralda (`#10B981`)**: Garantía de Privacidad 100% Local (`%APPDATA%`, cero telemetría, AGPL-3.0).
     - **Ámbar / Coral (`#F59E0B` / `#EF4444`)**: Riesgos de herramientas en la nube (Otter, Fireflies, bots intrusivos).

2. **Regla de Espaciado y Ritmo (Patrón r/SaaS & Linear)**:
   - Una emoción y una acción clara por sección.
   - Separación macro entre secciones (`py-24 md:py-32`), separación media en grillas (`gap-6`), y padding interno generoso en tarjetas (`p-6 md:p-8`).
   - Tipografía: Títulos con `tracking-tight font-semibold text-white`, cuerpo en `text-slate-300 leading-relaxed` (contraste WCAG > 4.5:1) y etiquetas técnicas (`qwen3:4b`, `WASAPI`, `%APPDATA%`, `AGPL-3.0`) en fuente monoespaciada (`font-mono text-xs`).

## 2. Catálogo de Componentes y Animaciones (Top GitHub Stars)

Prioriza patrones de las librerías líderes del ecosistema React + Tailwind CSS:

1. **Botones Coloridos e Interactivos (CTA Principal y Secundario)**:
   - **Botón Primario (`Descargar para Windows .exe`)**:
     - Fondo con gradiente vivo en movimiento (`bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 bg-[length:200%_auto] hover:bg-right transition-all duration-500`).
     - Efecto `Shimmer` (barrido de luz diagonal en CSS) + halo exterior colorido (`shadow-[0_0_30px_-5px_rgba(6,182,212,0.6)] hover:shadow-[0_0_45px_-5px_rgba(139,92,246,0.75)]`).
     - Borde interno de cristal (`ring-1 ring-white/30`) y respuesta táctil (`active:scale-[0.97]`).
   - **Botón Secundario (`Ver Código en GitHub`)**:
     - Superficie oscura translúcida (`bg-slate-900/80 hover:bg-slate-800/90 border border-white/15 hover:border-cyan-400/50`), con efecto magnético sutil y badge de licencia `AGPL-3.0`.

2. **Sección Hero y Demostración Interactiva**:
   - **Iluminación Superior**: `Spotlight` radial cian/violeta detrás del H1.
   - **Mockup de la Aplicación (`Sesión de Revisión de Arquitectura`)**:
     - Pestañas (`Transcripción en Vivo`, `Minuta Ejecutiva IA`, `Chat RAG Interactivo`, `Servidor MCP Local`) con indicador deslizante animado usando `layoutId` de Framer Motion (`motion`).
     - Animación de onda de audio en tiempo real junto al badge `Grabando audio del sistema (Loopback) + Micrófono`.
     - Transición de entrada escalonada (`staggerChildren`) en los mensajes de la transcripción y citas RAG.

3. **Bento Grid en "Capacidades Completas"**:
   - Convierte la grilla de 6 tarjetas iguales en un **Bento Grid de 3 columnas con spans asimétricos** (por ejemplo, *Grabación Loopback Nativa* y *Servidor MCP Local Integrado* ocupando `md:col-span-2`).
   - Aplica efecto `SpotlightCard` (gradiente radial que sigue las coordenadas `mouseX` y `mouseY` sobre el borde y fondo de cada tarjeta).
   - Añade un micro-visual interactivo dentro de cada tarjeta (ondas de audio, transformación de speaker `Speaker_01 -> Carlos`, comando MCP conectado a `Claude Desktop / Cursor / Antigravity`).

4. **Reinvención de la Sección `#privacidad` (Transparencia y Seguridad)**:
   - **Parte A - Visualizador de Arquitectura Local (`AnimatedBeam`)**:
     - Crea un bloque visual interactivo antes de la tabla que muestre el flujo de datos: `[Zoom / Teams / Meet + Mic]` ➔ `[CPU Local: Faster-Whisper + Ollama]` ➔ `[Disco Local: %APPDATA%]`.
     - Muestra una línea bloqueada con un escudo verde esmeralda (`100% Offline • Cero Bots • Cero Nube`) frente a servidores externos.
   - **Parte B - Matriz Comparativa de Alto Contraste**:
     - Destaca la columna **Local Meeting Analyzer** con fondo `bg-gradient-to-b from-emerald-500/10 via-cyan-500/5 to-transparent`, borde `border-emerald-500/40` y un badge superior `RECOMENDADO • SOBERANÍA TOTAL`.
     - Añade efecto hover por fila que ilumine la comparativa y muestre tooltips o micro-detalles técnicos (por ejemplo, ruta `%APPDATA%`, consumo cero de red).

5. **Requisitos del Sistema y FAQ**:
   - En las 4 tarjetas de hardware, añade un bloque interactivo de terminal lista para copiar (`ollama run qwen3:4b`) con botón de copiado y animación de confirmación.
   - En el FAQ, usa acordeones suaves con rotación de icono y apertura animada en altura.

## 3. Flujo de Trabajo Iterativo hasta la Perfección

Nunca des el trabajo por terminado en el primer intento. Ejecuta este bucle de 4 fases:

1. **Fase 1 - Inspección del Código**: Lee los componentes actuales del proyecto para respetar las rutas de descarga, textos en español y enlaces a GitHub existentes.
2. **Fase 2 - Implementación de Tokens, Hero y Botones Coloridos**: Actualiza estilos globales (`tailwind.config` / CSS variables), el Hero, los botones con shimmer/gradiente y el mockup interactivo.
3. **Fase 3 - Implementación de Bento Grid y Sección `#privacidad`**: Construye el diagrama visual de privacidad local, la tabla comparativa mejorada y las tarjetas `SpotlightCard`.
4. **Fase 4 - Verificación Visual y Pulido (Self-Critique Loop)**:
   - Levanta o verifica la vista previa en navegador (Desktop `1440px` y Mobile `375px`).
   - Comprueba: ¿Se entiende el valor en 4 segundos? ¿Los botones invitan a hacer clic de inmediato? ¿La sección `#privacidad` transmite seguridad absoluta a primera vista? ¿Las animaciones corren a 60fps sin saltos de layout (`CLS`)?
   - Si alguna sección aún luce plana o genérica, itera sobre ese componente antes de finalizar.
