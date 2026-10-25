// Catálogo ÚNICO de modelos de IA (texto e imagem). Usado pela interface e pelo servidor.
// Verificado em 25/10/2026 contra: catálogo da Lovable AI, docs Gemini API (OpenAI compat),
// docs Groq e catálogo público Pollinations (gen.pollinations.ai/image/models).
//
// Níveis:
//  - "gratis":       funciona sem chave, mas com limites fortes do provedor.
//  - "chave-gratis": exige cadastro e chave gratuita (camada gratuita com cota do provedor).
//  Modelos pagos (Lovable AI Gateway) foram REMOVIDOS: o app não gera cobrança de IA.
//  - "pago-opt-in":  API oficial com cobrança (OpenAI; imagem Gemini). DESATIVADO até o
//                    usuário cadastrar a chave E o segredo de aceite de cobrança no servidor.
//                    Nunca entra no modo "Automático grátis".
//  - "sem-ia":       conteúdo pronto do próprio app, sem IA.
//
// IMPORTANTE: assinaturas de consumidor (Gemini/Google One familiar, ChatGPT Plus/Team/familiar)
// NÃO incluem acesso à API. O app usa só as APIs oficiais (ai.google.dev / platform.openai.com)
// com chave própria — nunca o site/app do Gemini ou do ChatGPT.

export type NivelCusto = "gratis" | "chave-gratis" | "pago-opt-in" | "sem-ia";
export type Provedor = "gemini" | "openai" | "groq" | "pollinations" | "auto" | "local";

export type ModeloInfo = {
  id: string;
  label: string;
  nivel: NivelCusto;
  nota?: string;
  subtitulo?: string;
};

export const NIVEL_LABEL: Record<NivelCusto, string> = {
  gratis: "Grátis (com limites)",
  "chave-gratis": "Requer chave gratuita",
  "pago-opt-in": "Pago — exige chave + aceite de cobrança",
  "sem-ia": "Sem IA",
};

export const MODELOS_IA = [
  {
    id: "auto/gratis",
    label: "Automático grátis (Gemini → Groq → Pollinations)",
    nivel: "chave-gratis",
    nota: "Tenta os provedores gratuitos configurados, em ordem, uma vez cada. Sem nenhuma chave, usa o texto pronto do app.",
  },
  {
    id: "gemini/gemini-3.8-flash",
    label: "Gemini 3.8 Flash (Google AI Studio)",
    nivel: "chave-gratis",
    nota: "Chave GEMINI_API_KEY. Camada gratuita com limite diário de pedidos definido pelo Google.",
  },
  {
    id: "groq/openai/gpt-oss-120b",
    label: "GPT-OSS 120B (Groq)",
    nivel: "chave-gratis",
    nota: "Chave GROQ_API_KEY. Plano gratuito com limites por minuto e por dia.",
  },
  {
    id: "pollinations/openai",
    label: "GPT-5.4 nano (Pollinations)",
    nivel: "chave-gratis",
    nota: "Chave POLLINATIONS_API_KEY. Cota gratuita limitada.",
  },
  {
    id: "openai/gpt-5-mini",
    label: "ChatGPT",
    subtitulo: "API oficial da OpenAI · GPT-5 mini",
    nivel: "pago-opt-in",
    nota: "API oficial da OpenAI (platform.openai.com), cobrada por token. Exige OPENAI_API_KEY e OPENAI_ACEITO_COBRANCA=sim. A assinatura ChatGPT não inclui API.",
  },
  {
    id: "local/sem-custo",
    label: "Texto pronto do app",
    nivel: "sem-ia",
    nota: "Modelo de legenda pré-escrito, sem IA.",
  },
] as const satisfies readonly ModeloInfo[];

