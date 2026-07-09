import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CalendarClock, Copy, Download, Loader2, Phone, Sparkles, Stethoscope, Trash2, Wand2, Zap } from "lucide-react";
import {
  generateSinglePost,
  generateCaptionOnly,
  approvePost,
  discardPost,
  MODELOS_IA,
  MODELOS_IMAGEM,
} from "@/lib/ai-post.functions";
import { publishInstagramNow } from "@/lib/social/instagram-publish.functions";
import { cn } from "@/lib/utils";

const LIGA_ACCOUNT = "drfranciscomenezes";
const LS_PHONE = "planner_agend_liga_phone_v1";
const TELEFONE_PADRAO = "(19) 99018-0802";
const INSTITUICAO = "Faculdade Anhanguera de Santa Bárbara";
const SERVICO = "Clínica Escola – Cirurgia Bucal e Biópsias";

const TRATAMENTOS = [
  { id: "trigemio", label: "Neuralgia do Trigêmeo", tema: "Neuralgia do trigêmeo: dor facial em choque, diagnóstico e tratamento cirúrgico/medicamentoso avaliado na clínica da Liga LACTBMF" },
  { id: "biopsia", label: "Biópsia de lesões bucais", tema: "Biópsia de lesões suspeitas na boca (bochecha, gengiva, língua, lábio) realizada com segurança pela Liga LACTBMF" },
  { id: "siso", label: "Extração de sisos inclusos", tema: "Extração de sisos inclusos ou impactados na clínica da Liga LACTBMF com professores da CTBMF supervisionando" },
  { id: "cisto", label: "Cistos e tumores odontogênicos", tema: "Remoção cirúrgica de cistos e tumores odontogênicos (dentígero, radicular) na Liga LACTBMF" },
  { id: "frenectomia", label: "Frenectomia lingual/labial", tema: "Frenectomia lingual e labial (liberação de língua presa) na clínica da Liga LACTBMF" },
  { id: "apicectomia", label: "Apicectomia / cirurgia parendodôntica", tema: "Apicectomia: cirurgia para preservar o dente após tratamento de canal — Liga LACTBMF" },
  { id: "implante", label: "Avaliação para implantes", tema: "Avaliação inicial para implantes dentários com planejamento cirúrgico na Liga LACTBMF" },
  { id: "trauma", label: "Trauma bucofacial", tema: "Atendimento de trauma facial (fraturas dentárias, luxações, cortes) triado pela Liga LACTBMF" },
  { id: "atm", label: "Dor na ATM / bruxismo", tema: "Avaliação da dor na ATM, estalos e bruxismo na Liga LACTBMF" },
  { id: "alveoloplastia", label: "Alveoloplastia / preparo pré-prótese", tema: "Alveoloplastia e regularização óssea antes de prótese — Liga LACTBMF" },
] as const;

type TratId = (typeof TRATAMENTOS)[number]["id"];

function tratamentoLabel(id: TratId) {
  return TRATAMENTOS.find((t) => t.id === id)?.label ?? id;
}

function buildPatientCaption(params: {
  tratamento: TratId;
  telefone: string;
  base: string;
  assunto?: string;
}) {
  const t = TRATAMENTOS.find((x) => x.id === params.tratamento)!;
  const tel = params.telefone.trim() || TELEFONE_PADRAO;
  const assuntoTxt = (params.assunto || "").trim();
  const abertura = `📢 ${SERVICO} — ${INSTITUICAO}\n\n👉 ${t.label}`;
  const anguloBloco = assuntoTxt
    ? `\n\n🎯 Nesta publicação: ${assuntoTxt}`
    : "";
  const meio = `\n\nAtendimento supervisionado por professores especialistas em Cirurgia e Traumatologia Bucomaxilofacial. Ambiente seguro, humanizado e acolhedor para pacientes de Santa Bárbara d'Oeste e cidades vizinhas.\n\nQuem pode ser atendido:\n• Pessoas com indicação para ${t.label.toLowerCase()};\n• Quem precisa avaliar lesões na boca (manchas, feridas que não cicatrizam, caroços);\n• Encaminhamentos de dentistas parceiros.\n\n💬 Não deixe lesões sem avaliação — quanto antes você procura, mais simples é o tratamento.`;
  const cta = `\n\n📞 Agende sua avaliação: ${tel}\n(Atendimento em horário comercial.)\n\n#CirurgiaBucal #BiopsiaBucal #SaudeBucal #SantaBarbaraDOeste #Anhanguera #ClinicaEscola #Odontologia #Siso #LesaoBucal #SaudeDaBoca`;
  return `${abertura}${anguloBloco}${meio}${cta}`;
}

