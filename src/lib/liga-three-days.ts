import { FORMATO_POR_HORARIO_IG, HORARIOS_POSTAGEM, horarioNoFuso } from "./post-slots";
import type { ItemSemana } from "./week-plan";

const TEMAS = [
  "Infecção odontogênica: por que reconhecer os sinais de disseminação — sinais de alerta",
  "Siso incluso: perguntas para revisar antes do estudo de imagem — curiosidades",
  "Dentes inclusos: posição, anatomia e planejamento cirúrgico — anatomia aplicada",
  "Trauma dentoalveolar: o que observar no exame inicial — orientação",
  "Trauma dentoalveolar: prioridades na avaliação e encaminhamento — raciocínio clínico",
  "Biópsia oral: perguntas sobre a escolha da técnica — curiosidades",
  "Lesões orais persistentes: registro e investigação responsável — diagnóstico",
  "Fraturas faciais: observação de função e assimetria — sinais de alerta",
  "Fraturas faciais: avaliação sistemática sem diagnóstico por fotografia — educativa",
  "ATM: perguntas sobre dor e limitação de abertura — curiosidades",
  "Disfunções da ATM: história clínica e avaliação funcional — informação",
  "Cistos maxilares: imagem não é diagnóstico definitivo — mito ou verdade",
  "Cistos maxilares: integrar clínica, imagem e histopatologia — educativa",
];
export function planoLigaAteDia7(): ItemSemana[] {
  let n = 0;
  return [4, 5, 6, 7].flatMap(dia => (dia === 4 ? ["21:00" as const] : [...HORARIOS_POSTAGEM]).map(horario => ({
    key: `liga-2026-11-${dia}-${horario}`,
    diaSemana: ["Quarta", "Quinta", "Sexta", "Sábado"][dia - 4],
    dataLabel: `${String(dia).padStart(2, "0")}/11 ${horario}`,
    horario,
    quando: horarioNoFuso(2026, 10, dia, horario).toISOString(),
    tema: TEMAS[n++],
    objetivo: horario === "09:00" || horario === "18:00" ? "Curiosidades" : "Educar",
    formato: FORMATO_POR_HORARIO_IG[horario],
    rede: "instagram" as const,
  })));
}