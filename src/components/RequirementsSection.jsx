import React, { useState } from 'react';
import { Laptop, Cpu, HardDrive, Terminal, Check, Copy } from 'lucide-react';
import { SpotlightCard } from './SpotlightCard';

export function RequirementsSection() {
  const [copied, setCopied] = useState(false);
  const command = "ollama run qwen2.5:7b";

  const handleCopy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const requirements = [
    {
      icon: Laptop,
      title: "Sistema Operativo",
      spec: "Windows 10 / 11 (64-bit)",
      detail: "Soporte nativo para captura WASAPI loopback sin módulos de kernel adicionales.",
    },
    {
      icon: Cpu,
      title: "Procesador (CPU)",
      spec: "4 a 6 Núcleos (Intel / AMD)",
      detail: "Optimizado con instrucciones SIMD / AVX2 para Faster-Whisper a máxima velocidad.",
    },
    {
      icon: HardDrive,
      title: "Memoria RAM",
      spec: "8 GB Mínimo • 16 GB Rec.",
      detail: "Faster-Whisper consume ~450 MB; el resto queda libre para Ollama y tus aplicaciones.",
    },
    {
      icon: Terminal,
      title: "Motor de IA (Ollama)",
      spec: "Ollama Local (Gratuito)",
      detail: "Compatible con modelos abiertos de vanguardia: Qwen 2.5, Phi-3, Llama 3.",
    },
  ];

  return (
    <section id="requisitos" className="py-20 md:py-28 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header (No top banner, subtle typography, emerald accent) */}
        <div className="text-left mb-12 max-w-3xl">
          <h2 className="font-display font-semibold text-2xl sm:text-3xl lg:text-4xl text-white tracking-tight mb-2">
            Diseñado para Correr en tu Portátil o PC
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm md:text-base leading-relaxed">
            Sin suscripciones forzosas a clusters en la nube. Aprovecha el hardware que ya tienes en tu escritorio con consumo eficiente de recursos.
          </p>
        </div>

        {/* 4 Hardware Cards in Emerald Green theme */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {requirements.map((req, idx) => {
            const Icon = req.icon;
            return (
              <SpotlightCard key={idx} className="flex flex-col justify-between" glowColor="rgba(16, 185, 129, 0.2)">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-[10px] uppercase font-mono tracking-wider text-slate-400 mb-1">{req.title}</h3>
                  <div className="font-semibold text-white text-base mb-1.5">{req.spec}</div>
                  <p className="text-slate-400 text-xs leading-relaxed">{req.detail}</p>
                </div>
              </SpotlightCard>
            );
          })}
        </div>

        {/* Interactive Terminal Block in Emerald Green */}
        <div className="max-w-2xl mx-auto p-4 rounded-xl bg-black/80 border border-emerald-500/30 backdrop-blur-xl shadow-[0_0_30px_-5px_rgba(16,185,129,0.25)]">
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/10">
            <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
              <span className="ml-2 text-slate-300 text-[11px]">PowerShell / CMD — Preparar Modelo Ollama</span>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 hover:bg-emerald-950/60 text-xs font-mono text-emerald-300 border border-emerald-500/30 transition-all active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar comando</span>
                </>
              )}
            </button>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs sm:text-sm text-slate-200">
            <span className="text-emerald-400 select-none">&gt;</span>
            <span className="text-emerald-300 font-semibold">{command}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
