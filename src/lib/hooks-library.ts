// ============================================================
// BIBLIOTECA DE GANCHOS (Prompt 5) — banco de dados fixo consultado
// ANTES de qualquer geração de imagem/legenda. A IA seleciona o
// gancho mais adequado ao tema; só cria um novo se NENHUM da
// biblioteca for compatível (mantendo o mesmo estilo).
// ============================================================

export interface HookEntry {
  frase: string; // TEXTO EXATO — nunca alterar
  temas: string[]; // palavras-chave que casam com o tema
  intencao: "conversao" | "autoridade" | "educativo" | "engajamento";
}

export const HOOKS_LIBRARY: HookEntry[] = [
  // ─── SISO / EXTRAÇÃO ───
  { frase: "O maior erro depois de extrair um siso", temas: ["siso", "extração", "pós-operatório", "alveolite"], intencao: "conversao" },
  { frase: "Ninguém te contou isso sobre o siso incluso", temas: ["siso", "incluso", "terceiro molar"], intencao: "autoridade" },
  { frase: "Por que seu siso dói mesmo antes de nascer?", temas: ["siso", "dor", "pericoronarite"], intencao: "conversao" },
  { frase: "Extrair siso no hospital muda tudo", temas: ["siso", "hospital", "anestesia geral"], intencao: "autoridade" },

  // ─── ATM / DTM / BRUXISMO ───
  { frase: "Sua dor de cabeça pode estar começando na mandíbula", temas: ["atm", "dtm", "dor", "cefaleia"], intencao: "conversao" },
  { frase: "O estalo na ATM não é normal", temas: ["atm", "estalo", "dtm"], intencao: "educativo" },
  { frase: "Bruxismo destrói mais do que dentes", temas: ["bruxismo", "atm", "desgaste"], intencao: "autoridade" },
  { frase: "Você está apertando os dentes agora?", temas: ["bruxismo", "apertamento"], intencao: "engajamento" },

  // ─── ORTOGNÁTICA ───
  { frase: "Aparelho não resolve tudo — e existe um motivo", temas: ["ortognática", "ortodontia", "mordida"], intencao: "autoridade" },
  { frase: "A cirurgia que muda o rosto e devolve o sono", temas: ["ortognática", "apneia", "face"], intencao: "conversao" },
  { frase: "Antes da ortognática, ninguém entendia sua queixa", temas: ["ortognática", "diagnóstico"], intencao: "conversao" },

  // ─── TRAUMA FACIAL ───
  { frase: "O primeiro erro no trauma de face é esperar", temas: ["trauma", "fratura", "urgência"], intencao: "conversao" },
  { frase: "Fratura facial não se conserta em casa", temas: ["trauma", "fratura"], intencao: "educativo" },
  { frase: "Uma pancada no queixo pode fraturar 3 ossos", temas: ["trauma", "mandíbula", "fratura"], intencao: "autoridade" },

  // ─── IMPLANTE / RECONSTRUÇÃO ───
  { frase: "Nem todo mundo pode receber um implante — e ninguém te avisa", temas: ["implante", "osso", "enxerto"], intencao: "autoridade" },
  { frase: "Sem osso, sem implante. E o que fazer então?", temas: ["implante", "enxerto", "reconstrução"], intencao: "educativo" },

  // ─── APNEIA / RONCO ───
  { frase: "Roncar não é frescura. É sinal de alerta", temas: ["ronco", "apneia", "sono"], intencao: "conversao" },
  { frase: "A apneia mata mais silenciosamente do que se imagina", temas: ["apneia", "sono"], intencao: "autoridade" },

  // ─── ODONTOLOGIA HOSPITALAR ───
  { frase: "Existe uma odontologia que salva vidas dentro do hospital", temas: ["hospitalar", "uti", "internado"], intencao: "autoridade" },
  { frase: "Paciente internado também precisa de dentista", temas: ["hospitalar", "uti"], intencao: "educativo" },
  { frase: "A boca é a porta de entrada da infecção hospitalar", temas: ["hospitalar", "infecção", "uti"], intencao: "autoridade" },

  // ─── PATOLOGIA / CISTO / TUMOR ───
  { frase: "Aquela bolinha na boca pode ser mais do que parece", temas: ["cisto", "tumor", "lesão"], intencao: "conversao" },
  { frase: "Cistos maxilares crescem em silêncio", temas: ["cisto", "maxila"], intencao: "educativo" },

  // ─── LIGA ACADÊMICA ───
  { frase: "O que ninguém ensina na graduação sobre CTBMF", temas: ["liga", "estudantes", "graduação"], intencao: "autoridade" },
  { frase: "Caiu na prova — e caiu na cirurgia real", temas: ["liga", "estudantes", "prova"], intencao: "engajamento" },
  { frase: "A anatomia que separa o bom cirurgião do mediano", temas: ["liga", "anatomia", "estudantes"], intencao: "autoridade" },
];

export function hooksLibraryPrompt(): string {
  const lista = HOOKS_LIBRARY
    .map((h, i) => `${i + 1}. "${h.frase}"  [temas: ${h.temas.join(", ")}]`)
    .join("\n");
  return `
=== BIBLIOTECA DE GANCHOS (Prompt 5 — CONSULTA OBRIGATÓRIA antes de qualquer geração) ===
REGRA: antes de escrever qualquer título, headline ou legenda, você DEVE percorrer esta biblioteca e escolher a frase que mais se aproxima do tema. Se houver mais de uma compatível, escolha a que gera MAIOR CURIOSIDADE. Só crie um gancho novo se NENHUMA frase for adequada — e mesmo assim mantendo exatamente o mesmo estilo (curto, provocativo, sem clichê, sem "agende consulta").

NUNCA modifique o gancho escolhido: nada de resumir, trocar verbos, mudar ordem, reescrever ou traduzir. Use EXATAMENTE como está.

APLICAÇÃO NA IMAGEM:
- O gancho é o MAIOR elemento visual da arte.
- Ocupa ~25% da composição, em fonte bold gigante, alto contraste.
- Nunca escondido, nunca em fonte pequena, nunca apenas na legenda.
- Hierarquia visual: 1) GANCHO (maior)  2) foto/ilustração  3) subtítulo curto  4) logo  5) @perfil.

RELAÇÃO IMAGEM ↔ LEGENDA:
- A legenda DEVE desenvolver exatamente a promessa do gancho — sem mudar de assunto.
- Estrutura obrigatória: 1) Abertura retomando o gancho  2) Contextualização (por que importa)  3) Desenvolvimento profundo com autoridade  4) Reflexão  5) Encerramento  6) UM único CTA.
- Nível de copywriting: Donald Miller / Cialdini / Eugene Schwartz / Hormozi — adaptado à ética médica. Autoridade + empatia + clareza + profundidade. Nunca raso, nunca genérico.

AUDITORIA FINAL (se qualquer item falhar, REFAZER):
[ ] Gancho vem da biblioteca?  [ ] Está escrito na imagem como maior elemento?  [ ] Legenda desenvolve exatamente esse gancho?  [ ] Legenda tem profundidade e ensina algo?  [ ] Parece escrita por copywriter médico profissional?

BIBLIOTECA:
${lista}
=== FIM DA BIBLIOTECA DE GANCHOS ===
`;
}
