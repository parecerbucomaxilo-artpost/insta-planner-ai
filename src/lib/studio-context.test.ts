import { describe, expect, it } from 'vitest';
import { alterarContexto, novoMaterial, preencherContexto, restaurarMaterial, salvarMaterial, objetivoLocal } from './studio-context';
import { montarPromptTexto, montarPromptImagem, type Briefing } from './advanced-ai';

function storage() { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; }
const briefing: Briefing = { marca: 'chico', tema: '', objetivo: '', telefone: '', contexto: '', rede: 'instagram', formato: 'Carrossel', nivel: 'leigo', tamanho: 'medio', tom: '', cta: '' };
describe('Contexto único por material', () => {
  it('reaproveita a escolha em texto, revisão, legenda e imagens de todos os formatos', () => {
    const m = alterarContexto(alterarContexto(novoMaterial('u1', 'chico'), 'tema', 'Biópsia bucal'), 'objetivo', 'Orientar');
    const b = { ...briefing, tema: m.tema, objetivo: m.objetivo };
    for (const v of ['curta', 'media', 'humanizada', 'tecnica', 'instagram', 'linkedin', 'google'] as const) {
      const p = montarPromptTexto(b, [v], 'revisar-precisao', 'Edição manual');
      expect(p.match(/- Tema: Biópsia bucal/g)).toHaveLength(1);
      expect(p.match(/- Objetivo: Orientar/g)).toHaveLength(1);
    }
    for (const formato of ['feed', 'story', 'linkedin'] as const) for (const tipo of ['capa', 'unico', 'slide'] as const) {
      expect(montarPromptImagem(b, formato, tipo, 2)).toContain('Tema exato: Biópsia bucal. Objetivo: Orientar.');
    }
    expect(objetivoLocal(m.objetivo)).toBe('educativo');
  });
  it('restaura contexto e edições entre abas, modos e navegação', () => {
    const s = storage();
    const m = { ...alterarContexto(alterarContexto(novoMaterial('u1', 'liga'), 'tema', 'Anatomia'), 'objetivo', 'Educar'), rascunhos: { 'texto.legenda': 'Edição manual', 'ia.resultado': { titulo: 'Título já produzido' }, 'imagem.ajustes': { texto: 'Texto da arte' } } };
    salvarMaterial(m, s);
    expect(restaurarMaterial('u1', 'liga', s)).toEqual(m);
  });
  it('alteração central muda próximas gerações sem apagar conteúdo manual nem imagens', () => {
    const m = { ...novoMaterial('u1', 'chico'), rascunhos: { legenda: 'Minha edição', imagens: ['https://example.com/arte.jpg'] } };
    const novo = alterarContexto(alterarContexto(m, 'tema', 'Siso'), 'objetivo', 'Prevenir');
    expect(novo.rascunhos).toEqual(m.rascunhos);
    expect(montarPromptTexto({ ...briefing, tema: novo.tema, objetivo: novo.objetivo }, ['media'])).toContain('- Objetivo: Prevenir');
  });
  it('novo material começa vazio e mantém o anterior arquivado sem herança', () => {
    const s = storage(); const antigo = alterarContexto(novoMaterial('u1', 'chico'), 'tema', 'Siso'); salvarMaterial(antigo, s);
    const novo = novoMaterial('u1', 'chico'); salvarMaterial(novo, s);
    expect(novo.id).not.toBe(antigo.id); expect(novo.tema).toBe(''); expect(novo.objetivo).toBe(''); expect(novo.rascunhos).toEqual({});
    expect(restaurarMaterial('u1', 'chico', s).id).toBe(novo.id);
  });
  it('não cruza usuário nem perfil editorial', () => {
    const s = storage(); salvarMaterial(alterarContexto(novoMaterial('u1', 'chico'), 'tema', 'Siso'), s);
    expect(restaurarMaterial('u2', 'chico', s).tema).toBe('');
    expect(restaurarMaterial('u1', 'liga', s).tema).toBe('');
  });
  it('Dashboard só preenche campos vazios ainda não escolhidos, inclusive escolha de limpar', () => {
    const inicial = novoMaterial('u1', 'chico');
    expect(preencherContexto(inicial, {}).objetivo).toBe(''); expect(objetivoLocal('')).toBeNull();
    const escolhido = alterarContexto(alterarContexto(inicial, 'tema', 'Minha escolha'), 'objetivo', '');
    expect(preencherContexto(escolhido, { tema: 'Outro', objetivo: 'Educar' })).toMatchObject({ tema: 'Minha escolha', objetivo: '' });
    expect(preencherContexto(inicial, { tema: 'Tema cadastrado', objetivo: 'Informar' })).toMatchObject({ tema: 'Tema cadastrado', objetivo: 'Informar' });
  });
});