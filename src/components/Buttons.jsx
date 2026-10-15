import React, { useState } from 'react';
import { Download, Github, Check } from 'lucide-react';

export function PrimaryShimmerButton({
  href = "/Meeting-Analyzer.exe",
  label = "Descargar para Windows (.exe)",
  className = "",
}) {
  const [downloadStarted, setDownloadStarted] = useState(false);

  const handleClick = () => {
    setDownloadStarted(true);
    setTimeout(() => setDownloadStarted(false), 3500);
  };

  return (
    <div className="relative inline-flex items-center">
      <a
        href={href}
        download="Meeting-Analyzer.exe"
        onClick={handleClick}
        className={`group relative inline-flex items-center justify-center overflow-hidden rounded-xl p-[1.5px] h-[52px] transition-all duration-300 hover:scale-[1.01] active:scale-[0.98] shadow-glow-cyan hover:shadow-glow-violet ${className}`}
      >
        {/* Animated gradient border */}
        <span className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-600 animate-gradient-flow rounded-xl" />

        {/* Button content surface */}
        <span className="relative flex items-center justify-center gap-2.5 h-full px-6 rounded-[10px] bg-gradient-to-r from-[#09152e] to-[#120d2c] border border-white/20 transition-all duration-300 group-hover:bg-opacity-80">
          {/* Shimmer sweep effect */}
          <span className="pointer-events-none absolute inset-0 -translate-x-full animate-shimmer-sweep bg-gradient-to-r from-transparent via-white/25 to-transparent w-1/2" />

          <Download className="w-4 h-4 text-cyan-300 transition-transform duration-300 group-hover:translate-y-0.5" />
          <span className="font-medium text-white tracking-normal text-sm whitespace-nowrap">
            {label}
          </span>
        </span>
      </a>

      {/* Floating feedback alert when download begins */}
      {downloadStarted && (
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1 rounded-full bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 text-xs font-mono shadow-lg flex items-center gap-1.5 animate-pulse z-20">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>¡Descarga iniciada: Meeting-Analyzer.exe!</span>
        </div>
      )}
    </div>
  );
}

export function SecondaryGitHubButton({
  href = "https://github.com/edixon-javier/local-meeting-analyzer",
  label = "Ver Código en GitHub",
  badge = "AGPL-3.0",
  className = "",
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`group relative inline-flex items-center justify-center gap-2.5 px-6 h-[52px] rounded-xl border border-white/10 bg-slate-900/80 backdrop-blur-md text-slate-300 font-medium text-sm transition-all duration-300 hover:border-cyan-400/40 hover:bg-slate-800/90 hover:text-white hover:shadow-[0_0_20px_-5px_rgba(6,182,212,0.25)] active:scale-[0.98] ${className}`}
    >
      <Github className="w-4 h-4 text-slate-400 transition-colors group-hover:text-cyan-300" />
      <span className="whitespace-nowrap">{label}</span>
      {badge && (
        <span className="px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30 text-[10px] font-mono text-cyan-300">
          {badge}
        </span>
      )}
    </a>
  );
}