interface PreviewState {
  id: string;
  legenda: string;
  urls: string[];
  slideLegendas?: string[];
}

export function PlannerAgendamentoTratamento() {
  const genSingle = useServerFn(generateSinglePost);
  const genCaption = useServerFn(generateCaptionOnly);
  const approveFn = useServerFn(approvePost);
  const discardFn = useServerFn(discardPost);
  const publishIg = useServerFn(publishInstagramNow);

  const [telefone, setTelefone] = useState("");
  const [tratamento, setTratamento] = useState<TratId>("trigemio");
  const [modo, setModo] = useState<"feed" | "carrossel" | "stories">("feed");
  const [quando, setQuando] = useState<"agora" | "data">("agora");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("09:00");
  const [modelo, setModelo] = useState<(typeof MODELOS_IA)[number]["id"]>("local/sem-custo");
  const [modeloImagem, setModeloImagem] = useState<(typeof MODELOS_IMAGEM)[number]["id"]>("local/sem-custo");
  const [assunto, setAssunto] = useState("");
  const [legendaGerada, setLegendaGerada] = useState("");
  const [gerandoLegenda, setGerandoLegenda] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LS_PHONE);
      setTelefone(saved && saved.trim() ? saved : TELEFONE_PADRAO);
    } catch { setTelefone(TELEFONE_PADRAO); }
  }, []);

  const salvarTelefone = useCallback((v: string) => {
    setTelefone(v);
    try { window.localStorage.setItem(LS_PHONE, v); } catch {}
  }, []);

  const buildIso = () => {
    if (quando !== "data") return undefined;
    if (!data) throw new Error("Escolha a data.");
    const [hh, mm] = hora.split(":").map(Number);
    const d = new Date(data);
    d.setHours(hh || 9, mm || 0, 0, 0);
    if (d.getTime() < Date.now()) throw new Error("A data/hora deve estar no futuro.");
    return d.toISOString();
  };

  const temaAtual = () => {
    const t = TRATAMENTOS.find((x) => x.id === tratamento)!;
    const assuntoTxt = assunto.trim();
    return `TEMA ÚNICO E EXCLUSIVO DO POST: ${t.tema}. A legenda inteira fala SOMENTE sobre "${t.label}" — PROIBIDO citar outros tratamentos, outras patologias, outros procedimentos ou temas genéricos de odontologia. Contexto: convite público para pacientes conhecerem a possibilidade de avaliação de "${t.label}" na Clínica-Escola da LACTBMF (Liga Acadêmica de CTBMF · Anhanguera Santa Bárbara d'Oeste), agendamento pelo telefone ${telefone.trim() || TELEFONE_PADRAO}. Linguagem simples, acolhedora e segura, focada apenas em "${t.label}".${assuntoTxt ? ` Ângulo específico (ainda dentro do MESMO tema): ${assuntoTxt}.` : ""}`;
  };

  const gerarLegenda = async () => {
    if (!telefone.trim()) return toast.error("Informe o telefone antes de gerar a legenda.");
    // A IA estava drifitando entre temas e trazendo assuntos que nada tinham
    // a ver com o tratamento escolhido. Para garantir 100% de aderência ao
    // tema selecionado, montamos a legenda de forma determinística a partir
    // do template `buildPatientCaption` (que já usa o tratamento atual).
    setGerandoLegenda(true);
    try {
      const final = buildPatientCaption({ tratamento, telefone, base: "" });
      setLegendaGerada(final);
      toast.success("Legenda pronta — 100% focada no tratamento escolhido.");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao criar legenda.");
    } finally {
      setGerandoLegenda(false);
    }
  };



  const gerar = async () => {
    if (!telefone.trim()) return toast.error("Informe o telefone de agendamento antes de gerar.");
    setBusy(true);
    const tid = "agend-liga";
    toast.loading(`Criando convite: ${tratamentoLabel(tratamento)}...`, { id: tid });
    try {
      const iso = buildIso();
      const tratObj = TRATAMENTOS.find((t) => t.id === tratamento)!;
      const tipo = modo === "stories" ? "stories" : "feed";
      const formato = modo === "carrossel" ? "Carrossel" : modo === "stories" ? "Story" : "Post Único";
      const assuntoTxt = assunto.trim();
      const capaBrief = `CAPA (1º slide) — IDENTIDADE FIXA OBRIGATÓRIA da Liga LACTBMF:
• Fundo sólido GRAFITE #2D2C32 (sem gradiente, sem textura).
• Faixa/bloco de destaque ÂMBAR #DD8E3C na diagonal ou lateral esquerda.
• HEADLINE gigante: nome do tratamento "${tratObj.label.toUpperCase()}" em caixa-alta, sans-serif bold pesado, cor off-white #FBFBFB, ocupando o terço superior.
• Subtítulo curto em âmbar #DD8E3C: "AGENDA ABERTA — CLÍNICA ESCOLA".
• Telefone impresso no card em bloco âmbar com número off-white: "📞 ${telefone.trim()}".
• PROIBIDO desenhar QUALQUER rodapé, texto institucional, nome de faculdade, "Clínica Escola", "Anhanguera", selo ou logotipo na metade inferior da imagem — a faixa inferior (últimos 20% da altura) fica TOTALMENTE LIMPA, sem texto, sem forma, sem elemento gráfico: o sistema aplica ali as 3 logos oficiais reais (aluno-esquerda, aluno-centro, Liga-direita).
• PROIBIDO: fundo branco, azul, ciano, verde, roxo, rosa, gradientes, fotos realistas de pacientes, rostos.
TODOS OS SLIDES (obrigatório): TEXTO GRANDE E LEGÍVEL IMPRESSO NA IMAGEM em português-BR claro, linguagem simples para leigo (evite termos técnicos; se usar, explique em 1 linha). Cada slide traz 1 frase-chave curta em destaque + 2 a 4 bullets objetivos. Ícones simples e pictogramas quando ajudarem o entendimento. Mesma paleta grafite/âmbar/off-white, tipografia bold, alto contraste. Faixa inferior (últimos 20% da altura) SEMPRE LIMPA em TODOS os slides — reservada para as 3 logos reais do sistema.`;
      const assuntoBlock = assuntoTxt ? `\n\nASSUNTO/ÂNGULO ESPECÍFICO desta postagem (priorize sobre o padrão): ${assuntoTxt}` : "";
      const diretriz = `\n\n=== DIRETRIZ MESTRA — ${SERVICO} · ${INSTITUICAO} ===\nPÚBLICO: pacientes leigos da região de Santa Bárbara d'Oeste e cidades vizinhas.\nOBJETIVO: informar que existe a oportunidade de fazer o tratamento na Clínica Escola, quebrar medos/mitos ("dói?", "é perigoso?", "demora?"), estimular o agendamento pelo telefone ${telefone.trim() || TELEFONE_PADRAO}.\nMENSAGENS-CHAVE: "Atendimento supervisionado por professores especialistas" · "Ambiente seguro e humanizado" · "Agende sua avaliação" · "Não deixe lesões sem avaliação".\nTOM: acolhedor, tranquilo, confiável, empático com medos e dúvidas. Linguagem simples, sem termos técnicos desnecessários (se usar, explique em 1 linha).\nEVITAR imagens/palavras que assustem (sangue, instrumentos agressivos, cenas invasivas).\nSEMPRE citar o telefone ${telefone.trim() || TELEFONE_PADRAO} e o nome "${SERVICO} — ${INSTITUICAO}".\nHASHTAGS: #CirurgiaBucal #BiopsiaBucal #SaudeBucal #SantaBarbaraDOeste #Anhanguera #ClinicaEscola #Odontologia #Siso #LesaoBucal #SaudeDaBoca\n=== FIM ===`;
      const tema = `${tratObj.tema}. CONVITE PÚBLICO para pacientes agendarem AVALIAÇÃO pelo telefone ${telefone.trim() || TELEFONE_PADRAO} na ${SERVICO} — ${INSTITUICAO}. Público-alvo: PACIENTES LEIGOS. Tom: acolhedor, seguro, humanizado, LINGUAGEM SIMPLES.${assuntoBlock}${diretriz}\n\n${capaBrief}`;

      const out = await genSingle({
        data: {
          tema,
          especialidade: "CTBMF",
          rede: "instagram",
          tipo,
          formato,
          quando: iso,
          ambasRedes: false,
          audiencia: "estudantes-graduacao", // ativa paleta e logos da Liga
          modelo,
          modeloImagem,
        } as any,
      });

      // Legenda do convite SEMPRE é a template determinística focada em UM único
      // tratamento — nunca aceitamos texto da IA aqui porque ela drifta entre
      // tratamentos. Só respeitamos legenda 100% manual digitada pelo usuário.
      const legendaPaciente = legendaGerada.trim()
        ? legendaGerada.trim()
        : buildPatientCaption({ tratamento, telefone, base: "" });
      await supabase
        .from("posts")
        .update({ instagram_conta: LIGA_ACCOUNT, legenda: legendaPaciente, legenda_instagram: legendaPaciente } as any)
        .eq("id", out.id);

      setPreview({ id: out.id, legenda: legendaPaciente, urls: out.urls, slideLegendas: (out as any).slideLegendas });
      toast.success("Convite gerado. Revise abaixo.", { id: tid });
    } catch (e: any) {
      toast.error(e.message || "Falha ao gerar.", { id: tid });
    } finally {
      setBusy(false);
    }
  };

  const editarLegenda = async (nova: string) => {
    if (!preview) return;
    setPreview({ ...preview, legenda: nova });
    await supabase.from("posts").update({ legenda: nova, legenda_instagram: nova } as any).eq("id", preview.id);
  };

  const decidir = async (acao: "publicar" | "agendar" | "arquivar") => {
    if (!preview) return;
    const tid = "agend-liga-dec";
    toast.loading(acao === "publicar" ? "Publicando..." : "Salvando...", { id: tid });
    try {
      if (acao === "publicar") {
        await approveFn({ data: { id: preview.id, acao: "arquivar" } });
        const out = await publishIg({ data: { id: preview.id } });
        if (out && "ok" in out && out.ok === false) throw new Error(("error" in out ? out.error : "Falha ao publicar."));
        toast.success("Publicado no Instagram @drfranciscomenezes.", { id: tid });
      } else {
        await approveFn({ data: { id: preview.id, acao } });
        toast.success("Salvo.", { id: tid });
      }
      setPreview(null);
    } catch (e: any) {
      toast.error(e.message || "Falha.", { id: tid });
    }
  };

  const descartar = async () => {
    if (!preview) return;
    try { await discardFn({ data: { id: preview.id } }); } catch {}
    setPreview(null);
    toast.success("Descartado.");
  };

  const copiar = async (t: string) => {
    try { await navigator.clipboard.writeText(t); toast.success("Copiado."); } catch { toast.error("Falha ao copiar."); }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card className="p-5 space-y-2 border-2 border-amber-300 bg-amber-50/40">
        <div className="flex items-center gap-2 text-amber-900">
          <Stethoscope className="w-5 h-5" />
          <h2 className="font-bold">Agendamento Clínicas Cirurgia e Biópsia — {SERVICO}</h2>
        </div>
        <p className="text-xs text-amber-950">
          Gera posts convidando pacientes a agendarem cirurgia bucal e biópsias na <strong>{SERVICO}</strong> ({INSTITUICAO}).
          Telefone padrão: <strong>{TELEFONE_PADRAO}</strong>. Publica em <Badge variant="secondary">@{LIGA_ACCOUNT}</Badge>.
        </p>
      </Card>

      <Card className="p-5 space-y-3">
        <Label className="flex items-center gap-2 text-sm font-semibold">
          <Phone className="w-4 h-4" /> Telefone para agendamento (obrigatório)
        </Label>
        <Input
          value={telefone}
          onChange={(e) => salvarTelefone(e.target.value)}
          placeholder="(15) 3333-4444 ou WhatsApp (15) 99999-0000"
        />
        <p className="text-[11px] text-muted-foreground">Aparece dentro da legenda de todo convite gerado. Fica salvo neste navegador.</p>
      </Card>

      <Card className="p-5 space-y-3">
        <Label className="text-sm font-semibold">Tipo de tratamento oferecido</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {TRATAMENTOS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTratamento(t.id)}
              className={cn(
                "px-3 py-2 rounded-md text-xs font-semibold border-2 transition-all text-left",
                tratamento === t.id
                  ? "border-amber-500 bg-white text-amber-900 shadow"
                  : "border-zinc-200 bg-white/60 text-zinc-600 hover:border-amber-300",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-5 space-y-2">
        <Label className="text-sm font-semibold">Assunto / ângulo específico (opcional)</Label>
        <Textarea
          value={assunto}
          onChange={(e) => setAssunto(e.target.value)}
          placeholder="Ex.: focar em pacientes com dor facial em choque há semanas; destacar que é atendimento supervisionado; explicar sinais de alerta de cisto na arcada."
          rows={3}
          className="text-sm"
        />
        <p className="text-[11px] text-muted-foreground">
          Se preenchido, a IA prioriza este ângulo. Textos e imagens vêm em linguagem simples, com frases grandes impressas nos cards para o público leigo entender de imediato.
        </p>
      </Card>

      <Card className="p-5 space-y-3 border-2 border-dashed border-amber-300 bg-amber-50/30">
        <Label className="text-sm font-semibold">Legenda do convite</Label>
        <Button type="button" variant="secondary" onClick={gerarLegenda} disabled={gerandoLegenda || !telefone.trim()} className="w-full border-amber-300 bg-white text-amber-900 hover:bg-amber-50">
          {gerandoLegenda ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
          {modelo === "local/sem-custo" ? "App gerar legenda" : "IA gerar legenda"}
        </Button>
        <Textarea
          value={legendaGerada}
          onChange={(e) => setLegendaGerada(e.target.value)}
          placeholder="Você pode escrever a legenda aqui ou clicar para a IA/app gerar pelo tema acima. Se ficar vazio, o app monta a legenda padrão ao gerar o convite."
          rows={6}
          className="text-sm"
        />
      </Card>


      <Card className="p-5 space-y-3">
        <Label className="text-sm font-semibold">Formato do post</Label>
        <div className="grid grid-cols-3 gap-2">
          {(["feed", "carrossel", "stories"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              className={cn(
                "px-3 py-2 rounded-md text-sm font-semibold border-2 capitalize",
                modo === m ? "border-amber-500 bg-white text-amber-900" : "border-zinc-200 bg-white/60 text-zinc-600 hover:border-amber-300",
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <Label className="text-sm font-semibold">Quando publicar</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setQuando("agora")}
            className={cn("px-3 py-2 rounded-md text-sm font-semibold border-2 flex items-center justify-center gap-1.5", quando === "agora" ? "border-amber-500 bg-white text-amber-900" : "border-zinc-200 bg-white/60 text-zinc-600")}
          ><Zap className="w-4 h-4" /> Agora</button>
          <button
            type="button"
            onClick={() => setQuando("data")}
            className={cn("px-3 py-2 rounded-md text-sm font-semibold border-2 flex items-center justify-center gap-1.5", quando === "data" ? "border-amber-500 bg-white text-amber-900" : "border-zinc-200 bg-white/60 text-zinc-600")}
          ><CalendarClock className="w-4 h-4" /> Calendário</button>
        </div>
        {quando === "data" && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </div>
        )}
      </Card>

      <Card className="p-5 space-y-3 border-2 border-dashed border-amber-300 bg-amber-50/30">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Texto</Label>
            <div className="flex flex-wrap gap-1.5">
              {MODELOS_IA.map((m) => (
                <button key={m.id} type="button" onClick={() => setModelo(m.id)}
                  className={cn("px-2 py-1 rounded text-[11px] font-semibold border", modelo === m.id ? "bg-amber-600 text-white border-amber-600" : "bg-white border-zinc-200 text-zinc-600")}>{m.label}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Imagem</Label>
            <div className="flex flex-wrap gap-1.5">
              {MODELOS_IMAGEM.map((m) => (
                <button key={m.id} type="button" onClick={() => setModeloImagem(m.id)}
                  className={cn("px-2 py-1 rounded text-[11px] font-semibold border", modeloImagem === m.id ? "bg-fuchsia-600 text-white border-fuchsia-600" : "bg-white border-zinc-200 text-zinc-600")}>{m.label}</button>
              ))}
            </div>
          </div>
        </div>

        <Button onClick={gerar} disabled={busy} className="w-full bg-amber-600 hover:bg-amber-700">
          {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wand2 className="w-4 h-4 mr-2" />}
          Gerar convite de agendamento
        </Button>
      </Card>

      {preview && (
        <Card className="p-5 space-y-3 border-2 border-emerald-300 bg-emerald-50/30">
          <h3 className="font-semibold text-emerald-900 flex items-center gap-2"><Sparkles className="w-4 h-4" /> Pré-visualização</h3>
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              {preview.urls.length > 1 ? (
                <div className="flex flex-col gap-4">
                  {preview.urls.map((u, i) => (
                    <div key={i} className="rounded-md border bg-white/80 overflow-hidden">
                      <img src={u} alt={`Slide ${i + 1}`} className="w-full object-contain max-h-[85vh] bg-slate-50" />
                      <Button size="sm" variant="ghost" className="w-full h-8 text-xs" onClick={() => window.open(u, "_blank")}>
                        <Download className="w-3 h-3 mr-1" /> Abrir slide {i + 1}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <img src={preview.urls[0]} alt="Post" className="w-full rounded-md border object-contain max-h-[85vh] bg-slate-50" />
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Legenda (edite antes de publicar)</Label>
              <Textarea
                value={preview.legenda}
                onChange={(e) => editarLegenda(e.target.value)}
                rows={14}
                className="text-xs font-mono"
              />
              <Button size="sm" variant="outline" className="w-full" onClick={() => copiar(preview.legenda)}>
                <Copy className="w-3 h-3 mr-1" /> Copiar legenda
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={() => decidir("publicar")} className="bg-emerald-600 hover:bg-emerald-700">Publicar agora</Button>
            <Button onClick={() => decidir("agendar")} variant="secondary">Salvar/Agendar</Button>
            <Button onClick={() => decidir("arquivar")} variant="outline">Arquivar</Button>
            <Button onClick={descartar} variant="ghost" className="text-red-600 ml-auto">
              <Trash2 className="w-4 h-4 mr-1" /> Descartar
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
