import React from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { BentoGrid } from './components/BentoGrid';
import { PrivacySection } from './components/PrivacySection';
import { RequirementsSection } from './components/RequirementsSection';
import { FaqSection } from './components/FaqSection';
import { Footer } from './components/Footer';
import { PrimaryShimmerButton, SecondaryGitHubButton } from './components/Buttons';
import { ShieldCheck } from 'lucide-react';

export default function App() {
  return (
    <div className="relative min-h-screen bg-[#070A12] text-slate-200 overflow-x-hidden selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Navbar with actual app logo */}
      <Navbar />

      {/* Hero with Left text alignment & Right floating word-gathering visual + App Mockup */}
      <main>
        <Hero />

        {/* Full-width Engineering Bento Grid with floating cards */}
        <BentoGrid />

        {/* Reimagined Privacy Section with enriched animations */}
        <PrivacySection />

        {/* Requirements in Emerald Green theme */}
        <RequirementsSection />

        {/* Consecutive FAQ Cards to the right */}
        <FaqSection />

        {/* Final Conversion CTA Banner (Clean, no top pill banner) */}
        <section className="py-20 md:py-24 relative overflow-hidden border-t border-white/10">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-cyan-950/20 to-emerald-950/20 z-0" />
          <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 w-[550px] h-[250px] bg-emerald-500/10 blur-[130px] rounded-full z-0" />

          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="font-display font-semibold text-2xl sm:text-4xl text-white tracking-tight mb-4">
              Tus Reuniones, Tus Datos, Tu Servidor Local
            </h2>

            <p className="text-slate-400 text-xs sm:text-sm md:text-base max-w-xl mx-auto leading-relaxed mb-8">
              Descarga el instalador .exe de Local Meeting Analyzer directamente en tu equipo. Sin cuotas mensuales, sin telemetría y con total soberanía sobre tu información.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <PrimaryShimmerButton
                label="Descargar para Windows (.exe)"
                badge="100% Gratuito y Libre • AGPL-3.0"
              />
              <SecondaryGitHubButton
                href="https://github.com/edixon-javier/local-meeting-analyzer"
                label="Ver Código en GitHub"
                badge="Open Source"
              />
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
