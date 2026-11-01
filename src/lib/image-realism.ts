// Padrão GLOBAL de realismo para toda geração de imagem (post único, capa, slides).
// Não define paleta nem identidade: cada perfil mantém as suas cores.
export const REALISM_DIRECTIVE = `
=== PADRÃO VISUAL GLOBAL: REALISMO NATURAL ===
- Padrão: fotografia editorial/comercial autêntica, como feita por fotógrafo profissional com câmera real (lente 35–85mm, profundidade de campo natural).
- Pessoas com pele de textura real (poros, pequenas imperfeições), mãos com 5 dedos e proporções corretas, expressões naturais, rostos não genéricos.
- Iluminação plausível (natural ou clínica real), texturas reais, cenários coerentes, composição profissional e limpa.
- EVITAR aparência de IA: pele plástica/encerada, brilho excessivo, objetos fundidos, dedos deformados, anatomia incorreta, render 3D, CGI, ilustração, cartoon, gradientes e ornamentos decorativos artificiais, HDR exagerado.
- Exceção: se o pedido exigir explicitamente ilustração, infográfico, esquema ou diagrama, manter esse formato com acabamento limpo e tecnicamente correto.
- Conteúdo médico/odontológico: anatomia precisa; não inventar procedimentos, instrumentos ou estruturas. Se não for possível garantir anatomia realista, preferir fotografia clínica/editorial segura (profissional, ambiente, paciente vestido, exame real) ou composição conceitual sem detalhes anatômicos falsos.
- Manter a paleta e a identidade do perfil indicadas no restante deste prompt.
=== FIM DO PADRÃO VISUAL ===`;

export function withRealism(prompt: string): string {
  return prompt.includes("PADRÃO VISUAL GLOBAL") ? prompt : `${prompt}\n${REALISM_DIRECTIVE}`;
}
