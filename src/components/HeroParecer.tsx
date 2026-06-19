import { ArrowRight, ShieldCheck } from "lucide-react";
import { BRANDING } from "@/lib/branding";

/**
 * HeroParecer — Landing hero seguindo paleta 60/30/10 da marca premium CTBMF.
 *  60% Azul Petróleo #0c2340 (fundo dominante)
 *  30% Branco Puro #ffffff (estrutura / texto)
 *  10% Ciano #2dd4ff (CTA / foco)
 *
 * Tom: parecer cirúrgico anti-objeção. Nada de varejo.
 */
export function HeroParecer() {
  return (
    <section
      className="relative isolate overflow-hidden"
      style={{ backgroundColor: "#0c2340" }}
    >
      {/* Malha técnica sutil (linhas ciano de precisão) */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(#2dd4ff 1px, transparent 1px), linear-gradient(90deg, #2dd4ff 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
      {/* Halo ciano discreto no canto */}
      <div
        aria-hidden
        className="absolute -top-32 -right-32 h-[480px] w-[480px] rounded-full blur-3xl opacity-20"
        style={{ background: "radial-gradient(circle, #2dd4ff 0%, transparent 70%)" }}
      />

      <div className="relative max-w-7xl mx-auto px-6 sm:px-10 py-24 sm:py-32 grid lg:grid-cols-12 gap-12 items-center">
        {/* 30% — bloco branco de respiro com o parecer */}
        <div className="lg:col-span-7 text-white">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium tracking-wide"
            style={{
              borderWidth: 1,
              borderColor: "#2dd4ff",
              color: "#2dd4ff",
            }}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            33 anos · Cirurgia e Traumatologia Bucomaxilofacial
          </div>

          <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight">
            O planejamento digital
            <br />
            que antecede a
            <span style={{ color: "#2dd4ff" }}> segurança hospitalar</span>.
          </h1>

          <p className="mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-white/75">
            A consulta presencial não é uma avaliação comercial. É o parecer
            técnico em que mapeamos sua anatomia, montamos o planejamento
            virtual da cirurgia e construímos a ponte com o convênio e o
            centro cirúrgico hospitalar.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <a
              href={BRANDING.whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-md font-semibold text-sm tracking-wide transition-all hover:translate-y-[-1px]"
              style={{
                backgroundColor: "#2dd4ff",
                color: "#0c2340",
                boxShadow: "0 10px 30px -10px #2dd4ff",
              }}
            >
              Solicitar parecer cirúrgico
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <span className="text-xs text-white/55 tracking-wide">
              Consulta no consultório próprio
            </span>
          </div>

          <div className="mt-12 pt-8 border-t border-white/10 grid grid-cols-3 gap-6 max-w-xl">
            {[
              { n: "33", l: "anos hospitalares" },
              { n: "100%", l: "planejamento digital" },
              { n: "CTBMF", l: "registro CROSP 53318" },
            ].map((item) => (
              <div key={item.l}>
                <div
                  className="text-2xl font-bold"
                  style={{ color: "#2dd4ff" }}
                >
                  {item.n}
                </div>
                <div className="text-[11px] uppercase tracking-wider text-white/55 mt-1">
                  {item.l}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Visual — cartão técnico (sem foto stock, malha 3D simulada) */}
        <div className="lg:col-span-5 relative">
          <div
            className="relative aspect-[4/5] rounded-2xl overflow-hidden border"
            style={{
              borderColor: "rgba(45, 212, 255, 0.25)",
              background:
                "linear-gradient(160deg, rgba(45,212,255,0.08) 0%, rgba(12,35,64,0.9) 60%)",
            }}
          >
            {/* Cruz de mira ciano (planejamento virtual) */}
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(45,212,255,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(45,212,255,0.18) 1px, transparent 1px)",
                backgroundSize: "32px 32px",
              }}
            />
            <div className="absolute top-1/2 left-0 right-0 h-px bg-[#2dd4ff]/40" />
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#2dd4ff]/40" />

            <div className="absolute bottom-0 left-0 right-0 p-6 backdrop-blur-md bg-[#0c2340]/70 border-t border-[#2dd4ff]/20">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#2dd4ff] mb-2">
                Planejamento Virtual · CTBMF
              </div>
              <div className="text-sm text-white font-medium leading-snug">
                {BRANDING.nome}
              </div>
              <div className="text-[11px] text-white/60 mt-0.5">
                {BRANDING.cro} · Cirurgia Ortognática · ATM · Implantes
                Complexos · Reconstruções
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
