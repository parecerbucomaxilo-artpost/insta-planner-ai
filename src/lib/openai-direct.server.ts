// OpenAI direto com a chave própria do projeto (OPENAI_API_KEY), somente no servidor.
// O valor da chave nunca é lido para logs, respostas ou mensagens de erro.
import { nomeOficialOpenAI } from "./ai-models";

const OPENAI_URL = "https://api.openai.com/v1";

export const MSG_SEM_CHAVE =
  "OpenAI (chave própria) não configurada. Adicione o segredo OPENAI_API_KEY nas configurações do projeto (Secrets) ou escolha outro provedor. Nada foi gerado.";

export function chaveOpenAIConfigurada(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

function chave(): string {
  const k = process.env.OPENAI_API_KEY;
  if (!k) throw new Error(MSG_SEM_CHAVE);
  return k;
}

let cache: { ids: Set<string>; em: number } | null = null;

/** Modelos realmente liberados para a chave (endpoint oficial GET /v1/models), em cache por 10 min. */
export async function modelosDaChave(fetchFn: typeof fetch = fetch): Promise<Set<string>> {
  if (cache && Date.now() - cache.em < 10 * 60_000) return cache.ids;
  const res = await fetchFn(`${OPENAI_URL}/models`, { headers: { Authorization: `Bearer ${chave()}` } });
  if (res.status === 401) throw new Error("A chave OpenAI foi recusada (401). Atualize OPENAI_API_KEY; nada foi gerado.");
  if (!res.ok) throw new Error(`OpenAI indisponível ao listar modelos (${res.status}). Nada foi gerado.`);
  const json: any = await res.json();
  const ids = new Set<string>((json?.data ?? []).map((m: any) => String(m?.id ?? "")));
  cache = { ids, em: Date.now() };
  return ids;
}
export function _limparCacheModelos() { cache = null; }

async function exigirModelo(id: string, fetchFn: typeof fetch): Promise<string> {
  const oficial = nomeOficialOpenAI(id);
  const ids = await modelosDaChave(fetchFn);
  if (!ids.has(oficial))
    throw new Error(`O modelo ${oficial} não está liberado para esta chave OpenAI. Escolha outro modelo ou provedor; nenhuma substituição automática foi feita.`);
  return oficial;
}

export async function openaiDiretoTexto(
  opts: { model: string; system?: string; prompt: string },
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const model = await exigirModelo(opts.model, fetchFn);
  const res = await fetchFn(`${OPENAI_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${chave()}` },
    body: JSON.stringify({
      model,
      messages: [...(opts.system ? [{ role: "system", content: opts.system }] : []), { role: "user", content: opts.prompt }],
    }),
  });
  if (res.status === 429) throw new Error("OpenAI: limite de uso ou saldo da conta atingido (429). Nada foi gerado.");
  if (!res.ok) throw new Error(`OpenAI texto ${res.status}. Nada foi gerado.`);
  const json: any = await res.json();
  const c = json?.choices?.[0];
  if (c?.message?.refusal || c?.finish_reason === "content_filter") throw new Error("A OpenAI recusou a geração do texto.");
  const text = c?.message?.content?.toString().trim();
  if (!text) throw new Error("OpenAI texto: resposta vazia; nenhum conteúdo simulado foi criado.");
  return text;
}

export async function openaiDiretoImagem(
  opts: { model: string; prompt: string; size: string },
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const model = await exigirModelo(opts.model, fetchFn);
  const res = await fetchFn(`${OPENAI_URL}/images/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${chave()}` },
    body: JSON.stringify({ model, prompt: opts.prompt, size: opts.size, n: 1, quality: "low" }),
  });
  if (res.status === 429) throw new Error("OpenAI: limite de uso ou saldo da conta atingido (429). Nenhuma imagem foi criada.");
  if (!res.ok) throw new Error(`OpenAI imagem ${res.status}. Nenhuma imagem foi criada.`);
  const json: any = await res.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (typeof b64 !== "string" || !b64) throw new Error("OpenAI imagem: resposta sem imagem; nada substituto foi criado.");
  return b64;
}
