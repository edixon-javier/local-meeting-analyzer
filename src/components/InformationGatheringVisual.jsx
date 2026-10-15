import React, { useState } from 'react';
import { 
  Sparkles, 
  Cpu, 
  Mic, 
  HardDrive, 
  ShieldCheck,
  User,
  Clock,
  Lock,
  MessageSquare,
  CheckCircle2
} from 'lucide-react';

export function InformationGatheringVisual() {
  const [activeToken, setActiveToken] = useState(null);

  const tokens = [
    {
      id: 1,
      label: "Audio de la llamada",
      icon: Mic,
      color: "border-cyan-500/40 text-cyan-300 bg-cyan-950/40",
      glow: "shadow-[0_0_15px_rgba(6,182,212,0.35)]",
      pos: "top-4 left-6",
      delay: "0s",
      desc: "Captura de altavoz y micrófono en Windows"
    },
    {
      id: 2,
      label: "Acuerdo: Lanzamiento v1.2",
      icon: CheckCircle2,
      color: "border-emerald-500/40 text-emerald-300 bg-emerald-950/40",
      glow: "shadow-[0_0_15px_rgba(16,185,129,0.35)]",
      pos: "top-8 right-6",
      delay: "1.4s",
      desc: "Compromiso clave detectado en la reunión"
    },
    {
      id: 3,
      label: "Carlos (Tech Lead)",
      icon: User,
      color: "border-sky-500/40 text-sky-300 bg-sky-950/40",
      glow: "shadow-[0_0_15px_rgba(14,165,233,0.35)]",
      pos: "top-28 left-2",
      delay: "2.8s",
      desc: "Hablante identificado en la llamada"
    },
    {
      id: 4,
      label: "Transcripción Faster-Whisper",
      icon: Cpu,
      color: "border-violet-500/40 text-violet-300 bg-violet-950/40",
      glow: "shadow-[0_0_15px_rgba(139,92,246,0.35)]",
      pos: "top-32 right-2",
      delay: "0.9s",
      desc: "Palabra por palabra en tiempo real"
    },
    {
      id: 5,
      label: "Andrea: 'Aprobamos el diseño'",
      icon: MessageSquare,
      color: "border-fuchsia-500/40 text-fuchsia-300 bg-fuchsia-950/40",
      glow: "shadow-[0_0_15px_rgba(217,70,239,0.35)]",
      pos: "bottom-32 left-4",
      delay: "2.1s",
      desc: "Cita textual vinculada al segundo exacto"
    },
    {
      id: 6,
      label: "Minuta y Tareas Ollama",
      icon: Sparkles,
      color: "border-amber-500/40 text-amber-300 bg-amber-950/40",
      glow: "shadow-[0_0_15px_rgba(245,158,11,0.35)]",
      pos: "bottom-14 left-24",
      delay: "1.7s",
      desc: "Resumen estructurado sin salir del PC"
    },
    {
      id: 7,
      label: "Timestamp 00:01:38",
      icon: Clock,
      color: "border-rose-500/40 text-rose-300 bg-rose-950/40",
      glow: "shadow-[0_0_15px_rgba(244,63,94,0.35)]",
      pos: "bottom-28 right-4",
      delay: "3.3s",
      desc: "Búsqueda directa en el momento exacto"
    },
    {
      id: 8,
      label: "0 KB enviados a la Nube",
      icon: ShieldCheck,
      color: "border-emerald-400/40 text-emerald-200 bg-emerald-950/40",
      glow: "shadow-[0_0_15px_rgba(16,185,129,0.35)]",
      pos: "bottom-8 right-24",
      delay: "1.2s",
      desc: "Tus datos nunca salen de tu ordenador"
    }
  ];

  return (
    <div className="relative w-full h-[460px] flex items-center justify-center select-none overflow-hidden">
      {/* Background radiant glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="w-[320px] h-[320px] rounded-full bg-gradient-to-tr from-cyan-500/15 via-blue-600/10 to-violet-600/15 blur-[80px]" />
      </div>

      {/* Decorative connecting circuit traces converging towards the central memory */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30">
        <defs>
          <linearGradient id="traceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#8B5CF6" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0.8" />
          </linearGradient>
        </defs>
        <circle cx="50%" cy="50%" r="100" stroke="url(#traceGrad)" strokeWidth="1" strokeDasharray="4 4" fill="none" />
        <circle cx="50%" cy="50%" r="170" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="1" strokeDasharray="6 6" fill="none" />
        
        {/* Converging vectors */}
        <line x1="50%" y1="50%" x2="18%" y2="15%" stroke="rgba(6, 182, 212, 0.3)" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="50%" y1="50%" x2="82%" y2="18%" stroke="rgba(16, 185, 129, 0.3)" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="50%" y1="50%" x2="15%" y2="78%" stroke="rgba(217, 70, 239, 0.3)" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="50%" y1="50%" x2="85%" y2="78%" stroke="rgba(244, 63, 94, 0.3)" strokeWidth="1" strokeDasharray="3 3" />
      </svg>

      {/* Central Memory Core: Represents organizing dispersed ideas into local memory */}
      <div className="relative z-20 flex flex-col items-center justify-center p-5 rounded-2xl bg-[#091226]/90 border border-cyan-400/40 backdrop-blur-2xl shadow-[0_0_40px_-5px_rgba(6,182,212,0.5)] text-center max-w-[210px] transition-transform duration-300 hover:scale-105">
        <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-violet-600 flex items-center justify-center text-white mb-2 shadow-glow-cyan">
          <Cpu className="w-6 h-6 animate-pulse" />
          {/* Micro pulsing ring */}
          <span className="absolute -inset-1 rounded-xl bg-cyan-400/30 blur-sm animate-ping opacity-60" />
        </div>
        <span className="font-display font-semibold text-white text-xs tracking-tight">
          Memoria Local
        </span>
        <span className="text-[10px] font-mono text-cyan-300 mt-0.5">
          Organizando tus ideas
        </span>
        <div className="flex items-center gap-1.5 mt-2 text-[9px] font-mono text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Bóveda privada en tu PC</span>
        </div>
      </div>

      {/* Floating dispersed elements surrounding the memory core */}
      {tokens.map((token) => {
        const Icon = token.icon;
        const isHovered = activeToken === token.id;
        return (
          <div
            key={token.id}
            onMouseEnter={() => setActiveToken(token.id)}
            onMouseLeave={() => setActiveToken(null)}
            style={{
              animationDelay: token.delay,
            }}
            className={`absolute ${token.pos} z-30 animate-float cursor-pointer transition-all duration-300`}
          >
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-mono backdrop-blur-md transition-all duration-300 ${token.color} ${token.glow} ${
                isHovered ? 'scale-110 brightness-125 z-40' : 'hover:scale-105'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap font-medium text-[11px] sm:text-xs">
                {token.label}
              </span>
            </div>

            {/* Micro tooltip detail on hover */}
            {isHovered && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 px-2.5 py-1 rounded-md bg-[#0a1124] border border-white/20 text-[10px] font-sans text-slate-200 whitespace-nowrap shadow-xl z-50">
                {token.desc}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
