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
  Lock
} from 'lucide-react';

export function BackgroundScatteredNotes() {
  const scatteredNotes = [
    {
      id: 1,
      text: "¿Quién tenía la minuta de la reunión de ayer?",
      icon: MessageSquare,
      pos: "top-10 left-[4%]",
      rot: "-rotate-3",
      opacity: "opacity-30",
      delay: "0.2s"
    },
    {
      id: 2,
      text: "Carlos: 'Quedamos en entregar el release el jueves'",
      icon: User,
      pos: "top-24 left-[28%]",
      rot: "rotate-2",
      opacity: "opacity-25",
      delay: "1.5s"
    },
    {
      id: 3,
      text: "No subas el audio a la nube por confidencialidad",
      icon: Lock,
      pos: "top-8 right-[8%]",
      rot: "-rotate-2",
      opacity: "opacity-35",
      delay: "2.7s"
    },
    {
      id: 4,
      text: "¿A qué minuto se acordó el presupuesto?",
      icon: Clock,
      pos: "top-40 right-[22%]",
      rot: "rotate-3",
      opacity: "opacity-25",
      delay: "0.8s"
    },
    {
      id: 5,
      text: "Andrea: 'El cliente confirmó el nuevo contrato'",
      icon: User,
      pos: "top-56 left-[6%]",
      rot: "rotate-1",
      opacity: "opacity-30",
      delay: "3.2s"
    },
    {
      id: 6,
      text: "Silencia el micrófono, se escucha eco en la sala",
      icon: Mic,
      pos: "top-72 left-[34%]",
      rot: "-rotate-4",
      opacity: "opacity-20",
      delay: "1.9s"
    },
    {
      id: 7,
      text: "00:03:15 Cita textual: 'Servicio sin dependencias'",
      icon: Clock,
      pos: "bottom-48 left-[12%]",
      rot: "rotate-2",
      opacity: "opacity-30",
      delay: "2.4s"
    },
    {
      id: 8,
      text: "El bot de transcripción nunca entró a la llamada",
      icon: AlertCircle,
      pos: "bottom-36 left-[38%]",
      rot: "-rotate-1",
      opacity: "opacity-25",
      delay: "0.6s"
    },
    {
      id: 9,
      text: "Acuerdo: Loopback WASAPI nativo en Windows",
      icon: CheckCircle2,
      pos: "bottom-52 right-[12%]",
      rot: "rotate-3",
      opacity: "opacity-30",
      delay: "3.5s"
    },
    {
      id: 10,
      text: "Base de datos guardada en %APPDATA%\\history.db",
      icon: FileText,
      pos: "bottom-28 right-[32%]",
      rot: "-rotate-2",
      opacity: "opacity-25",
      delay: "1.1s"
    },
    {
      id: 11,
      text: "¿Dónde quedó anotada la última tarea de DevOps?",
      icon: MessageSquare,
      pos: "bottom-12 left-[18%]",
      rot: "rotate-1",
      opacity: "opacity-25",
      delay: "2.1s"
    },
    {
      id: 12,
      text: "Faster-Whisper: 100% CPU sin tarjeta gráfica",
      icon: ShieldCheck,
      pos: "bottom-10 right-[6%]",
      rot: "-rotate-3",
      opacity: "opacity-30",
      delay: "1.6s"
    }
  ];

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none">
      {/* Subtle radial contrast mask so foreground reading is always crisp */}
      <div className="absolute inset-0 bg-radial-mask opacity-90" />

      {/* Floating scattered notes */}
      {scatteredNotes.map((note) => {
        const Icon = note.icon;
        return (
          <div
            key={note.id}
            style={{
              animationDelay: note.delay,
            }}
            className={`absolute ${note.pos} ${note.rot} ${note.opacity} animate-float transition-opacity duration-500 hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.06] bg-slate-900/50 backdrop-blur-[2px] shadow-sm`}
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
