import React from 'react';
import { Mic, Github, ShieldCheck, Heart, Download } from 'lucide-react';
import { useDownloadHref } from './Buttons';

export function Footer() {
  const { href: downloadHref } = useDownloadHref();
  return (
    <footer className="border-t border-white/10 bg-[#05070e] py-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 pb-10 border-b border-white/10">
          {/* Logo & Manifesto */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="relative w-8 h-8 rounded-xl overflow-hidden border border-white/10 shadow-sm shrink-0">
                <img
                  src="/icon.png"
                  alt="Local Meeting Analyzer Logo"
                  className="w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.src = '/assets/icon.png'; }}
                />
              </div>
              <span className="font-display font-semibold text-lg text-white">Local Meeting Analyzer</span>
            </div>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
              La alternativa de código abierto, sin bots y 100% privada para transcribir y analizar reuniones con IA en Windows.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-300 font-medium">
            <a href="#caracteristicas" className="hover:text-cyan-300 transition-colors">Capacidades</a>
            <a href="#como-funciona" className="hover:text-cyan-300 transition-colors">Demostración</a>
            <a href="#privacidad" className="hover:text-emerald-300 transition-colors">Privacidad</a>
            <a href="#requisitos" className="hover:text-cyan-300 transition-colors">Requisitos</a>
            <a href="#faq" className="hover:text-cyan-300 transition-colors">FAQ</a>
            <a href="/privacy" className="hover:text-emerald-300 transition-colors">Política de privacidad</a>
            <a
              href={downloadHref}
              className="text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" /> Descargar .exe
            </a>
            <a
              href="https://github.com/edixon-javier/local-meeting-analyzer"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-300 hover:text-white transition-colors flex items-center gap-1"
            >
              <Github className="w-3.5 h-3.5" /> GitHub
            </a>
          </div>
        </div>

        {/* Bottom credits & license */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Licencia GNU Affero GPL v3.0 (AGPL-3.0) • Cero Telemetría • 100% Local</span>
          </div>
          <div>
            Hecho para la soberanía de datos y privacidad en reuniones.
          </div>
        </div>
      </div>
    </footer>
  );
}
