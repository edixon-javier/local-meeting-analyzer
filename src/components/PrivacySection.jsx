import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Ban, 
  Check, 
  HardDrive, 
  Cpu, 
  Mic, 
  AlertTriangle,
  Database,
  ShieldAlert,
  Radio
} from 'lucide-react';

export function PrivacySection() {
  const [hoveredRow, setHoveredRow] = useState(null);
  const [pingBlocked, setPingBlocked] = useState(false);
  const [counter, setCounter] = useState(0);

  // Trigger deflection animation
  const handleSimulateAttack = () => {
    setPingBlocked(true);
    setTimeout(() => setPingBlocked(false), 2500);
  };

  const comparisonRows = [
    {
      feature: "¿Dónde se procesa el audio?",
      local: "100% en tu CPU (Faster-Whisper)",
      cloud: "En servidores remotos de terceros (OpenAI, AWS)",
      detail: "Las herramientas cloud envían cada segundo de audio de tu micrófono y de tus compañeros a centros de datos externos."
    },
    {
      feature: "Presencia en la videollamada",
      local: "Sin bots • Captura silenciosa por WASAPI",
      cloud: "Bot visible obligatorio en la sala (Otter.ai, etc.)",
      detail: "No requiere invitar ni admitir participantes artificiales en la llamada."
    },
    {
      feature: "Almacenamiento de transcripciones",
      local: "Tu disco duro local (%APPDATA% / SQLite)",
      cloud: "Bases de datos en la nube del proveedor",
      detail: "Base de datos SQLite cifrable localmente sin sincronización forzada."
    },
    {
      feature: "Uso de tus datos para entrenar modelos",
      local: "0% — Garantía técnica por diseño",
      cloud: "Sujeto a cambios en sus Términos de Servicio",
      detail: "Modelos abiertos en Ollama ejecutados localmente sin telemetría de retorno."
    },
    {
      feature: "Modelo de costes y suscripciones",
      local: "Gratuito y Libre (Licencia AGPL-3.0)",
      cloud: "$15 a $40 / mes por cada usuario",
      detail: "Software libre sin límites de minutos, sin marcas de agua ni muros de pago."
    },
    {
      feature: "Acceso sin conexión (Offline)",
      local: "Funcional al 100% sin Internet",
      cloud: "Inutilizable si se cae la conexión",
      detail: "Ideal para aviones, salas de juntas blindadas o conexiones con proxy restringido."
    },
    {
      feature: "Integración con asistentes locales",
      local: "Servidor MCP Local (Claude Desktop, Cursor)",
      cloud: "APIs propietarias cerradas en la nube",
      detail: "Protocolo MCP nativo (stdio/SSE) con latencia menor a 2 milisegundos."
    }
  ];

  return (
    <section id="privacidad" className="py-20 md:py-28 relative bg-[#060913] border-t border-b border-white/[0.06]">
      {/* Background ambient glow */}
      <div className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-emerald-500/10 blur-[140px] rounded-full z-0" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header (No top banner, subtle typography) */}
        <div className="text-left mb-12 max-w-3xl">
          <h2 className="font-display font-semibold text-2xl sm:text-3xl lg:text-4xl text-white tracking-tight mb-2">
            Tus Secretos Comerciales Pertenecen a tu Empresa
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm md:text-base leading-relaxed">
            Las herramientas de transcripción convencionales suben el audio confidencial de tus llamadas a servidores ajenos. Local Meeting Analyzer garantiza por arquitectura física que ningún byte sale de tu ordenador.
          </p>
        </div>

        {/* Animated Architecture Dataflow Diagram */}
        <div className="mb-16 p-6 md:p-8 rounded-2xl border border-emerald-500/30 bg-[#0A1224]/90 backdrop-blur-xl shadow-[0_0_50px_-15px_rgba(16,185,129,0.25)]">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6 relative">
            
            {/* Step 1: Input Audio */}
            <div className="flex flex-col items-center text-center w-full lg:w-1/4 p-4 rounded-xl bg-slate-900/90 border border-white/10 shadow-lg">
              <div className="relative w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-400 mb-2">
                <Mic className="w-6 h-6" />
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-cyan-400 animate-ping" />
              </div>
              <h4 className="font-medium text-white text-xs sm:text-sm mb-1">Entrada de Audio</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Zoom, Teams, Meet + Micrófono físico capturados directamente por WASAPI.
              </p>
              <span className="mt-2 text-[10px] font-mono text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/20">
                WASAPI Loopback
              </span>
            </div>

            {/* Connecting Beam 1 with pulsating dots */}
            <div className="flex flex-col items-center text-cyan-400 font-mono text-xs">
              <span className="text-[10px] text-slate-400 mb-0.5">Buffer PCM</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-pulse" />
                <span className="hidden lg:inline text-cyan-400 font-bold">─────►</span>
                <span className="lg:hidden text-cyan-400 font-bold">▼</span>
              </div>
            </div>

            {/* Step 2: Local Processing Engine */}
            <div className="flex flex-col items-center text-center w-full lg:w-1/3 p-5 rounded-xl bg-gradient-to-b from-[#0F1C38] to-[#0A1226] border-2 border-emerald-500/50 shadow-[0_0_35px_-5px_rgba(16,185,129,0.35)] relative">
              <div className="absolute -top-3 px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[9px] font-mono font-bold tracking-wider uppercase">
                En tu Máquina (100% Offline)
              </div>
              <div className="w-14 h-14 rounded-xl bg-emerald-500/20 border border-emerald-500/60 flex items-center justify-center text-emerald-300 mb-2 mt-1 shadow-glow-emerald">
                <Cpu className="w-7 h-7" />
              </div>
              <h4 className="font-semibold text-white text-sm mb-0.5">Faster-Whisper &amp; Ollama</h4>
              <p className="text-[11px] text-slate-300 leading-relaxed mb-2">
                Procesamiento local en CPU mediante cuantización INT8 y modelos abiertos.
              </p>
              <div className="flex items-center gap-1.5 text-[10px] font-mono">
                <span className="bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  0 KB enviados a Internet
                </span>
              </div>
            </div>

            {/* Connecting Beam 2 */}
            <div className="flex flex-col items-center text-emerald-400 font-mono text-xs">
              <span className="text-[10px] text-slate-400 mb-0.5">SQLite FTS5</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                <span className="hidden lg:inline text-emerald-400 font-bold">─────►</span>
                <span className="lg:hidden text-emerald-400 font-bold">▼</span>
              </div>
            </div>

            {/* Step 3: Local Storage Vault */}
            <div className="flex flex-col items-center text-center w-full lg:w-1/4 p-4 rounded-xl bg-slate-900/90 border border-white/10 shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-violet-500/15 border border-violet-500/40 flex items-center justify-center text-violet-400 mb-2">
                <Database className="w-6 h-6" />
              </div>
              <h4 className="font-medium text-white text-xs sm:text-sm mb-1">Bóveda en Disco</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Minutas, RAG y transcripciones guardadas únicamente en tu directorio local.
              </p>
              <span className="mt-2 text-[10px] font-mono text-violet-300 bg-violet-950/60 px-2 py-0.5 rounded border border-violet-500/20">
                %APPDATA%
              </span>
            </div>
          </div>

          {/* Blocked external cloud connection line with interactive deflection animation */}
          <div className="mt-6 pt-5 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 bg-red-950/20 p-4 rounded-xl border border-red-500/20">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300 ${
                pingBlocked ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400' : 'bg-red-500/20 border border-red-500/40 text-red-400'
              }`}>
                {pingBlocked ? <ShieldCheck className="w-5 h-5 animate-bounce" /> : <Ban className="w-4 h-4" />}
              </div>
              <div>
                <div className="text-xs font-medium text-white">Servidores Externos &amp; Nube Pública</div>
                <div className="text-[11px] text-slate-400">
                  {pingBlocked ? '¡Intento de conexión repelido y bloqueado por firewall local!' : 'Sin conexiones de telemetría, analítica ni envío de audio.'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSimulateAttack}
                className="px-2.5 py-1 rounded bg-slate-900 border border-red-500/40 text-[10px] font-mono text-red-300 hover:bg-red-950/40 transition-colors active:scale-95"
              >
                Probar Bloqueo Cloud
              </button>
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                <Lock className="w-3 h-3" />
                <span>Bloqueado por Diseño</span>
              </div>
            </div>
          </div>
        </div>

        {/* High Contrast Comparison Matrix */}
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0B1124] shadow-2xl">
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead>
              <tr className="border-b border-white/10 bg-slate-900/60">
                <th className="p-4 text-xs sm:text-sm font-semibold text-slate-300 w-1/3">
                  Criterio de Privacidad &amp; Rendimiento
                </th>
                <th className="p-4 text-xs sm:text-sm font-bold text-emerald-300 bg-gradient-to-b from-emerald-500/20 to-emerald-950/30 border-l border-r border-emerald-500/30 w-1/3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Local Meeting Analyzer</span>
                    </div>
                    <span className="text-[9px] font-mono uppercase bg-emerald-400 text-slate-950 px-2 py-0.5 rounded font-bold">
                      Recomendado
                    </span>
                  </div>
                </th>
                <th className="p-4 text-xs sm:text-sm font-semibold text-slate-400 w-1/3">
                  Herramientas en la Nube (Otter, Fireflies, etc.)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs sm:text-sm">
              {comparisonRows.map((row, idx) => (
                <tr
                  key={idx}
                  onMouseEnter={() => setHoveredRow(idx)}
                  onMouseLeave={() => setHoveredRow(null)}
                  className={`transition-colors ${hoveredRow === idx ? 'bg-white/[0.03]' : ''}`}
                >
                  <td className="p-4 font-medium text-white">
                    <div className="text-xs sm:text-sm">{row.feature}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{row.detail}</div>
                  </td>
                  <td className="p-4 font-medium text-emerald-200 bg-gradient-to-b from-emerald-500/10 to-transparent border-l border-r border-emerald-500/30">
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3] shrink-0" />
                      <span className="text-xs sm:text-sm">{row.local}</span>
                    </div>
                  </td>
                  <td className="p-4 text-slate-400">
                    <div className="flex items-center gap-2 text-rose-300/90 text-xs sm:text-sm">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>{row.cloud}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
