import { z } from "zod";

// Verified with authenticated GET /v1/models on 2026-11-01 (workspace_models: included).
// Only non-deprecated, non-preview models appear in new selections.
export const MODELOS_IA = [
  { id: "openai/gpt-6-luna", label: "GPT-6 Luna · econômico" },
  { id: "openai/gpt-6.1-sol", label: "GPT-6.1 Sol" },
  { id: "google/gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite · econômico" },
  { id: "google/gemini-3.8-flash", label: "Gemini 3.8 Flash" },
  { id: "google/gemini-4-argon", label: "Gemini 4 Argon" },
] as const;
export const MODELOS_IMAGEM = [
  { id: "google/gemini-3.1-flash-lite-image", label: "Gemini 3.1 Flash Lite Image · econômico" },
  { id: "google/gemini-3-pro-image", label: "Gemini 3 Pro Image" },
  { id: "openai/gpt-image-2.5-flare", label: "GPT Image 2.5 Flare · rápido" },
  { id: "openai/gpt-image-2.5-sunburst", label: "GPT Image 2.5 Sunburst" },
] as const;
export const DEFAULT_TEXT_MODEL = "openai/gpt-6-luna";
export const DEFAULT_IMAGE_MODEL = "google/gemini-3.1-flash-lite-image";
export const CLAUDE_REFERENCE_MODEL = "anthropic/claude-sonnet-5";

// Existing explicit choices remain unchanged while the catalog still supports them.
// Expired Gemini 2.5 text IDs and unverified Pollinations IDs are deliberately excluded.
const legacyText = [
  "openai/gpt-5-mini",
  "openai/gpt-5-nano",
  "openai/gpt-5",
  "openai/gpt-5.4-mini",
  "openai/gpt-5.4",
  "openai/gpt-5.5",
  "google/gemini-3-flash-preview",
  "google/gemini-3.1-pro-preview",
  "google/gemini-3.5-flash",
];
const legacyImage = [
  "google/gemini-3.1-flash-image",
  "google/gemini-2.5-flash-image",
  "openai/gpt-image-2",
  "openai/gpt-image-1-mini",
];

export function validateModel(value: string, kind: "text" | "image"): string {
  const allowed =
    kind === "text"
      ? [...MODELOS_IA.map((m) => m.id), ...legacyText]
      : [...MODELOS_IMAGEM.map((m) => m.id), ...legacyImage];
  if (!allowed.includes(value))
    throw new Error(
      `Modelo ${kind === "text" ? "de texto" : "de imagem"} indisponível ou não conectado: ${value}. Selecione uma opção atual; nenhuma substituição automática foi feita.`,
    );
  return value;
}
export const TextModelInput = z
  .string()
  .optional()
  .transform((v) => validateModel(v || DEFAULT_TEXT_MODEL, "text"));
export const ImageModelInput = z
  .string()
  .optional()
  .transform((v) => validateModel(v || DEFAULT_IMAGE_MODEL, "image"));

export function modelRoute(value: string, kind: "text" | "image") {
  validateModel(value, kind);
  if (kind === "text")
    return {
      provider: value.startsWith("openai/") ? "openai" : "google",
      endpoint: "/chat/completions",
      format: "chat",
    } as const;
  return {
    provider: value.startsWith("openai/") ? "openai" : "google",
    endpoint: "/images/generations",
    format:
      value === "google/gemini-3.1-flash-lite-image"
        ? "generate-content"
        : value.startsWith("openai/")
          ? "openai"
          : "gemini-chat",
  } as const;
}

// Provedores oferecidos nos seletores. Ambos rodam pelo gateway já conectado
// (créditos do workspace); nenhum segredo próprio é necessário.
export const PROVEDORES_IA = { openai: "OpenAI / ChatGPT", google: "Google Gemini" } as const;
export type ProvedorIA = keyof typeof PROVEDORES_IA;

export function provedorDoModelo(id: string): ProvedorIA {
  return id.startsWith("openai/") ? "openai" : "google";
}

export function modelosDoProvedor(kind: "text" | "image", prov: ProvedorIA) {
  const lista = kind === "text" ? MODELOS_IA : MODELOS_IMAGEM;
  return lista.filter((m) => provedorDoModelo(m.id) === prov);
}

/** Padrões econômicos de cada provedor (primeiro do catálogo verificado). */
export function padraoDoProvedor(kind: "text" | "image", prov: ProvedorIA): string {
  const m = modelosDoProvedor(kind, prov)[0];
  if (!m) throw new Error(`Nenhum modelo ${kind === "text" ? "de texto" : "de imagem"} disponível para ${PROVEDORES_IA[prov]}.`);
  return m.id;
}
