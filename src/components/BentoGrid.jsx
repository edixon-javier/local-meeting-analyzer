import React, { useState } from 'react';
import { 
  Volume2, 
  Cpu, 
  BrainCircuit, 
  Terminal, 
  Users, 
  Search, 
  Sparkles,
  MousePointer2
} from 'lucide-react';

export function BentoGrid() {
  const [renamed, setRenamed] = useState(false);
  const [selectedModel, setSelectedModel] = useState('qwen3:4b');

  return (
    <section id="caracteristicas" className="py-24 md:py-32 relative bg-[#070A12] overflow-hidden">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-gradient-to-r from-violet-600/10 via-cyan-500/10 to-fuchsia-600/10 blur-[150px] rounded-full z-0" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Centered Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <h2 className="font-display font-semibold text-3xl sm:text-4xl text-white tracking-tight mb-3">
            Ingeniería Local-First Sin Concesiones
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm md:text-base leading-relaxed">
            Cada capacidad ha sido construida para correr 100% desconectada, manteniendo la máxima velocidad y total privacidad en tu ordenador.
          </p>
        </div>

        {/* --- Staggered Offset Grid matching exact reference design --- */}
        <div className="space-y-5">
          
          {/* Row 1: Ollama (Amber) | WASAPI Loopback (Cyan - Wider) | Whisper CPU (Violet) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
            
            {/* Card 1: Análisis Híbrido con Ollama (Amber) */}
            <div className="md:col-span-4 relative overflow-hidden rounded-2xl border border-amber-500/40 bg-[#0C1222]/90 backdrop-blur-xl p-6 transition-all duration-300 hover:border-amber-400 hover:shadow-[0_0_30px_-5px_rgba(245,158,11,0.45)] shadow-[0_0_20px_-5px_rgba(245,158,11,0.25)] flex flex-col justify-between group">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400">
                    <BrainCircuit className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-950/70 border border-amber-500/40 text-[10px] font-mono text-amber-300">
                    Ollama Local
                  </span>
                </div>
                <h3 className="font-display font-semibold text-base sm:text-lg text-white mb-2">
                  Análisis Híbrido con Ollama
                </h3>
                <p className="text-slate-300 text-xs leading-relaxed mb-6">
                  Extracción de acuerdos y minutas ejecutivas usando modelos abiertos para correr 100% en ordenador sin coste por token.
                </p>
              </div>

              {/* Model pills */}
              <div className="pt-2">
                <div className="text-[10px] font-mono text-slate-400 mb-1.5">Modelos soportados:</div>
                <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono">
                  {['qwen3:4b', 'phi3:mini', 'llama3.2:3b'].map((m) => (
                    <button
                      key={m}
                      onClick={() => setSelectedModel(m)}
                      className={`py-1 px-1 rounded-lg text-center transition-all ${
                        selectedModel === m
                          ? 'bg-amber-500/25 text-amber-300 border border-amber-500/60 font-semibold shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                          : 'bg-black/50 text-slate-400 hover:text-white border border-white/5'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Card 2: Grabación Loopback Nativa en Windows (Cyan/Teal - Center Wider) */}
            <div className="md:col-span-5 relative overflow-hidden rounded-2xl border border-cyan-400/50 bg-[#0A1628]/90 backdrop-blur-xl p-6 transition-all duration-300 hover:border-cyan-300 hover:shadow-[0_0_35px_-5px_rgba(6,182,212,0.55)] shadow-[0_0_25px_-5px_rgba(6,182,212,0.3)] flex flex-col justify-between group">
              {/* Subtle background audio waveform silhouette */}
              <div className="pointer-events-none absolute inset-x-0 bottom-12 top-14 opacity-15 flex items-center justify-center overflow-hidden">
                <svg className="w-full h-24" viewBox="0 0 400 100" fill="none">
                  <path d="M0 50 Q 50 10, 100 50 T 200 50 T 300 50 T 400 50" stroke="#06B6D4" strokeWidth="2" />
                  <path d="M0 50 Q 50 80, 100 50 T 200 50 T 300 50 T 400 50" stroke="#06B6D4" strokeWidth="1.5" />
                </svg>
              </div>

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                    <Volume2 className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-500/40 text-[10px] font-mono text-cyan-300">
                    WASAPI Direct Loopback
                  </span>
                </div>
                <h3 className="font-display font-semibold text-base sm:text-lg text-white mb-2">
                  Grabación Loopback Nativa en Windows
                </h3>
                <p className="text-slate-300 text-xs leading-relaxed mb-6">
                  Captura directa del audio de altavoces (Zoom, Meet, Teams) y micrófonos virtuales ni bots conectados.
                </p>
              </div>

              {/* Live audio bar visualizer */}
              <div className="relative z-10 p-3 rounded-xl bg-black/50 border border-cyan-500/25 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-300">
                  <span className="flex items-center gap-1.5 text-cyan-300 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    Audio del Sistema (Loopback)
                  </span>
                  <span className="text-cyan-400">48 kHz • 16-bit PCM</span>
                </div>
                <div className="flex items-center gap-1 h-5">
                  {[35, 65, 45, 80, 50, 75, 30, 85, 55, 40, 70, 45, 60, 80, 50, 35, 75, 60, 45, 30, 65, 50, 40, 60].map((val, idx) => (
                    <div
                      key={idx}
                      style={{ height: `${val}%` }}
                      className="flex-1 bg-gradient-to-t from-cyan-500 to-teal-300 rounded-sm opacity-85"
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Card 3: Whisper Optimizado en CPU (Violet/Purple) */}
            <div className="md:col-span-3 relative overflow-hidden rounded-2xl border border-purple-500/50 bg-[#0D1226]/90 backdrop-blur-xl p-6 transition-all duration-300 hover:border-purple-400 hover:shadow-[0_0_30px_-5px_rgba(168,85,247,0.45)] shadow-[0_0_20px_-5px_rgba(168,85,247,0.25)] flex flex-col justify-between group">
              {/* Background purple curved wave mesh */}
              <div className="pointer-events-none absolute -right-10 top-0 w-44 h-44 opacity-25">
                <svg viewBox="0 0 200 200" fill="none">
                  <path d="M0 40 Q 60 120, 160 40 T 200 160" stroke="#C084FC" strokeWidth="1" fill="none" />
                  <path d="M20 20 Q 80 140, 180 60 T 200 180" stroke="#A855F7" strokeWidth="0.8" fill="none" />
                  <path d="M40 0 Q 100 160, 200 80" stroke="#9333EA" strokeWidth="0.6" fill="none" />
                </svg>
              </div>

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/40 flex items-center justify-center text-purple-400">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-950/70 border border-purple-500/40 text-[10px] font-mono text-purple-300">
                    CTranslate2 INT8
                  </span>
                </div>
                <h3 className="font-display font-semibold text-base sm:text-lg text-white mb-2">
                  Whisper Optimizado en CPU
                </h3>
                <p className="text-slate-300 text-xs leading-relaxed mb-6">
                  Transcribe con Faster-Whisper aprovechando instrucciones SIMD/AVX2 sin requerir tarjeta gráfica dedicada.
                </p>
              </div>

              <div className="relative z-10 p-2.5 rounded-xl bg-black/50 border border-purple-500/20 space-y-1 font-mono text-[10px]">
                <div className="flex justify-between text-slate-300">
                  <span>Consumo RAM:</span>
                  <span className="text-emerald-400 font-semibold">~450 MB</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1 my-1">
                  <div className="bg-emerald-400 h-1 rounded-full w-1/4" />
                </div>
                <div className="flex justify-between text-slate-300 pt-0.5">
                  <span>Streaming en vivo:</span>
                  <span className="text-purple-300 font-medium">Baja latencia en CPU</span>
                </div>
              </div>
            </div>

          </div>

          {/* Row 2: Decorative Abstract Wave Mesh Card (Left) | Diarización (Neon Fuchsia - Center) | Servidor MCP (Indigo - Right) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
            
            {/* Decorative Luminous Wave Mesh Card (Left) */}
            <div className="md:col-span-4 relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-[#061120]/80 backdrop-blur-xl min-h-[220px] flex items-center justify-center shadow-[0_0_25px_-5px_rgba(6,182,212,0.2)]">
              {/* Abstract cyan/blue sine wave lines */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-70">
                <svg className="w-full h-full" viewBox="0 0 300 180" fill="none">
                  <defs>
                    <linearGradient id="waveMeshGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.8" />
                      <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.5" />
                      <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.2" />
                    </linearGradient>
                  </defs>
                  <path d="M-20 90 Q 60 10, 150 90 T 320 90" stroke="url(#waveMeshGrad)" strokeWidth="1.8" fill="none" />
                  <path d="M-20 100 Q 70 30, 160 100 T 320 100" stroke="url(#waveMeshGrad)" strokeWidth="1.2" fill="none" />
                  <path d="M-20 110 Q 80 50, 170 110 T 320 110" stroke="url(#waveMeshGrad)" strokeWidth="0.8" fill="none" />
                  <path d="M-20 120 Q 90 70, 180 120 T 320 120" stroke="url(#waveMeshGrad)" strokeWidth="0.6" fill="none" />
                </svg>
              </div>
              <div className="relative z-10 text-center px-6">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-[10px] font-mono text-cyan-300 mb-2">
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  <span>Audio Mesh Processing</span>
                </div>
                <div className="text-xs text-slate-300 font-mono">
                  Captura dual balanceada (Mic + Audio del sistema)
                </div>
              </div>
            </div>

            {/* Card 4: Diarización Inteligente (Neon Fuchsia / Pink - Highlighted Star Center) */}
            <div className="md:col-span-4 relative overflow-hidden rounded-2xl border-2 border-fuchsia-400 bg-[#140D26]/95 backdrop-blur-xl p-6 transition-all duration-300 shadow-[0_0_40px_-5px_rgba(217,70,239,0.7)] ring-1 ring-fuchsia-400/60 hover:shadow-[0_0_55px_-5px_rgba(217,70,239,0.85)] flex flex-col justify-between group">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-9 h-9 rounded-xl bg-fuchsia-500/20 border border-fuchsia-400 flex items-center justify-center text-fuchsia-300 shadow-[0_0_15px_rgba(217,70,239,0.5)]">
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-fuchsia-950/80 border border-fuchsia-400/80 text-[10px] font-mono text-fuchsia-200 font-semibold shadow-[0_0_10px_rgba(217,70,239,0.4)]">
                    1-Click Renaming
                  </span>
                </div>
                <h3 className="font-display font-semibold text-base sm:text-lg text-white mb-2">
                  Diarización Contextual
                </h3>
                <p className="text-slate-200 text-xs leading-relaxed mb-6">
                  Separación de turnos mediante análisis contextual del texto con IA. Renombra cualquier interlocutor en toda la conversación con un clic.
                </p>
              </div>

              {/* Interactive 1-click Renaming Button Demo */}
              <div className="relative pt-1">
                <button
                  onClick={() => setRenamed(!renamed)}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[#1C1236] border border-fuchsia-400/70 text-xs transition-all hover:bg-[#251846] shadow-[0_0_15px_rgba(217,70,239,0.3)] active:scale-[0.98]"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${renamed ? 'bg-emerald-400' : 'bg-fuchsia-400'} animate-pulse`} />
                    <span className="font-semibold text-white text-xs">
                      {renamed ? 'Carlos (Tech Lead)' : 'Speaker_01'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-fuchsia-950 text-fuchsia-200 text-[10px] font-mono border border-fuchsia-500/40">
                    <span>{renamed ? '✓ Renombrado' : '1-Click Renaming'}</span>
                    <MousePointer2 className="w-3 h-3 text-fuchsia-300" />
                  </div>
                </button>
              </div>
            </div>

            {/* Card 5: Servidor MCP Local Integrado (Indigo / Blue-Violet) */}
            <div className="md:col-span-4 relative overflow-hidden rounded-2xl border border-indigo-400/50 bg-[#0C1228]/90 backdrop-blur-xl p-6 transition-all duration-300 hover:border-indigo-300 hover:shadow-[0_0_30px_-5px_rgba(99,102,241,0.45)] shadow-[0_0_20px_-5px_rgba(99,102,241,0.25)] flex flex-col justify-between group">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                    <Terminal className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-950/70 border border-indigo-500/40 text-[10px] font-mono text-indigo-300">
                    Model Context Protocol
                  </span>
                </div>
                <h3 className="font-display font-semibold text-base sm:text-lg text-white mb-2">
                  Servidor MCP Local Integrado
                </h3>
                <p className="text-slate-300 text-xs leading-relaxed mb-6">
                  Conecta transcripciones, acuerdos y minutas con Claude Desktop, Cursor y Antigravity mediante servidor MCP local.
                </p>
              </div>

              {/* MCP Node connector badges */}
              <div className="p-2.5 rounded-xl bg-black/50 border border-indigo-500/25 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-[9px]">
                    LMA
                  </div>
                  <span className="text-[10px] font-mono text-indigo-300">Servidor MCP Local</span>
                </div>
                <div className="flex items-center gap-1.5 text-[9px] font-mono">
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-white/10 text-slate-300">Claude</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-white/10 text-slate-300">Cursor</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-cyan-500/40 text-cyan-300">Antigravity</span>
                </div>
              </div>
            </div>

          </div>

          {/* Row 3: Chat RAG en tu Historial (Emerald Green - Centered Offset) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 justify-center">
            <div className="md:col-start-4 md:col-span-6 relative overflow-hidden rounded-2xl border border-emerald-400/50 bg-[#07171E]/90 backdrop-blur-xl p-6 transition-all duration-300 hover:border-emerald-300 hover:shadow-[0_0_35px_-5px_rgba(16,185,129,0.5)] shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)] flex flex-col justify-between group">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <Search className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-500/40 text-[10px] font-mono text-emerald-300">
                    Bóveda Local JSON
                  </span>
                </div>
                <h3 className="font-display font-semibold text-base sm:text-lg text-white mb-2">
                  Chat RAG en tu Historial
                </h3>
                <p className="text-slate-300 text-xs leading-relaxed mb-5">
                  Búsqueda e interrogación semántica sobre todas las reuniones almacenadas en tu disco local.
                </p>
              </div>

              {/* RAG query preview pill */}
              <div className="p-2.5 rounded-xl bg-black/50 border border-emerald-500/25 flex items-center justify-between gap-2 text-[10px] font-mono">
                <span className="text-slate-300 truncate">"¿Quién asumió el release?"</span>
                <span className="px-2 py-0.5 rounded bg-emerald-950/90 text-emerald-300 text-[10px] shrink-0 border border-emerald-500/40 font-medium">
                  Búsqueda local instantánea
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
