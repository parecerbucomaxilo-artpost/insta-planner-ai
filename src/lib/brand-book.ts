// ============================================================
// BRAND BOOK DIGITAL (Prompt 4) — fonte única de verdade visual.
// Separa as regras de identidade dos prompts. Editar AQUI muda
// automaticamente toda a geração (cores, logo, fontes, posições).
// ============================================================

export type BrandKey = "drfranciscomenezes" | "lactbmf";

export interface BrandSpec {
  instagram: string;
  posicionamento: string;
  personalidade: string[];
  emocoes: string[];
  objetivo: string;
  publico: string;
  paleta: {
    primary: string;
    secondary: string;
    support: string;
    bg: string;
    text: string;
    light: string;
  };
  logo: { file: string; position: "bottom_right" | "bottom_left" };
  tipografia: { title: string; body: string };
  estilo: string;
  imagens: string[];
  proibido: string[];
  ganchos: string[];
}

export const BRAND_BOOK: Record<BrandKey, BrandSpec> = {
  drfranciscomenezes: {
    instagram: "@drfranciscomenezes",
    posicionamento:
      "Cirurgião Bucomaxilofacial · Professor · Odontologia Hospitalar · Traumatologia · Cirurgia Oral · Referência clínica.",
    personalidade: ["Elegante", "Premium", "Humana", "Segura", "Séria", "Moderna", "Minimalista", "Didática", "Confiante"],
    emocoes: ["Segurança", "Confiança", "Autoridade", "Calma", "Acolhimento", "Tecnologia", "Excelência"],
    objetivo: "Converter seguidores em pacientes, fortalecer reputação, gerar consultas, educar, eliminar medo.",
    publico: "18–70 anos — pacientes, familiares, leigos.",
    paleta: {
      primary: "#0c2340", // azul petróleo
      secondary: "#2dd4ff", // ciano
      support: "#E11D2E", // vermelho só p/ dor
      bg: "#FFFFFF",
      text: "#0c2340",
      light: "#F5F5F5",
    },
    logo: { file: "logo-dr-francisco.png", position: "bottom_right" },
    tipografia: { title: "Sans-serif bold condensada", body: "Sans-serif regular" },
    estilo: "Premium · editorial · minimalista · muito espaço em branco · luxuoso hospitalar.",
    imagens: [
      "Hospital",
      "Centro cirúrgico",
      "Consultório moderno",
      "Radiografia/tomografia",
      "Paciente real com expressão natural",
      "Tecnologia médica",
    ],
    proibido: [
      "Cor fora da paleta",
      "Redesenhar/recortar/recolorir logo",
      "Banco de imagens artificiais",
      "Fontes infantis/manuscritas",
      "Sensacionalismo",
      "Mais de 2 famílias tipográficas",
    ],
    ganchos: ["Curiosidade", "História", "Erro", "Problema", "Comparação", "Prova", "Autoridade", "Open Loop", "Desafio", "Experimento"],
  },
  lactbmf: {
    instagram: "@lactbmf.anhanguerasbo",
    posicionamento: "Liga Acadêmica · Ensino · Pesquisa · Extensão · Formação científica.",
    personalidade: ["Acadêmica", "Institucional", "Inspiradora", "Didática", "Tecnológica"],
    emocoes: ["Pertencimento", "Conhecimento", "Inspiração", "Credibilidade institucional"],
    objetivo: "Atrair estudantes, fortalecer a Liga, divulgar eventos, ensinar.",
    publico: "Acadêmicos, professores, residentes, cirurgiões-dentistas.",
    paleta: {
      primary: "#2D2C32",
      secondary: "#DD8E3C",
      support: "#D6403A",
      bg: "#000000",
      text: "#FBFBFB",
      light: "#FBFBFB",
    },
    logo: { file: "logo-liga-ctbmf.png", position: "bottom_right" },
    tipografia: { title: "Sans-serif bold condensada", body: "Sans-serif regular" },
    estilo: "Institucional · universitário · científico · sóbrio.",
    imagens: [
      "Laboratórios",
      "Estudantes em atividade acadêmica",
      "Hospital-escola",
      "Microscópio",
      "Radiografias/tomografias",
      "Anatomia / peças anatômicas (quando pertinente)",
      "Instrumentais",
    ],
    proibido: [
      "Identidade visual do consultório Dr. Francisco",
      "Cor fora da paleta da Liga",
      "Logo redesenhada",
      "Banco de imagens artificiais",
      "Fontes infantis/manuscritas",
    ],
    ganchos: ["Caso clínico", "Mito x Verdade", "Caiu na prova", "Curiosidade", "Erro comum", "Comparação", "Autoridade", "Desafio"],
  },
};

export function pickBrand(audiencia?: string): BrandKey {
  return audiencia === "estudantes-graduacao" ? "lactbmf" : "drfranciscomenezes";
}

export function brandBookPrompt(audiencia?: string): string {
  const key = pickBrand(audiencia);
  const b = BRAND_BOOK[key];
  return `
=== BRAND BOOK DIGITAL (Guardião da Marca — autoridade para REJEITAR arte fora do padrão) ===
PERFIL ATIVO: ${b.instagram} (${key})
POSICIONAMENTO: ${b.posicionamento}
PERSONALIDADE: ${b.personalidade.join(" · ")}
EMOÇÕES-ALVO: ${b.emocoes.join(" · ")}
OBJETIVO: ${b.objetivo}
PÚBLICO: ${b.publico}
PALETA (única permitida): primária ${b.paleta.primary} · secundária ${b.paleta.secondary} · apoio ${b.paleta.support} · fundo ${b.paleta.bg} · texto ${b.paleta.text} · neutro ${b.paleta.light}. Nunca usar cor fora desta paleta.
LOGO: A LOGO É APLICADA PELO SISTEMA COMO OVERLAY REAL, SEM FUNDO E SEM ÁREA RESERVADA. A IA NUNCA DEVE DESENHAR, IMITAR, ESCREVER, RECRIAR, RECORTAR, RECOLORIR OU SUGERIR A LOGO NA IMAGEM. NÃO crie espaço vazio, bloco, tarja, canto limpo, moldura, quadrado, fundo neutro ou placeholder para a logo; componha a arte normalmente. Qualquer arte que contenha logo desenhada pela IA ou área reservada visível será REJEITADA.
TIPOGRAFIA: títulos ${b.tipografia.title} · corpo ${b.tipografia.body}. Máximo 2 famílias. Headline curta (≤12 palavras), gigante, alto contraste, leitura em <3s.
ESTILO: ${b.estilo}
IMAGENS PERMITIDAS: ${b.imagens.join(" · ")}. A imagem deve comunicar a mensagem MESMO sem legenda; jamais decorativa.
GANCHOS PREFERENCIAIS: ${b.ganchos.join(" · ")}.
PROIBIDO: ${b.proibido.join(" · ")}.
CHECKLIST FINAL: perfil · logo · paleta · tipografia · grid · headline · CTA · objetivo · público · linguagem · imagem coerente · legenda coerente. Se QUALQUER item falhar, REFAZER antes de entregar.
=== FIM DO BRAND BOOK ===
`;
}
