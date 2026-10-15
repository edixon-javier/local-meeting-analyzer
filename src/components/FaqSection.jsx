import React from 'react';
import { HelpCircle, CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';
import { SpotlightCard } from './SpotlightCard';

export function FaqSection() {
  const faqs = [
    {
      q: "¿Cómo captura audio sin meter un bot?",
      a: "Utiliza la API oficial WASAPI Loopback de Windows. Captura el audio en la capa de sonido del sistema operativo antes de salir a tus altavoces, combinándolo con tu micrófono en tiempo real sin requerir invitaciones ni participantes artificiales."
    },
    {
      q: "¿Realmente ningún dato sale a Internet?",
      a: "Por defecto, absolutamente ninguno. Faster-Whisper y Ollama se ejecutan como procesos locales en tu máquina. Las transcripciones y metadatos se guardan en archivos JSON dentro de %APPDATA%\\Local Meeting Analyzer\\. Cero telemetría ni analíticas. Solo se enviará información a la nube si tú decides activar proveedores externos (OpenAI, Claude o Gemini) con tu propia clave API en los Ajustes."
    },
    {
      q: "¿Cómo distingue a los diferentes interlocutores?",
      a: "La separación de hablantes la realiza el modelo de lenguaje analizando la estructura textual y los turnos de diálogo (diarización contextual), sin requerir biometría de voz. Puedes renombrar a cualquier interlocutor en toda la reunión con un solo clic."
    },
    {
      q: "¿Necesito tarjeta gráfica dedicada (GPU)?",
      a: "No es obligatorio. Faster-Whisper está optimizado para CPU mediante cuantización INT8 y AVX2, consumiendo menos de 500 MB de RAM. Si dispones de GPU NVIDIA, Ollama la aprovechará automáticamente."
    },
    {
      q: "¿Cómo se integra con Claude y Cursor?",
      a: "Incluye un servidor Model Context Protocol (MCP) que corre localmente en tu equipo (puerto 8765). Tus asistentes de IA pueden consultar acuerdos y buscar en el historial directamente sin exponer tus archivos a servidores externos."
    },
    {
      q: "¿Puedo usarlo libremente en mi empresa?",
      a: "Sí, se distribuye bajo licencia AGPL-3.0. Eres completamente libre de usarlo en tu equipo de trabajo o en tu empresa sin coste alguno. El código fuente completo es auditable en GitHub."
    }
  ];

  return (
    <section id="faq" className="py-20 md:py-28 relative bg-[#070b18]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Layout: Left Header | Right Consecutive Cards in a flowing Line */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          
          {/* Left Column: Title & Description */}
          <div className="lg:col-span-4 text-left space-y-3 lg:sticky lg:top-28">
            <h2 className="font-display font-semibold text-2xl sm:text-3xl text-white tracking-tight leading-snug">
              Todo lo que Necesitas Saber
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
              Respuestas directas sobre la arquitectura local, captura WASAPI, servidores MCP y soberanía de datos.
            </p>
            <div className="pt-2">
              <a
                href="https://github.com/edixon-javier/local-meeting-analyzer"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <span>Ver documentación técnica en GitHub</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Right Column: Consecutive cards in a clean line / sequence */}
          <div className="lg:col-span-8 space-y-4">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="group relative rounded-xl border border-white/[0.08] bg-[#0E1528]/80 backdrop-blur-md p-5 transition-all duration-300 hover:border-emerald-500/40 hover:bg-[#121c36]/90 shadow-sm hover:shadow-[0_0_20px_-5px_rgba(16,185,129,0.2)]"
              >
                <div className="flex items-start gap-3.5">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xs font-mono shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="space-y-1.5">
                    <h3 className="font-medium text-white text-sm sm:text-base group-hover:text-emerald-300 transition-colors">
                      {faq.q}
                    </h3>
                    <p className="text-slate-400 text-xs sm:text-sm leading-relaxed font-normal">
                      {faq.a}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>

      </div>
    </section>
  );
}
