import type { LogoKey } from "@/lib/logos-catalog";
import type { PlannerTemas } from "@/lib/free-studio";

/**
 * Perfis do Estúdio (Gratuito e IA Avançada). Cada perfil carrega SOMENTE os dados
 * já configurados no projeto; campos não configurados ficam vazios e editáveis.
 */
export type PerfilId = "chico" | "cirurgia-biopsias" | "clinica-escola" | "liga";

export type Perfil = {
  id: PerfilId;
  nome: string;
  audiencia: "chico-drfm" | "geral" | "estudantes-graduacao";
  temas: PlannerTemas;
  logo: LogoKey;
  publico: string;
  nivel: "leigo" | "intermediario" | "tecnico";
  paleta: { fundo1: string; fundo2: string; destaque: string; texto: string; confirmada: boolean };
  assinatura: string;
  telefone: string;
  ctaPadrao: string;
  /** Regras editoriais para o servidor (IA Avançada). */
  regras: string;
  /** Diretriz visual para prompts de imagem (sem logo e sem texto). */
  visual: string;
  /** O que ainda não está configurado no projeto para este perfil. */
  faltando: string[];
};

export const PERFIS: Record<PerfilId, Perfil> = {
  chico: {
    id: "chico",
    nome: "Planner Chico",
    audiencia: "chico-drfm",
    temas: "chico",
    logo: "planner",
    publico: "Pacientes e público geral (@drfranciscomenezes)",
    nivel: "leigo",
    paleta: { fundo1: "#0c2340", fundo2: "#000000", destaque: "#2dd4ff", texto: "#ffffff", confirmada: true },
    assinatura: "Prof. Francisco Menezes | CROSP 53318",
    telefone: "",
    ctaPadrao: "Saiba mais pelo link da bio",
    regras: "CHICO",
    visual: "CHICO",
    faltando: [],
  },
  "cirurgia-biopsias": {
    id: "cirurgia-biopsias",
    nome: "Cirurgia e Biópsias",
    audiencia: "geral",
    temas: "cirurgia-biopsias",
    logo: "clinica-escola",
    publico: "Pacientes leigos de Santa Bárbara d'Oeste e cidades vizinhas",
    nivel: "leigo",
    paleta: { fundo1: "#2d2c32", fundo2: "#2d2c32", destaque: "#dd8e3c", texto: "#fbfbfb", confirmada: true },
    assinatura: "Clínica Escola – Cirurgia Bucal e Biópsias · Faculdade Anhanguera de Santa Bárbara",
    telefone: "(19) 99018-0802",
    ctaPadrao: "Agende sua avaliação pelo telefone (19) 99018-0802",
    regras: [
      "Perfil Cirurgia e Biópsias — Clínica Escola – Cirurgia Bucal e Biópsias (LACTBMF · Faculdade Anhanguera de Santa Bárbara).",
      "PÚBLICO: pacientes leigos da região de Santa Bárbara d'Oeste e cidades vizinhas. OBJETIVO: informar a oportunidade de tratamento na Clínica Escola, quebrar medos/mitos e estimular o agendamento pelo telefone.",
      "MENSAGENS-CHAVE: atendimento supervisionado por professores especialistas · ambiente seguro e humanizado · não deixe lesões sem avaliação.",
      "TOM: acolhedor, tranquilo, confiável, linguagem simples. Evitar palavras que assustem.",
      "NÃO use assinatura, CROSP, cidades, link da bio, WhatsApp ou CTA do perfil do Prof. Francisco Menezes, nem paleta/linguagem da Liga.",
    ].join("\n"),
    visual: "Paleta exclusiva: grafite #2d2c32, âmbar #dd8e3c e off-white #fbfbfb. Atmosfera acolhedora de clínica-escola, sem sangue nem instrumentos agressivos. Não usar azul petróleo/ciano nem vermelho da Liga.",
    faltando: [],
  },
  "clinica-escola": {
    id: "clinica-escola",
    nome: "Clínica Escola",
    audiencia: "geral",
    temas: "clinica-escola",
    logo: "clinica-escola",
    publico: "Pacientes da Clínica Escola",
    nivel: "leigo",
    // Paleta própria não está configurada no projeto: neutro preto/branco, sem copiar outro perfil.
    paleta: { fundo1: "#1a1a1a", fundo2: "#3a3a3a", destaque: "#ffffff", texto: "#ffffff", confirmada: false },
    assinatura: "Clínica Escola",
    telefone: "",
    ctaPadrao: "",
    regras: [
      "Perfil Clínica Escola — informações institucionais para pacientes (agenda, confirmação, remarcação, funcionamento da clínica-escola).",
      "TOM: claro, acolhedor e institucional, linguagem simples.",
      "Não invente telefone, endereço, horários ou CTA: use apenas os informados no briefing. Se não houver, termine sem telefone.",
      "NÃO use assinatura, CROSP, cidades, link da bio ou WhatsApp do Prof. Francisco Menezes, nem o telefone/serviço do perfil Cirurgia e Biópsias, nem a identidade da Liga.",
    ].join("\n"),
    visual: "Paleta neutra preto, grafite e branco (paleta própria ainda não configurada). Ambiente institucional de clínica-escola odontológica, acolhedor. Não usar azul petróleo/ciano, âmbar nem vermelho de outros perfis.",
    faltando: ["paleta de cores própria", "telefone de contato", "chamada (CTA) padrão"],
  },
  liga: {
    id: "liga",
    nome: "Planner Liga",
    audiencia: "estudantes-graduacao",
    temas: "liga",
    logo: "liga-ctbmf",
    publico: "Estudantes e profissionais de Odontologia (@lactbmf.anhanguerasbo)",
    nivel: "tecnico",
    paleta: { fundo1: "#000000", fundo2: "#545454", destaque: "#c92e28", texto: "#ffffff", confirmada: true },
    assinatura: "Liga Acadêmica de CTBMF",
    telefone: "",
    ctaPadrao: "",
    regras: "LIGA",
    visual: "LIGA",
    faltando: [],
  },
};

export const PERFIS_IDS = Object.keys(PERFIS) as PerfilId[];
export const PERFIL_STORAGE = "estudio-perfil";

export function lerPerfilSalvo(v: string | null | undefined): PerfilId {
  return v && (PERFIS_IDS as string[]).includes(v) ? (v as PerfilId) : "chico";
}

/**
 * Ajusta uma legenda de modelo fixo ao perfil: fora do Planner Chico remove link da bio,
 * WhatsApp e dados do Prof. Francisco, e acrescenta a chamada/assinatura do próprio perfil.
 */
export function legendaDoPerfil(texto: string, id: PerfilId, telefone?: string): string {
  const p = PERFIS[id];
  if (id === "chico") return texto;
  if (id === "liga") {
    const l = texto.split("\n").filter((x) => !/wa\.me|whatsapp|francisco|crosp/i.test(x)).join("\n").trim();
    return `${l}\n\n${p.assinatura}`;
  }
  const limpo = texto
    .split("\n")
    .filter((l) => !/link da bio|link na bio|link do perfil|wa\.me|whatsapp|francisco|crosp/i.test(l))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const tel = (telefone ?? p.telefone).trim();
  const cta = id === "cirurgia-biopsias" && tel ? `Agende sua avaliação pelo telefone ${tel}` : tel ? `Contato: ${tel}` : "";
  return [limpo, cta, p.assinatura].filter(Boolean).join("\n\n");
}
