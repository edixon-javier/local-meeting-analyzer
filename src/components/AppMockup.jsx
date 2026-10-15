import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Sparkles, 
  MessageSquare, 
  Terminal, 
  CheckCircle2, 
  Cpu, 
  Volume2,
  Clock
} from 'lucide-react';

export function AppMockup() {
  const [activeTab, setActiveTab] = useState('transcription');
  const [streamingText, setStreamingText] = useState('');
  const fullStreamingText = "El motor Faster-Whisper local procesa los chunks de audio en CPU con latencia sub-segundo sin saturar el sistema...";

  // Simulated live SSE streaming
  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      setStreamingText(fullStreamingText.slice(0, index));
      index = (index + 1) % (fullStreamingText.length + 15);
    }, 45);
    return () => clearInterval(interval);
  }, []);

  const tabs = [
    { id: 'transcription', label: 'Transcripción en Vivo', icon: FileText },
    { id: 'insights', label: 'Minuta Ejecutiva IA', icon: Sparkles },
    { id: 'chat', label: 'Chat RAG Interactivo', icon: MessageSquare },
    { id: 'mcp', label: 'Servidor MCP Local', icon: Terminal },
  ];

  return (
    <div className="relative mx-auto w-full rounded-2xl border border-white/10 bg-[#0F1629]/90 backdrop-blur-2xl shadow-2xl shadow-cyan-950/30 overflow-hidden">
      {/* Chrome Window Top Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#091022] border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
          <span className="ml-3 text-[11px] font-mono text-slate-400 hidden sm:inline">
            Local Meeting Analyzer — Sesión de Revisión de Arquitectura
          </span>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <Cpu className="w-3 h-3 text-emerald-400" />
          <span>Motor Local Activo</span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center border-b border-white/[0.08] bg-[#0c142b]/60 px-2 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-3 text-xs font-medium transition-all whitespace-nowrap ${
                isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Window Body */}
      <div className="p-5 md:p-6 min-h-[320px] bg-[#070d1e]/80">
        {/* Tab 1: Live Transcription */}
        {activeTab === 'transcription' && (
          <div className="space-y-3.5">
            {/* Live Recording Indicator Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-900/90 border border-cyan-500/20">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
                </span>
                <span className="text-xs text-slate-300 font-medium">
                  Grabando Audio del Sistema (Loopback WASAPI) + Micrófono
                </span>
              </div>

              {/* Dynamic Soundwave Bars */}
              <div className="flex items-center gap-1">
                {[16, 24, 12, 28, 20, 10, 22, 14, 26, 18].map((h, i) => (
                  <span
                    key={i}
                    style={{
                      height: `${h}px`,
                      animationDelay: `${i * 0.15}s`,
                    }}
                    className="w-1 bg-gradient-to-t from-cyan-500 to-blue-400 rounded-full animate-pulse"
                  />
                ))}
              </div>
            </div>

            {/* Transcript Bubbles */}
            <div className="space-y-2.5 font-sans">
              <div className="p-3 rounded-xl bg-[#0F1833] border border-white/5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-cyan-300">Carlos (Tech Lead)</span>
                  <span className="text-[10px] font-mono text-slate-400">00:01:14</span>
                </div>
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                  Iniciamos la revisión del nuevo servicio de audio. Confirmamos que la captura loopback en Windows no requiere controladores virtuales adicionales ni bots intrusivos en la llamada.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#0F1833] border border-white/5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-violet-300">Andrea (Product Owner)</span>
                  <span className="text-[10px] font-mono text-slate-400">00:01:38</span>
                </div>
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                  Excelente. Lo fundamental es que ningún archivo de audio viaje a servidores externos a menos que el usuario habilite explícitamente un proveedor remoto. Toda la diarización corre en el PC.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#111c3d] border-l-2 border-cyan-400 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-cyan-300">Carlos (Tech Lead)</span>
                  <span className="text-[10px] font-mono text-cyan-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                    Transmitiendo SSE en vivo
                  </span>
                </div>
                <p className="text-cyan-100 font-mono text-xs leading-relaxed">
                  {streamingText}
                  <span className="inline-block w-1.5 h-3.5 bg-cyan-400 animate-pulse ml-1 align-middle" />
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: AI Insights */}
        {activeTab === 'insights' && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-400" />
                <span className="font-medium text-white text-xs sm:text-sm">Minuta Ejecutiva Generada por Ollama (qwen2.5:7b)</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                0 Tokens en la Nube
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-white/5 space-y-2">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Decisiones Clave Acordadas
                </h4>
                <ul className="text-xs text-slate-300 space-y-1 list-disc pl-4 leading-relaxed">
                  <li>Captura de audio vía WASAPI Loopback 100% nativa.</li>
                  <li>Almacenamiento permanente en SQLite local dentro de <code className="text-cyan-200 bg-cyan-950/40 px-1 py-0.5 rounded text-[11px]">%APPDATA%</code>.</li>
                  <li>Exposición de herramientas mediante servidor local MCP.</li>
                </ul>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-white/5 space-y-2">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-violet-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Tareas &amp; Compromisos
                </h4>
                <div className="space-y-1.5 text-xs text-slate-300">
                  <label className="flex items-center gap-2 p-1 rounded bg-white/[0.02]">
                    <input type="checkbox" defaultChecked className="accent-cyan-500 rounded" />
                    <span>Fallback WASAPI en modo desconectado <strong>(Carlos)</strong></span>
                  </label>
                  <label className="flex items-center gap-2 p-1 rounded bg-white/[0.02]">
                    <input type="checkbox" defaultChecked className="accent-cyan-500 rounded" />
                    <span>Conectar endpoints stdio al servidor MCP <strong>(Carlos)</strong></span>
                  </label>
                  <label className="flex items-center gap-2 p-1 rounded bg-white/[0.02]">
                    <input type="checkbox" className="accent-cyan-500 rounded" />
                    <span>Validar uso de RAM en llamadas prolongadas &gt; 2h <strong>(Andrea)</strong></span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Interactive RAG Chat */}
        {activeTab === 'chat' && (
          <div className="space-y-3.5">
            <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10 flex items-start gap-2.5">
              <div className="w-6 h-6 rounded bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-[10px] shrink-0">
                TÚ
              </div>
              <p className="text-xs sm:text-sm text-slate-200">
                ¿En qué reunión y a qué minuto acordamos la política de cero telemetría externa?
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0e1730] border border-cyan-500/30 flex items-start gap-2.5">
              <div className="w-6 h-6 rounded bg-gradient-to-br from-cyan-500 to-violet-600 text-white flex items-center justify-center shrink-0">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div className="space-y-1.5 text-xs sm:text-sm text-slate-300">
                <p>
                  En la <strong className="text-white">Sesión de Revisión de Arquitectura</strong> a las <span className="text-cyan-300 font-mono font-medium">00:01:38</span>, Andrea (Product Owner) declaró formalmente:
                </p>
                <blockquote className="p-2 rounded bg-black/40 border-l-2 border-cyan-400 text-xs italic text-slate-300">
                  "Lo fundamental es que ningún archivo de audio viaje a servidores externos a menos que el usuario habilite explícitamente OpenAI."
                </blockquote>
                <div className="flex items-center gap-2 pt-0.5">
                  <span className="px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/40 text-[10px] font-mono text-cyan-300 flex items-center gap-1">
                    <Volume2 className="w-3 h-3" /> Cita Verificada: 00:01:38
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Búsqueda SQLite FTS5 (2ms)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Local MCP Server */}
        {activeTab === 'mcp' && (
          <div className="space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-[#060a17] border border-violet-500/30 font-mono text-xs">
              <div className="flex items-center gap-2 text-violet-300 text-[11px]">
                <Terminal className="w-3.5 h-3.5" />
                <span>Local MCP Server • stdio en localhost:8000</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px]">
                <span className="px-2 py-0.5 rounded bg-violet-950 border border-violet-500/40 text-violet-300">
                  Claude Desktop
                </span>
                <span className="px-2 py-0.5 rounded bg-blue-950 border border-blue-500/40 text-blue-300">
                  Cursor
                </span>
                <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                  Antigravity
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-black/70 border border-white/10 font-mono text-xs text-slate-300 space-y-1.5 overflow-x-auto">
              <div className="text-slate-500 text-[11px]">// Consulta ejecutada por tu asistente desde Cursor o Claude:</div>
              <div className="text-cyan-300">&gt; tools/call "get_meeting_summary" with &#123; "meeting_id": "2026-10-15-arch" &#125;</div>
              <div className="text-emerald-400 mt-1">
                &#123;<br />
                &nbsp;&nbsp;"status": "success",<br />
                &nbsp;&nbsp;"title": "Sesión de Revisión de Arquitectura",<br />
                &nbsp;&nbsp;"offline_privacy": true,<br />
                &nbsp;&nbsp;"execution_time_ms": 1.4<br />
                &#125;
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
