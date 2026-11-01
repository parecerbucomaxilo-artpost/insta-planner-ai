// Regra GLOBAL de linguagem para textos gerados (todos os perfis).
// Público geral por padrão; nível técnico preservado só quando o post é para especialistas/estudantes.
export function isPublicoTecnico(p: { audiencia?: string; nivel?: string }): boolean {
  return p.audiencia === "estudantes-graduacao" || p.nivel === "linkedin-cientifico";
}

export function plainLanguageRule(p: { audiencia?: string; nivel?: string }): string {
  if (isPublicoTecnico(p)) {
    return `
=== LINGUAGEM (público técnico: especialistas/estudantes) ===
- Manter a terminologia técnica necessária, com português brasileiro natural, frases claras e sem tom robótico.
- Siglas na primeira menção por extenso. Sem sensacionalismo, sem inventar dados, diagnósticos ou promessas.
=== FIM ===`;
  }
  return `
=== LINGUAGEM PARA O PÚBLICO GERAL (obrigatório) ===
- Escreva para quem não é da área: português brasileiro natural, frases curtas e claras, voz ativa.
- Troque termos técnicos por palavras do dia a dia; quando o termo for necessário, explique em seguida em linguagem simples (ex.: "ATM, a articulação que liga a mandíbula ao crânio").
- Sem jargão, sem siglas sem explicação, sem tom acadêmico, sem frases robóticas ou genéricas, sem sensacionalismo.
- Mantenha a precisão: não simplifique a ponto de distorcer fatos; não invente dados, diagnósticos, promessas ou recomendações individuais.
- Chamada para ação natural e acolhedora, respeitando as CTAs permitidas do perfil.
=== FIM ===`;
}
