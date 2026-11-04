export const TIPOS_EDITORIAIS = ["Aleatória(s)", "Educativa", "Informação", "Curiosidades", "Prevenção", "Mitos e verdades"] as const;
export type TipoEditorial = typeof TIPOS_EDITORIAIS[number];
export function objetivoEditorial(tipo: TipoEditorial, fallback = "Educar") {
  return tipo === "Aleatória(s)" ? fallback : tipo;
}