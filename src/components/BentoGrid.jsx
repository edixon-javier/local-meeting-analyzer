import React, { useState } from 'react';
import { 
  Volume2, 
  Cpu, 
  BrainCircuit, 
  Terminal, 
  Users, 
  Search, 
  Check, 
  Sparkles
} from 'lucide-react';
import { SpotlightCard } from './SpotlightCard';

export function BentoGrid() {
  const [renamed, setRenamed] = useState(false);
  const [selectedModel, setSelectedModel] = useState('qwen2.5:7b');

  return (
    <section id="caracteristicas" className="py-20 md:py-28 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header (Condensed, cohesive, clear) */}
        <div className="text-left mb-10 max-w-3xl">
          <h2 className="font-display font-semibold text-2xl sm:text-3xl text-white tracking-tight mb-2">
            Ingeniería Local-First Sin Concesiones
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
            Cada capacidad ha sido construida para correr 100% desconectada, manteniendo la máxima velocidad y total privacidad en tu ordenador.
          </p>
        </div>

        {/* Condensed cohesive Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Card 1 (Span 2 on lg): Grabación Loopback Nativa */}
          <div className="lg:col-span-2">
            <SpotlightCard className="h-full flex flex-col justify-between" glowColor="rgba(6, 182, 212, 0.2)">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Volume2 className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-[10px] font-mono text-cyan-300">
                    WASAPI Direct Loopback
                  </span>
                </div>
                <h3 className="font-display font-semibold text-lg text-white mb-1.5">
                  Grabación Loopback Nativa en Windows
                </h3>
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-5">
                  Captura directa del audio de altavoces (Zoom, Meet, Teams) y micrófono físico sin controladores virtuales ni bots conectados.
                </p>
              </div>

              {/* Micro visual: audio wave */}
              <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span className="flex items-center gap-1.5 text-cyan-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    Audio del Sistema (Loopback)
                  </span>
                  <span className="text-emerald-400 text-[10px]">48 kHz • 16-bit PCM</span>
                </div>
                <div className="flex items-center gap-1 h-7">
                  {[35, 65, 45, 80, 50, 75, 30, 85, 55, 40, 70, 45, 60, 80, 50, 35, 75, 60, 45, 30, 65, 50].map((val, idx) => (
                    <div
                      key={idx}
                      style={{ height: `${val}%` }}
                      className="flex-1 bg-gradient-to-t from-cyan-500 to-blue-400 rounded-sm opacity-80"
                    />
                  ))}
                </div>
              </div>
            </SpotlightCard>
          </div>

          {/* Card 2: Faster-Whisper en CPU */}
          <div>
            <SpotlightCard className="h-full flex flex-col justify-between" glowColor="rgba(59, 130, 246, 0.2)">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-950/80 border border-blue-500/30 text-[10px] font-mono text-blue-300">
                    CTranslate2 INT8
                  </span>
                </div>
                <h3 className="font-display font-semibold text-lg text-white mb-1.5">
                  Whisper Optimizado en CPU
                </h3>
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-4">
                  Transcribe con Faster-Whisper aprovechando instrucciones SIMD/AVX2 sin requerir tarjeta gráfica dedicada.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between text-slate-400">
                  <span>Consumo RAM:</span>
                  <span className="text-emerald-400">~450 MB</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5">
                  <div className="bg-emerald-400 h-1.5 rounded-full w-1/4" />
                </div>
                <div className="flex justify-between text-slate-400 pt-0.5">
                  <span>Latencia streaming:</span>
                  <span className="text-cyan-300">&lt; 0.8s en CPU</span>
                </div>
              </div>
            </SpotlightCard>
          </div>

          {/* Card 3: Diarización Inteligente */}
          <div>
            <SpotlightCard className="h-full flex flex-col justify-between" glowColor="rgba(217, 70, 239, 0.2)">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-400">
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-fuchsia-950/80 border border-fuchsia-500/30 text-[10px] font-mono text-fuchsia-300">
                    1-Click Renaming
                  </span>
                </div>
                <h3 className="font-display font-semibold text-lg text-white mb-1.5">
                  Diarización Inteligente
                </h3>
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-4">
                  Distingue interlocutores en la llamada. Renombra cualquier hablante en toda la conversación con un solo clic.
                </p>
              </div>

              {/* Interactive Renaming Demo */}
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                <button
                  onClick={() => setRenamed(!renamed)}
                  className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-fuchsia-500/40 text-xs transition-all hover:bg-slate-800"
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${renamed ? 'bg-emerald-400' : 'bg-fuchsia-400'}`} />
                    <span className="font-semibold text-white text-[11px]">
                      {renamed ? 'Carlos (Tech Lead)' : 'Speaker_01'}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-fuchsia-300 bg-fuchsia-950/80 px-2 py-0.5 rounded">
                    {renamed ? '✓ Renombrado' : 'Clic aquí'}
                  </span>
                </button>
              </div>
            </SpotlightCard>
          </div>

          {/* Card 4 (Span 2 on lg): Servidor MCP Local */}
          <div className="lg:col-span-2">
            <SpotlightCard className="h-full flex flex-col justify-between" glowColor="rgba(139, 92, 246, 0.22)">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400">
                    <Terminal className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-violet-950/80 border border-violet-500/30 text-[10px] font-mono text-violet-300">
                    Model Context Protocol
                  </span>
                </div>
                <h3 className="font-display font-semibold text-lg text-white mb-1.5">
                  Servidor MCP Local Integrado
                </h3>
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-5">
                  Conecta transcripciones, acuerdos y minutas con Claude Desktop, Cursor y Antigravity mediante transporte stdio/SSE con latencia instantánea.
                </p>
              </div>

              {/* MCP Node connector */}
              <div className="p-3 rounded-xl bg-[#090e1f] border border-violet-500/20 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center text-white font-bold text-[10px]">
                    LMA
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400">Servidor MCP stdio activo</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono">
                  <span className="px-2.5 py-1 rounded bg-slate-900 border border-white/10 text-slate-300">Claude</span>
                  <span className="px-2.5 py-1 rounded bg-slate-900 border border-white/10 text-slate-300">Cursor</span>
                  <span className="px-2.5 py-1 rounded bg-slate-900 border border-cyan-500/30 text-cyan-300">Antigravity</span>
                </div>
              </div>
            </SpotlightCard>
          </div>

          {/* Card 5: Análisis con Ollama */}
          <div>
            <SpotlightCard className="h-full flex flex-col justify-between" glowColor="rgba(245, 158, 11, 0.2)">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <BrainCircuit className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/30 text-[10px] font-mono text-amber-300">
                    Ollama Local
                  </span>
                </div>
                <h3 className="font-display font-semibold text-lg text-white mb-1.5">
                  Análisis Híbrido con Ollama
                </h3>
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-4">
                  Extracción de acuerdos y minutas ejecutivas usando modelos abiertos que corren 100% en tu ordenador sin coste por token.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-1.5">
                <div className="text-[10px] font-mono text-slate-400">Modelos soportados:</div>
                <div className="grid grid-cols-3 gap-1 text-[10px] font-mono">
                  {['qwen2.5:7b', 'phi3:mini', 'llama3.2:3b'].map((m) => (
                    <button
                      key={m}
                      onClick={() => setSelectedModel(m)}
                      className={`py-1 px-1 rounded text-center transition-all ${
                        selectedModel === m
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-white/5'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </SpotlightCard>
          </div>

          {/* Card 6: Chat RAG Local */}
          <div>
            <SpotlightCard className="h-full flex flex-col justify-between" glowColor="rgba(16, 185, 129, 0.2)">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Search className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-[10px] font-mono text-emerald-300">
                    SQLite FTS5
                  </span>
                </div>
                <h3 className="font-display font-semibold text-lg text-white mb-1.5">
                  Chat RAG en tu Historial
                </h3>
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-4">
                  Búsqueda semántica instantánea sobre todas tus reuniones almacenadas en <code className="text-emerald-300 bg-emerald-950/60 px-1 py-0.5 rounded text-[11px]">%APPDATA%</code>.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between gap-2 text-[11px] font-mono">
                <span className="text-slate-400 truncate">"¿Quién asumió el release?"</span>
                <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 text-[10px] shrink-0 border border-emerald-500/30">
                  Encontrado en 2ms
                </span>
              </div>
            </SpotlightCard>
          </div>

        </div>

      </div>
    </section>
  );
}
