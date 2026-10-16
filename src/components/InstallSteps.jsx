import React from 'react';
import { Download, ShieldAlert, Cpu, Cloud } from 'lucide-react';
import { useDownloadHref } from './Buttons';

// Guía corta para quien recibe el enlace: qué descargar, el aviso de Windows y cómo elegir el motor de IA.
export function InstallSteps() {
  const { href, release } = useDownloadHref();

  return (
    <section id="instalar" className="py-20 md:py-24 relative border-t border-white/10 scroll-mt-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="font-display font-semibold text-2xl sm:text-4xl text-white tracking-tight mb-3">
            Instalación en 3 pasos
          </h2>
          <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto">
            Gratis, sin cuentas y en unos minutos. Esto es todo lo que necesitas.
          </p>
        </div>

        <ol className="grid gap-5 md:grid-cols-3">
          <li className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <span className="absolute -top-3 left-6 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-[#06140f]">1</span>
            <Download className="h-6 w-6 text-emerald-300 mb-3" aria-hidden="true" />
            <h3 className="text-white font-semibold mb-2">Descarga el instalador</h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-4">
              Un solo archivo <code className="text-emerald-200">.exe</code>
              {release ? ` (${release.sizeMB} MB, versión ${release.version})` : ''}. Es el único que necesitas.
            </p>
            <a
              href={href}
              {...(release ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-xs font-semibold text-white hover:brightness-110"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" /> Descargar para Windows
            </a>
          </li>

          <li className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <span className="absolute -top-3 left-6 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-[#06140f]">2</span>
            <ShieldAlert className="h-6 w-6 text-amber-300 mb-3" aria-hidden="true" />
            <h3 className="text-white font-semibold mb-2">Ábrelo y confirma</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Como la app aún no está firmada, Windows puede mostrar <strong className="text-slate-200">«Windows protegió su PC»</strong>.
              Pulsa <strong className="text-slate-200">Más información</strong> y luego <strong className="text-slate-200">Ejecutar de todas formas</strong>.
            </p>
          </li>

          <li className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <span className="absolute -top-3 left-6 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-[#06140f]">3</span>
            <Cpu className="h-6 w-6 text-cyan-300 mb-3" aria-hidden="true" />
            <h3 className="text-white font-semibold mb-2">Elige tu motor de IA</h3>
            <ul className="space-y-3 text-sm text-slate-400 leading-relaxed">
              <li className="flex gap-2">
                <Cpu className="h-4 w-4 mt-0.5 shrink-0 text-emerald-300" aria-hidden="true" />
                <span><strong className="text-slate-200">En tu equipo:</strong> la bienvenida te ayuda a instalar Ollama. Gratis y nada sale de tu PC.</span>
              </li>
              <li className="flex gap-2">
                <Cloud className="h-4 w-4 mt-0.5 shrink-0 text-cyan-300" aria-hidden="true" />
                <span><strong className="text-slate-200">Sin instalar nada:</strong> pega tu clave de OpenAI en la app. Pago por uso; el audio y el texto se envían a OpenAI.</span>
              </li>
            </ul>
          </li>
        </ol>

        <p className="mt-8 text-center text-xs text-slate-500">
          Requisitos: Windows 10/11 de 64 bits y 8 GB de RAM (16 GB recomendado para la IA local). Las nuevas versiones se instalan solas.
        </p>
      </div>
    </section>
  );
}
