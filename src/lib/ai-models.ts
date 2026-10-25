// Catálogo ÚNICO de modelos de IA (texto e imagem). Usado pela interface e pelo servidor.
// Verificado em 25/10/2026 contra: catálogo da Lovable AI, docs Gemini API (OpenAI compat),
// docs Groq e catálogo público Pollinations (gen.pollinations.ai/image/models).
//
// Níveis:
//  - "gratis":       funciona sem chave, mas com limites fortes do provedor.
//  - "chave-gratis": exige cadastro e chave gratuita (camada gratuita com cota do provedor).
//  - "pago":         consome créditos do workspace (Lovable AI).
//  - "sem-ia":       conteúdo pronto do próprio app, sem IA.

export type NivelCusto = "gratis" | "chave-gratis" | "pago" | "sem-ia";

export type ModeloInfo = {
  id: string;
  label: string;
  nivel: NivelCusto;
  nota?: string;
};

export const NIVEL_LABEL: Record<NivelCusto, string> = {
  gratis: "Grátis (com limites)",
  "chave-gratis": "Requer chave gratuita",
  pago: "Pago",
  "sem-ia": "Sem IA",
};

export const MODELOS_IA = [
  { id: "auto/gratis", label: "Automático grátis (Gemini → Groq → Pollinations)", nivel: "chave-gratis", nota: "Tenta os provedores gratuitos configurados, em ordem, uma vez cada. Sem nenhuma chave, usa o texto pronto do app." },
  { id: "gemini/gemini-3.8-flash", label: "Gemini 3.8 Flash (Google AI Studio)", nivel: "chave-gratis", nota: "Chave GEMINI_API_KEY. Camada gratuita com limite diário de pedidos definido pelo Google." },
  { id: "groq/openai/gpt-oss-120b", label: "GPT-OSS 120B (Groq)", nivel: "chave-gratis", nota: "Chave GROQ_API_KEY. Plano gratuito com limites por minuto e por dia." },
  { id: "pollinations/openai", label: "GPT-5.4 nano (Pollinations)", nivel: "chave-gratis", nota: "Chave POLLINATIONS_API_KEY. Cota gratuita limitada." },
  { id: "openai/gpt-5-mini", label: "GPT-5 mini", nivel: "pago" },
  { id: "openai/gpt-5-nano", label: "GPT-5 nano", nivel: "pago" },
  { id: "openai/gpt-5", label: "GPT-5", nivel: "pago" },
  { id: "openai/gpt-5.4-mini", label: "GPT-5.4 mini", nivel: "pago" },
  { id: "openai/gpt-5.4", label: "GPT-5.4", nivel: "pago" },
  { id: "openai/gpt-5.5", label: "GPT-5.5", nivel: "pago" },
  { id: "google/gemini-3.8-flash", label: "Gemini 3.8 Flash", nivel: "pago" },
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash", nivel: "pago" },
  { id: "google/gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite", nivel: "pago" },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", nivel: "pago" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", nivel: "pago" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", nivel: "pago" },
  { id: "local/sem-custo", label: "Texto pronto do app", nivel: "sem-ia", nota: "Modelo de legenda pré-escrito, sem IA." },
] as const satisfies readonly ModeloInfo[];

export const MODELOS_IMAGEM = [
  { id: "auto/gratis", label: "Automático grátis (Pollinations Flux)", nivel: "gratis", nota: "Sem chave: 1 imagem a cada 45 s por IP (carrosséis podem falhar). Com POLLINATIONS_API_KEY gratuita: mais cota." },
  { id: "pollinations/flux", label: "Flux Schnell (Pollinations)", nivel: "gratis", nota: "Sem chave: 1 imagem/45 s por IP." },
  { id: "pollinations/zimage", label: "Z-Image Turbo (Pollinations)", nivel: "gratis", nota: "Sem chave: 1 imagem/45 s por IP." },
  { id: "pollinations/flux-klein", label: "FLUX.2 Klein (Pollinations)", nivel: "chave-gratis", nota: "Chave POLLINATIONS_API_KEY." },
  { id: "google/gemini-3.1-flash-image", label: "Nano Banana 2 (Gemini)", nivel: "pago" },
  { id: "google/gemini-3-pro-image", label: "Gemini 3 Pro Image", nivel: "pago" },
  { id: "google/gemini-2.5-flash-image", label: "Nano Banana (Gemini)", nivel: "pago" },
  { id: "openai/gpt-image-2", label: "GPT Image 2", nivel: "pago" },
  { id: "openai/gpt-image-1-mini", label: "GPT Image 1 mini", nivel: "pago" },
  { id: "local/sem-custo", label: "Fundo liso do app", nivel: "sem-ia", nota: "Apenas fundo em degradê da marca, sem IA." },
] as const satisfies readonly ModeloInfo[];

export type ModeloTexto = (typeof MODELOS_IA)[number]["id"];
export type ModeloImagem = (typeof MODELOS_IMAGEM)[number]["id"];

export const DEFAULT_TEXT_MODEL: ModeloTexto = "auto/gratis";
export const DEFAULT_IMAGE_MODEL: ModeloImagem = "auto/gratis";

const ALIASES: Record<string, string> = {
  "google/gemini-3.5-flash": "google/gemini-3.8-flash", // descontinuado pelo Google
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
