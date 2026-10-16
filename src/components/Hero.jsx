import React from 'react';
import { ShieldCheck, Check, Laptop } from 'lucide-react';
import { PrimaryShimmerButton, SecondaryGitHubButton } from './Buttons';
import { AppMockup } from './AppMockup';
import { InformationGatheringVisual } from './InformationGatheringVisual';
import { BackgroundScatteredNotes } from './BackgroundScatteredNotes';

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Primer Giro / First Viewport Fold (Contenedor propio con notas de fondo integradas) */}
      <div className="relative min-h-[88vh] lg:min-h-[92vh] flex flex-col justify-center pt-24 pb-12 overflow-hidden">
        
        {/* Background ambient lighting & grid scoped to first fold */}
        <div className="pointer-events-none absolute inset-0 bg-grid-pattern bg-radial-mask opacity-30 z-0" />
        <div className="pointer-events-none absolute top-16 left-1/4 w-[650px] h-[380px] bg-gradient-to-tr from-emerald-500/15 via-teal-600/10 to-cyan-600/15 blur-[140px] rounded-full z-0" />

        {/* Scattered notes and fragments floating in the background specifically inside the first fold */}
        <BackgroundScatteredNotes />

        {/* Foreground Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            
            {/* Left Column (With emerald green gradient accent) */}
            <div className="lg:col-span-7 text-left space-y-6">
              <h1 className="animate-enter-1 font-display font-semibold text-3xl sm:text-5xl lg:text-6xl tracking-tight text-white leading-[1.14]">
                Transcribe tus reuniones y llamadas en tiempo real.<br />
                <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent font-bold">
                  Directo en tu PC, sin bots ni suscripciones.
                </span>
              </h1>

              <p className="animate-enter-2 text-slate-300 text-sm sm:text-base lg:text-lg font-normal leading-relaxed max-w-xl">
                Captura el audio de Zoom, Meet y Teams junto a tu micrófono en Windows. <strong className="text-white font-medium">Faster-Whisper</strong> transcribe en vivo y <strong className="text-white font-medium">Ollama</strong> organiza tus notas y acuerdos en tu propia máquina.
              </p>

              {/* Actions (Emerald themed, identical height, perfectly aligned) */}
              <div className="animate-enter-3 pt-2 flex flex-col sm:flex-row items-center sm:items-start gap-4">
                <PrimaryShimmerButton
                  label="Descargar para Windows (.exe)"
                />
                <SecondaryGitHubButton
                  href="https://github.com/edixon-javier/local-meeting-analyzer"
                  label="Ver Código en GitHub"
                  badge="AGPL-3.0"
                />
              </div>

              {/* Trust indicators */}
              <div className="animate-enter-3 pt-2 flex flex-wrap items-center gap-5 text-xs text-slate-400 font-medium">
                <span className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
                  100% Gratuito y Libre (AGPL-3.0)
                </span>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
                  Cero Telemetría / Sin Cuentas
                </span>
                <span className="flex items-center gap-1.5">
                  <Laptop className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
                  Windows 10 / 11 x64
                </span>
              </div>
            </div>

            {/* Right Column (Memory Core brain cluster shifted towards green X on large screens) */}
            <div className="animate-enter-4 lg:col-span-5 w-full flex justify-center lg:justify-end xl:translate-x-8 2xl:translate-x-16">
              <InformationGatheringVisual />
            </div>

          </div>
        </div>
      </div>

      {/* Product Interactive Demo Showcase (Cleanly separated below the first fold) */}
      <div id="como-funciona" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-20 md:pt-28 md:pb-28 border-t border-white/[0.06]">
        <div className="text-left mb-8 max-w-2xl">
          <h2 className="font-display font-semibold text-xl sm:text-2xl text-white tracking-tight">
            Demostración Interactiva del Software
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Explora cómo captura, transcribe, extrae decisiones en vivo y expone herramientas vía servidor MCP.
          </p>
        </div>
        <AppMockup />
      </div>

    </section>
  );
}
