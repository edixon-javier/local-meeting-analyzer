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
  Cpu,
  Radio,
  Sparkles
} from 'lucide-react';

export function BackgroundScatteredNotes() {
  const scatteredNotes = [
    // --- 1. Debajo del Header (Zona superior izquierda y derecha) ---
    {
      id: 1,
      text: "¿Quién tenía la minuta de ayer?",
      icon: MessageSquare,
      pos: "top-14 left-[6%]",
      rot: "-rotate-2",
      opacity: "opacity-35",
      delay: "0.2s"
    },
    {
      id: 2,
      text: "No subas el audio a la nube por privacidad",
      icon: Lock,
      pos: "top-12 right-[8%]",
      rot: "-rotate-3",
      opacity: "opacity-40",
      delay: "1.9s"
    },

    // --- 2. Lateral Izquierdo (Marcado con líneas rojas en la imagen) ---
    {
      id: 3,
      text: "Carlos: 'Quedamos en entregar el informe'",
      icon: User,
      pos: "top-36 left-[3%]",
      rot: "rotate-2",
      opacity: "opacity-30",
      delay: "1.5s"
    },
    {
      id: 4,
      text: "Silencia el micrófono, se escucha eco",
      icon: Mic,
      pos: "top-60 left-[2%]",
      rot: "-rotate-3",
      opacity: "opacity-30",
      delay: "2.7s"
    },
    {
      id: 5,
      text: "El bot nunca entró a la llamada",
      icon: AlertCircle,
      pos: "top-[78%] left-[2%]",
      rot: "rotate-2",
      opacity: "opacity-25",
      delay: "0.7s"
    },

    // --- 3. Lateral Derecho (Marcado con líneas rojas en la imagen) ---
    {
      id: 6,
      text: "Andrea: 'Confirmamos la aprobación'",
      icon: User,
      pos: "top-32 right-[4%]",
      rot: "-rotate-2",
      opacity: "opacity-35",
      delay: "2.4s"
    },
    {
      id: 7,
      text: "WASAPI Loopback sin drivers virtuales",
      icon: Headphones,
      pos: "top-56 right-[3%]",
      rot: "rotate-3",
      opacity: "opacity-30",
      delay: "0.6s"
    },
    {
      id: 8,
      text: "Faster-Whisper: 100% en CPU",
      icon: Cpu,
      pos: "top-[76%] right-[2%]",
      rot: "-rotate-2",
      opacity: "opacity-30",
      delay: "1.1s"
    },

    // --- 4. Debajo del Contenido Izquierdo (Puntitos rojos bajo los botones y confianza) ---
    {
      id: 9,
      text: "¿A qué minuto se acordó el presupuesto?",
      icon: Clock,
      pos: "top-[82%] left-[10%]",
      rot: "-rotate-1",
      opacity: "opacity-30",
      delay: "3.2s"
    },
    {
      id: 10,
      text: "00:03:15 Cita: 'Servicio sin dependencias'",
      icon: Clock,
      pos: "bottom-14 left-[5%]",
      rot: "rotate-2",
      opacity: "opacity-35",
      delay: "2.1s"
    },

    // --- 5. Zona Central Intermedia (Puntito rojo entre el texto y el diagrama) ---
    {
      id: 11,
      text: "Compromiso: revisión técnica el viernes",
      icon: CheckCircle2,
      pos: "top-[68%] left-[48%] -translate-x-1/2",
      rot: "rotate-1",
      opacity: "opacity-25",
      delay: "1.6s"
    },

    // --- 6. Zona Inferior y Derecha Baja (Puntitos rojos en la base y bajo la X) ---
    {
      id: 12,
      text: "¿Dónde quedó anotada la última tarea?",
      icon: Search,
      pos: "bottom-16 left-[36%]",
      rot: "-rotate-2",
      opacity: "opacity-25",
      delay: "0.4s"
    },
    {
      id: 13,
      text: "Archivos locales JSON en %APPDATA%",
      icon: FileText,
      pos: "bottom-6 left-[58%] -translate-x-1/2",
      rot: "rotate-1",
      opacity: "opacity-30",
      delay: "3.5s"
    },
    {
      id: 14,
      text: "0 KB de telemetría a servidores ajenos",
      icon: ShieldCheck,
      pos: "bottom-16 right-[12%]",
      rot: "-rotate-1",
      opacity: "opacity-35",
      delay: "1.8s"
    },
    {
      id: 15,
      text: "Ollama extrayendo minutas ejecutivas",
      icon: Sparkles,
      pos: "bottom-4 right-[4%]",
      rot: "rotate-2",
      opacity: "opacity-30",
      delay: "2.9s"
    }
  ];

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none">
      {/* Subtle radial contrast mask */}
      <div className="absolute inset-0 bg-radial-mask opacity-90" />

      {/* Floating scattered notes strategically placed at red slashes and dots */}
      {scatteredNotes.map((note) => {
        const Icon = note.icon;
        return (
          <div
            key={note.id}
            style={{
              animationDelay: note.delay,
            }}
            className={`absolute ${note.pos} ${note.rot} ${note.opacity} animate-float transition-all duration-500 hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.06] bg-slate-900/50 backdrop-blur-[2px] shadow-sm hover:opacity-75`}
          >
            <Icon className="w-3 h-3 text-cyan-400/80 shrink-0" />
            <span className="font-mono text-[10px] md:text-[11px] text-slate-300/85 whitespace-nowrap">
              {note.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}
