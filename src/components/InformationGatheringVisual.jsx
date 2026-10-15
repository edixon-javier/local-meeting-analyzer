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
  CheckCircle2,
  Terminal,
  Search,
  Users
} from 'lucide-react';

export function InformationGatheringVisual() {
  const [activeToken, setActiveToken] = useState(null);

  // Silueta anatómica en forma de cerebro (Hemisferio Izquierdo y Derecho equilibrados hacia el centro)
  const tokens = [
    // --- Lóbulo Superior Central ---
    {
      id: 1,
      label: "Acuerdo: Lanzamiento v1.2",
      icon: CheckCircle2,
      color: "border-emerald-500/40 text-emerald-300 bg-emerald-950/40",
      glow: "shadow-[0_0_15px_rgba(16,185,129,0.35)]",
      pos: "top-2 left-1/2 -translate-x-1/2",
      x: 50,
      y: 5,
      delay: "1.4s",
      desc: "Compromiso clave acordado en la sesión"
    },

    // --- Hemisferio Izquierdo (Frontal -> Temporal medio -> Occipital -> Cerebelo) ---
    {
      id: 2,
      label: "Audio de la llamada",
      icon: Mic,
      color: "border-cyan-500/40 text-cyan-300 bg-cyan-950/40",
      glow: "shadow-[0_0_15px_rgba(6,182,212,0.35)]",
      pos: "top-[14%] left-[10%]",
      x: 20,
      y: 17,
      delay: "0s",
      desc: "Captura de altavoz y micrófono por WASAPI"
    },
    {
      id: 3,
      label: "Carlos (Tech Lead)",
      icon: User,
      color: "border-sky-500/40 text-sky-300 bg-sky-950/40",
      glow: "shadow-[0_0_15px_rgba(14,165,233,0.35)]",
      pos: "top-[32%] left-[2%]",
      x: 14,
      y: 35,
      delay: "2.8s",
      desc: "Hablante diarizado automáticamente"
    },
    {
      id: 4,
      label: "Diarización de voces",
      icon: Users,
      color: "border-indigo-500/40 text-indigo-300 bg-indigo-950/40",
      glow: "shadow-[0_0_15px_rgba(99,102,241,0.35)]",
      pos: "top-[50%] left-[0%] -translate-y-1/2",
      x: 12,
      y: 50,
      delay: "3.6s",
      desc: "Separación y renombrado en 1 clic"
    },
    {
      id: 5,
      label: "Minuta y Tareas Ollama",
      icon: Sparkles,
      color: "border-amber-500/40 text-amber-300 bg-amber-950/40",
      glow: "shadow-[0_0_15px_rgba(245,158,11,0.35)]",
      pos: "top-[68%] left-[4%]",
      x: 16,
      y: 69,
      delay: "1.7s",
      desc: "Resumen estructurado sin salir del PC"
    },
    {
      id: 6,
      label: "Búsqueda RAG en 2ms",
      icon: Search,
      color: "border-cyan-400/40 text-cyan-200 bg-cyan-950/40",
      glow: "shadow-[0_0_15px_rgba(6,182,212,0.3)]",
      pos: "bottom-[14%] left-[12%]",
      x: 24,
      y: 84,
      delay: "0.5s",
      desc: "Consultas semánticas instantáneas"
    },

    // --- Hemisferio Derecho (Frontal -> Temporal medio -> Occipital -> Cerebelo) ---
    {
      id: 7,
      label: "Whisper transcribiendo",
      icon: Cpu,
      color: "border-violet-500/40 text-violet-300 bg-violet-950/40",
      glow: "shadow-[0_0_15px_rgba(139,92,246,0.35)]",
      pos: "top-[14%] right-[10%]",
      x: 80,
      y: 17,
      delay: "0.9s",
      desc: "Transcripción palabra por palabra en CPU"
    },
    {
      id: 8,
      label: "Andrea: 'Aprobamos el alcance'",
      icon: MessageSquare,
      color: "border-fuchsia-500/40 text-fuchsia-300 bg-fuchsia-950/40",
      glow: "shadow-[0_0_15px_rgba(217,70,239,0.35)]",
      pos: "top-[32%] right-[2%]",
      x: 86,
      y: 35,
      delay: "2.1s",
      desc: "Cita vinculada al segundo exacto"
    },
    {
      id: 9,
      label: "Timestamp 00:01:38",
      icon: Clock,
      color: "border-rose-500/40 text-rose-300 bg-rose-950/40",
      glow: "shadow-[0_0_15px_rgba(244,63,94,0.35)]",
      pos: "top-[50%] right-[0%] -translate-y-1/2",
      x: 88,
      y: 50,
      delay: "3.3s",
      desc: "Offset temporal exacto en audio"
    },
    {
      id: 10,
      label: "Servidor MCP (stdio)",
      icon: Terminal,
      color: "border-violet-400/40 text-violet-200 bg-violet-950/40",
      glow: "shadow-[0_0_15px_rgba(139,92,246,0.3)]",
      pos: "top-[68%] right-[4%]",
      x: 84,
      y: 69,
      delay: "1.9s",
      desc: "Conexión a Claude Desktop y Cursor"
    },
    {
      id: 11,
      label: "Bóveda SQLite %APPDATA%",
      icon: HardDrive,
      color: "border-emerald-500/40 text-emerald-300 bg-emerald-950/40",
      glow: "shadow-[0_0_15px_rgba(16,185,129,0.35)]",
      pos: "bottom-[14%] right-[12%]",
      x: 76,
      y: 84,
      delay: "2.6s",
      desc: "Almacenamiento seguro en disco local"
    },

    // --- Lóbulo Inferior Central ---
    {
      id: 12,
      label: "0 KB enviados a la Nube",
      icon: ShieldCheck,
      color: "border-emerald-400/40 text-emerald-200 bg-emerald-950/40",
      glow: "shadow-[0_0_15px_rgba(16,185,129,0.35)]",
      pos: "bottom-2 left-1/2 -translate-x-1/2",
      x: 50,
      y: 95,
      delay: "1.2s",
      desc: "Tus datos nunca salen de tu ordenador"
    }
  ];

  return (
    <div className="relative w-full max-w-[580px] h-[520px] mx-auto flex items-center justify-center select-none overflow-visible">
      {/* Background radiant neural glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="w-[340px] h-[340px] rounded-full bg-gradient-to-tr from-cyan-500/15 via-blue-600/10 to-violet-600/15 blur-[85px]" />
      </div>

      {/* SVG Connecting Dashed Lines: Thin, subtle, and animated flowing to-and-fro */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
        <defs>
          <linearGradient id="beamLineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.75" />
            <stop offset="50%" stopColor="#8B5CF6" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0.75" />
          </linearGradient>

          <filter id="glowLine">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Brain outline / neural concentric rings */}
        <ellipse cx="50%" cy="50%" rx="120" ry="105" stroke="rgba(6, 182, 212, 0.2)" strokeWidth="0.8" strokeDasharray="3 3" fill="none" />
        <ellipse cx="50%" cy="50%" rx="190" ry="175" stroke="rgba(139, 92, 246, 0.15)" strokeWidth="0.8" strokeDasharray="4 4" fill="none" />

        {/* Dynamic interconnected lines between each thought and the central memory */}
        {tokens.map((token) => {
          const isTargeted = activeToken === token.id;
          return (
            <g key={token.id}>
              {/* Very thin dashed line going back and forth */}
              <line
                x1={`${token.x}%`}
                y1={`${token.y}%`}
                x2="50%"
                y2="50%"
                stroke="url(#beamLineGrad)"
                strokeWidth={isTargeted ? "1.6" : "0.9"}
                strokeDasharray="4 4"
                className={`transition-all duration-300 ${
                  isTargeted ? 'opacity-95 filter drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]' : 'opacity-25'
                }`}
              >
                {/* Traveling pulse animation going back and forth between node and core */}
                <animate
                  attributeName="stroke-dashoffset"
                  values="0; 32; 0"
                  dur="4.5s"
                  repeatCount="indefinite"
                  begin={token.delay}
                />
              </line>

              {/* Little traveling light packet dot along the dashed line */}
              <circle
                r={isTargeted ? "3" : "1.8"}
                fill="#38bdf8"
                className={isTargeted ? 'opacity-100' : 'opacity-40'}
              >
                <animateMotion
                  path={`M ${token.x * 5.8} ${token.y * 5.2} L 290 260 Z`}
                  dur="4s"
                  repeatCount="indefinite"
                  begin={token.delay}
                />
              </circle>
            </g>
          );
        })}
      </svg>

      {/* Central Memory Core: Nucleus of the brain cluster with official logo */}
      <div className="relative z-20 flex flex-col items-center justify-center p-5 rounded-2xl bg-[#091226]/90 border border-cyan-400/45 backdrop-blur-2xl shadow-[0_0_40px_-5px_rgba(6,182,212,0.5)] text-center max-w-[210px] transition-transform duration-300 hover:scale-105">
        <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-violet-600 p-[1.5px] flex items-center justify-center mb-2 shadow-glow-cyan overflow-hidden">
          <img
            src="/icon.png"
            alt="Local Meeting Analyzer"
            className="w-full h-full object-cover rounded-[10px]"
            onError={(e) => { e.currentTarget.src = '/assets/icon.png'; }}
          />
          <span className="absolute -inset-1 rounded-xl bg-cyan-400/30 blur-sm animate-ping opacity-60 pointer-events-none" />
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

      {/* Floating dispersed elements forming the brain lobes with dynamic hover elevation */}
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
            className={`absolute ${token.pos} z-30 animate-float cursor-pointer transition-all duration-300 ease-out ${
              isHovered ? '-translate-y-3.5 scale-110 z-50' : 'hover:-translate-y-2'
            }`}
          >
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-mono backdrop-blur-md transition-all duration-300 ${token.color} ${
                isHovered
                  ? 'brightness-125 shadow-[0_0_25px_rgba(6,182,212,0.65)] ring-1 ring-white/40'
                  : `${token.glow} hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]`
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
