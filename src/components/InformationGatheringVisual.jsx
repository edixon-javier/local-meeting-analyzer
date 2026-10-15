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

  // Coordenadas relativas en porcentaje respecto al contenedor de 520px de alto
  const tokens = [
    {
      id: 1,
      label: "Audio de la llamada",
      icon: Mic,
      color: "border-cyan-500/40 text-cyan-300 bg-cyan-950/40",
      glow: "shadow-[0_0_15px_rgba(6,182,212,0.35)]",
      pos: "top-4 left-4",
      x: 18,
      y: 6,
      delay: "0s",
      desc: "Captura de altavoz y micrófono por WASAPI"
    },
    {
      id: 2,
      label: "Acuerdo: Lanzamiento v1.2",
      icon: CheckCircle2,
      color: "border-emerald-500/40 text-emerald-300 bg-emerald-950/40",
      glow: "shadow-[0_0_15px_rgba(16,185,129,0.35)]",
      pos: "top-2 right-12",
      x: 75,
      y: 5,
      delay: "1.4s",
      desc: "Compromiso clave acordado en la sesión"
    },
    {
      id: 3,
      label: "Carlos (Tech Lead)",
      icon: User,
      color: "border-sky-500/40 text-sky-300 bg-sky-950/40",
      glow: "shadow-[0_0_15px_rgba(14,165,233,0.35)]",
      pos: "top-20 left-0",
      x: 14,
      y: 24,
      delay: "2.8s",
      desc: "Hablante diarizado automáticamente"
    },
    {
      id: 4,
      label: "Whisper transcribiendo",
      icon: Cpu,
      color: "border-violet-500/40 text-violet-300 bg-violet-950/40",
      glow: "shadow-[0_0_15px_rgba(139,92,246,0.35)]",
      pos: "top-20 right-2",
      x: 82,
      y: 24,
      delay: "0.9s",
      desc: "Transcripción palabra por palabra en CPU"
    },
    {
      id: 5,
      label: "Andrea: 'Aprobamos el alcance'",
      icon: MessageSquare,
      color: "border-fuchsia-500/40 text-fuchsia-300 bg-fuchsia-950/40",
      glow: "shadow-[0_0_15px_rgba(217,70,239,0.35)]",
      pos: "top-44 right-0",
      x: 80,
      y: 45,
      delay: "2.1s",
      desc: "Cita vinculada al segundo exacto"
    },
    {
      id: 6,
      label: "Diarización de voces",
      icon: Users,
      color: "border-indigo-500/40 text-indigo-300 bg-indigo-950/40",
      pos: "top-44 left-2",
      glow: "shadow-[0_0_15px_rgba(99,102,241,0.35)]",
      x: 15,
      y: 45,
      delay: "3.6s",
      desc: "Separación y renombrado con 1 clic"
    },
    {
      id: 7,
      label: "Minuta y Tareas Ollama",
      icon: Sparkles,
      color: "border-amber-500/40 text-amber-300 bg-amber-950/40",
      glow: "shadow-[0_0_15px_rgba(245,158,11,0.35)]",
      pos: "bottom-28 left-4",
      x: 18,
      y: 72,
      delay: "1.7s",
      desc: "Resumen ejecutivo en segundos"
    },
    {
      id: 8,
      label: "Timestamp 00:01:38",
      icon: Clock,
      color: "border-rose-500/40 text-rose-300 bg-rose-950/40",
      glow: "shadow-[0_0_15px_rgba(244,63,94,0.35)]",
      pos: "bottom-28 right-4",
      x: 78,
      y: 72,
      delay: "3.3s",
      desc: "Offset temporal exacto en audio"
    },
    {
      id: 9,
      label: "Búsqueda RAG en 2ms",
      icon: Search,
      color: "border-cyan-400/40 text-cyan-200 bg-cyan-950/40",
      glow: "shadow-[0_0_15px_rgba(6,182,212,0.3)]",
      pos: "bottom-14 left-10",
      x: 25,
      y: 86,
      delay: "0.5s",
      desc: "Consultas semánticas instantáneas"
    },
    {
      id: 10,
      label: "Servidor MCP (stdio)",
      icon: Terminal,
      color: "border-violet-400/40 text-violet-200 bg-violet-950/40",
      glow: "shadow-[0_0_15px_rgba(139,92,246,0.3)]",
      pos: "bottom-14 right-10",
      x: 72,
      y: 86,
      delay: "1.9s",
      desc: "Conexión a Claude Desktop y Cursor"
    },
    {
      id: 11,
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
    <div className="relative w-full h-[520px] flex items-center justify-center select-none overflow-visible">
      {/* Background radiant glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="w-[320px] h-[320px] rounded-full bg-gradient-to-tr from-cyan-500/15 via-blue-600/10 to-violet-600/15 blur-[80px]" />
      </div>

      {/* SVG Connecting Dashed Lines: Thin, subtle, and animated flowing to-and-fro */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
        <defs>
          <linearGradient id="beamLineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.7" />
            <stop offset="50%" stopColor="#8B5CF6" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0.7" />
          </linearGradient>

          {/* Animated dashed pattern that goes back and forth (yendo y volviendo) */}
          <filter id="glowLine">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Orbit rings around memory core */}
        <circle cx="50%" cy="50%" r="90" stroke="rgba(6, 182, 212, 0.2)" strokeWidth="0.8" strokeDasharray="3 3" fill="none" />
        <circle cx="50%" cy="50%" r="160" stroke="rgba(139, 92, 246, 0.15)" strokeWidth="0.8" strokeDasharray="4 4" fill="none" />

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
                  isTargeted ? 'opacity-90 filter drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]' : 'opacity-25'
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
                  path={`M ${token.x * 5.2} ${token.y * 5.2} L 260 260 Z`}
                  dur="4s"
                  repeatCount="indefinite"
                  begin={token.delay}
                />
              </circle>
            </g>
          );
        })}
      </svg>

      {/* Central Memory Core: Represents organizing dispersed ideas into local memory */}
      <div className="relative z-20 flex flex-col items-center justify-center p-5 rounded-2xl bg-[#091226]/90 border border-cyan-400/40 backdrop-blur-2xl shadow-[0_0_40px_-5px_rgba(6,182,212,0.5)] text-center max-w-[210px] transition-transform duration-300 hover:scale-105">
        <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-violet-600 flex items-center justify-center text-white mb-2 shadow-glow-cyan">
          <Cpu className="w-6 h-6 animate-pulse" />
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
