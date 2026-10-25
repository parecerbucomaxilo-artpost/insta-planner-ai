// Catálogo ÚNICO de modelos de IA (texto e imagem). Usado pela interface e pelo servidor.
// Verificado em 25/10/2026 contra: catálogo da Lovable AI, docs Gemini API (OpenAI compat),
// docs Groq e catálogo público Pollinations (gen.pollinations.ai/image/models).
//
// Níveis:
//  - "gratis":       funciona sem chave, mas com limites fortes do provedor.
//  - "chave-gratis": exige cadastro e chave gratuita (camada gratuita com cota do provedor).
//  Modelos pagos (Lovable AI Gateway) foram REMOVIDOS: o app não gera cobrança de IA.
//  - "sem-ia":       conteúdo pronto do próprio app, sem IA.

export type NivelCusto = "gratis" | "chave-gratis" | "sem-ia";

export type ModeloInfo = {
  id: string;
  label: string;
  nivel: NivelCusto;
  nota?: string;
};

export const NIVEL_LABEL: Record<NivelCusto, string> = {
  gratis: "Grátis (com limites)",
  "chave-gratis": "Requer chave gratuita",
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
export function normalizeTextModel(v?: string | null): ModeloTexto {
  const id = ALIASES[v ?? ""] ?? v;
  return (MODELOS_IA.find((m) => m.id === id)?.id ?? DEFAULT_TEXT_MODEL) as ModeloTexto;
}
export function normalizeImageModel(v?: string | null): ModeloImagem {
  const id = ALIASES[v ?? ""] ?? v;
  return (MODELOS_IMAGEM.find((m) => m.id === id)?.id ?? DEFAULT_IMAGE_MODEL) as ModeloImagem;
}