export const MODELOS_IMAGEM = [
  {
    id: "auto/gratis",
    label: "Automático grátis (Pollinations Flux)",
    nivel: "gratis",
    nota: "Sem chave: 1 imagem a cada 45 s por IP (carrosséis podem falhar). Com POLLINATIONS_API_KEY gratuita: mais cota.",
  },
  {
    id: "pollinations/flux",
    label: "Flux Schnell (Pollinations)",
    nivel: "gratis",
    nota: "Sem chave: 1 imagem/45 s por IP.",
  },
  {
    id: "pollinations/zimage",
    label: "Z-Image Turbo (Pollinations)",
    nivel: "gratis",
    nota: "Sem chave: 1 imagem/45 s por IP.",
  },
  {
    id: "pollinations/flux-klein",
    label: "FLUX.2 Klein (Pollinations)",
    nivel: "chave-gratis",
    nota: "Chave POLLINATIONS_API_KEY.",
  },
  {
    id: "gemini/gemini-3.1-flash-image",
    label: "Gemini",
    subtitulo: "API oficial do Google · Nano Banana 2",
    nivel: "pago-opt-in",
    nota: "Modelos de imagem do Gemini não têm camada gratuita na API. Exige GEMINI_API_KEY e GEMINI_ACEITO_COBRANCA=sim (conta com faturamento ativo).",
  },
  {
    id: "openai/gpt-image-2",
    label: "ChatGPT",
    subtitulo: "API oficial da OpenAI · GPT Image",
    nivel: "pago-opt-in",
    nota: "API oficial da OpenAI, cobrada por imagem/token. Exige OPENAI_API_KEY e OPENAI_ACEITO_COBRANCA=sim.",
  },
  {
    id: "local/sem-custo",
    label: "Fundo liso do app",
    nivel: "sem-ia",
    nota: "Apenas fundo em degradê da marca, sem IA.",
  },
] as const satisfies readonly ModeloInfo[];

export type ModeloTexto = (typeof MODELOS_IA)[number]["id"];
export type ModeloImagem = (typeof MODELOS_IMAGEM)[number]["id"];

export const DEFAULT_TEXT_MODEL: ModeloTexto = "auto/gratis";
export const DEFAULT_IMAGE_MODEL: ModeloImagem = "auto/gratis";

const ALIASES: Record<string, string> = {
  // IDs pagos antigos (openai/*, google/*) caem no padrão grátis via normalize.
  "pollinations/flux-realism": "pollinations/flux", // não existe mais no Pollinations
  "pollinations/turbo": "pollinations/zimage", // não existe mais no Pollinations
};

/** Normaliza valores legados/inválidos para um id válido do catálogo. */
export function provedorDoModelo(id: string): Provedor {
  if (id.startsWith("auto/")) return "auto";
  if (id.startsWith("local/")) return "local";
  return id.split("/")[0] as Provedor;
}

/** Status de conexão (somente booleanos vindos do servidor). */
export type StatusProvedores = {
  gemini: boolean;
  groq: boolean;
  pollinations: boolean;
  openai: boolean;
  openaiPagoLiberado: boolean;
  geminiPagoLiberado: boolean;
};

/** Um modelo pode ser usado agora? Pagos só com chave + aceite explícito de cobrança. */
export function modeloLiberado(m: ModeloInfo, s: StatusProvedores | null): boolean {
  if (m.nivel !== "pago-opt-in") return true;
  if (!s) return false;
  const p = provedorDoModelo(m.id);
  if (p === "openai") return s.openai && s.openaiPagoLiberado;
  if (p === "gemini") return s.gemini && s.geminiPagoLiberado;
  return false;
}

export function normalizeTextModel(v?: string | null): ModeloTexto {
  const id = ALIASES[v ?? ""] ?? v;
  return (MODELOS_IA.find((m) => m.id === id)?.id ?? DEFAULT_TEXT_MODEL) as ModeloTexto;
}
export function normalizeImageModel(v?: string | null): ModeloImagem {
  const id = ALIASES[v ?? ""] ?? v;
  return (MODELOS_IMAGEM.find((m) => m.id === id)?.id ?? DEFAULT_IMAGE_MODEL) as ModeloImagem;
}
