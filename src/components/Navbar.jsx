import React, { useState, useEffect } from 'react';
import { Github, Download, Menu, X, ShieldCheck } from 'lucide-react';

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#070A12]/90 backdrop-blur-xl border-b border-white/[0.08] shadow-lg shadow-black/40 py-3'
          : 'bg-transparent py-4'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Brand Logo with actual project logo */}
        <a href="#" className="flex items-center gap-3 group">
          <div className="relative w-9 h-9 rounded-xl overflow-hidden border border-white/10 shadow-sm transition-transform duration-300 group-hover:scale-105">
            <img
              src="/icon.png"
              alt="Local Meeting Analyzer Logo"
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback to assets path if needed
                e.currentTarget.src = '/assets/icon.png';
              }}
            />
          </div>
          <div className="flex flex-col">
            <span className="font-display font-semibold text-base sm:text-lg tracking-tight text-white group-hover:text-cyan-200 transition-colors">
              Local Meeting Analyzer
            </span>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>100% Local • Windows</span>
            </div>
          </div>
        </a>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-7">
          <a href="#caracteristicas" className="text-xs sm:text-sm text-slate-300 hover:text-cyan-300 transition-colors">
            Capacidades
          </a>
          <a href="#como-funciona" className="text-xs sm:text-sm text-slate-300 hover:text-cyan-300 transition-colors">
            Demostración
          </a>
          <a href="#privacidad" className="text-xs sm:text-sm text-emerald-400/90 hover:text-emerald-300 transition-colors flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Privacidad &amp; Bóveda
          </a>
          <a href="#requisitos" className="text-xs sm:text-sm text-slate-300 hover:text-cyan-300 transition-colors">
            Requisitos
          </a>
          <a href="#faq" className="text-xs sm:text-sm text-slate-300 hover:text-cyan-300 transition-colors">
            FAQ
          </a>
        </nav>

        {/* Actions */}
        <div className="hidden md:flex items-center gap-3">
          <a
            href="https://github.com/edixon-javier/local-meeting-analyzer"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-slate-900/60 text-xs font-medium text-slate-300 hover:text-white hover:border-cyan-500/40 hover:bg-slate-800 transition-all"
          >
            <Github className="w-3.5 h-3.5 text-slate-400" />
            <span>GitHub</span>
          </a>
          <a
            href="/Meeting-Analyzer.exe"
            download="Meeting-Analyzer.exe"
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-xs font-semibold text-white shadow-[0_0_20px_-3px_rgba(16,185,129,0.45)] hover:brightness-110 active:scale-95 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar .exe</span>
          </a>
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-slate-400 hover:text-white"
          aria-label="Abrir menú"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0F1629] border-b border-white/10 px-6 py-5 flex flex-col gap-4">
          <a
            href="#caracteristicas"
            onClick={() => setMobileMenuOpen(false)}
            className="text-slate-200 font-medium py-1 text-sm"
          >
            Capacidades
          </a>
          <a
            href="#como-funciona"
            onClick={() => setMobileMenuOpen(false)}
            className="text-slate-200 font-medium py-1 text-sm"
          >
            Demostración
          </a>
          <a
            href="#privacidad"
            onClick={() => setMobileMenuOpen(false)}
            className="text-emerald-400 font-medium py-1 flex items-center gap-2 text-sm"
          >
            <ShieldCheck className="w-4 h-4" /> Privacidad &amp; Bóveda Local
          </a>
          <a
            href="#requisitos"
            onClick={() => setMobileMenuOpen(false)}
            className="text-slate-200 font-medium py-1 text-sm"
          >
            Requisitos
          </a>
          <a
            href="#faq"
            onClick={() => setMobileMenuOpen(false)}
            className="text-slate-200 font-medium py-1 text-sm"
          >
            FAQ
          </a>
          <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
            <a
              href="/Meeting-Analyzer.exe"
              download="Meeting-Analyzer.exe"
              className="w-full text-center py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 font-semibold text-white text-xs shadow-md"
            >
              Descargar para Windows (.exe)
            </a>
            <a
              href="https://github.com/edixon-javier/local-meeting-analyzer"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full text-center py-2.5 rounded-lg border border-white/10 text-slate-300 text-xs"
            >
              Ver en GitHub
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
