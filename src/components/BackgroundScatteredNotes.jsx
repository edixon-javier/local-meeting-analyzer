import React from 'react';
import { 
  MessageSquare, 
  Clock, 
  User, 
  Mic, 
  ShieldCheck, 
  AlertCircle, 
  FileText, 
  CheckCircle2, 
  Lock,
  Headphones,
  Search,
  Cpu
} from 'lucide-react';

export function BackgroundScatteredNotes() {
  const scatteredNotes = [
    // --- Lado Izquierdo (bordes y laterales) ---
    {
      id: 1,
      text: "¿Quién tenía la minuta de ayer?",
      icon: MessageSquare,
      pos: "top-14 left-[2%]",
      rot: "-rotate-3",
      opacity: "opacity-30",
      delay: "0.2s"
    },
    {
      id: 2,
      text: "Carlos: 'Quedamos en entregar el informe'",
      icon: User,
      pos: "top-40 left-[1%]",
      rot: "rotate-2",
      opacity: "opacity-25",
      delay: "1.5s"
    },
    {
      id: 3,
      text: "Silencia el micrófono, se escucha eco",
      icon: Mic,
      pos: "top-64 left-[3%]",
      rot: "-rotate-2",
      opacity: "opacity-25",
      delay: "2.7s"
    },
    {
      id: 4,
      text: "¿A qué minuto se acordó el presupuesto?",
      icon: Clock,
      pos: "bottom-72 left-[2%]",
      rot: "rotate-3",
      opacity: "opacity-25",
      delay: "0.8s"
    },
    {
      id: 5,
      text: "El bot nunca entró a la videollamada",
      icon: AlertCircle,
      pos: "bottom-48 left-[4%]",
      rot: "-rotate-1",
      opacity: "opacity-30",
      delay: "3.2s"
    },

    // --- Lado Derecho (bordes y laterales) ---
    {
      id: 6,
      text: "No subas el audio a la nube por privacidad",
      icon: Lock,
      pos: "top-12 right-[2%]",
      rot: "rotate-2",
      opacity: "opacity-35",
      delay: "1.9s"
    },
    {
      id: 7,
      text: "Andrea: 'Confirmamos la aprobación'",
      icon: User,
      pos: "top-36 right-[1%]",
      rot: "-rotate-3",
      opacity: "opacity-30",
      delay: "2.4s"
    },
    {
      id: 8,
      text: "WASAPI Loopback sin drivers virtuales",
      icon: Headphones,
      pos: "top-60 right-[3%]",
      rot: "rotate-1",
      opacity: "opacity-25",
      delay: "0.6s"
    },
    {
      id: 9,
      text: "00:03:15 Cita: 'Servicio sin nube'",
      icon: Clock,
      pos: "bottom-72 right-[2%]",
      rot: "-rotate-2",
      opacity: "opacity-30",
      delay: "3.5s"
    },
    {
      id: 10,
      text: "Faster-Whisper: 100% en CPU",
      icon: Cpu,
      pos: "bottom-48 right-[3%]",
      rot: "rotate-2",
      opacity: "opacity-30",
      delay: "1.1s"
    },

    // --- Parte Inferior (distribuidas a lo ancho de la base) ---
    {
      id: 11,
      text: "¿Dónde quedó anotada la última decisión?",
      icon: Search,
      pos: "bottom-24 left-[8%]",
      rot: "-rotate-2",
      opacity: "opacity-25",
      delay: "2.1s"
    },
    {
      id: 12,
      text: "Compromiso: revisión técnica el viernes",
      icon: CheckCircle2,
      pos: "bottom-10 left-[22%]",
      rot: "rotate-1",
      opacity: "opacity-30",
      delay: "1.6s"
    },
    {
      id: 13,
      text: "Base de datos local en %APPDATA%",
      icon: FileText,
      pos: "bottom-6 left-[46%] -translate-x-1/2",
      rot: "-rotate-1",
      opacity: "opacity-25",
      delay: "3.0s"
    },
    {
      id: 14,
      text: "Ollama extrayendo minutas ejecutivas",
      icon: ShieldCheck,
      pos: "bottom-12 right-[22%]",
      rot: "rotate-2",
      opacity: "opacity-30",
      delay: "0.4s"
    },
    {
      id: 15,
      text: "0 KB de telemetría a servidores ajenos",
      icon: Lock,
      pos: "bottom-24 right-[8%]",
      rot: "-rotate-3",
      opacity: "opacity-35",
      delay: "2.3s"
    }
  ];

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none">
      {/* Subtle radial contrast mask so foreground reading is always crisp */}
      <div className="absolute inset-0 bg-radial-mask opacity-90" />

      {/* Floating scattered notes located on the sides and bottom */}
      {scatteredNotes.map((note) => {
        const Icon = note.icon;
        return (
          <div
            key={note.id}
            style={{
              animationDelay: note.delay,
            }}
            className={`absolute ${note.pos} ${note.rot} ${note.opacity} animate-float transition-opacity duration-500 hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.05] bg-slate-900/40 backdrop-blur-[2px] shadow-sm`}
          >
            <Icon className="w-3 h-3 text-cyan-400/70 shrink-0" />
            <span className="font-mono text-[10px] md:text-[11px] text-slate-300/80 whitespace-nowrap">
              {note.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}
