// Geração de texto pela faixa gratuita da Gemini Developer API.
// A chave é lida exclusivamente no servidor; nunca enviar para o navegador ou logs.
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODEL = "gemini-3.1-flash-lite";

export async function generateGeminiFreeText(opts: {
  system?: string;
  prompt: string;
  maxTokens?: number;
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Gemini gratuito não configurado. Adicione GEMINI_API_KEY nos Secrets do projeto; nenhuma legenda foi gerada.",
    );
  }
  if (!opts.prompt.trim()) throw new Error("Prompt vazio; nenhuma legenda foi gerada.");

  const res = await fetch(`${GEMINI_API_URL}/${GEMINI_MODEL}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      ...(opts.system
        ? { systemInstruction: { parts: [{ text: opts.system }] } }
        : {}),
      contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
      generationConfig: {
        maxOutputTokens: opts.maxTokens ?? 1200,
        temperature: 0.7,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let detail = body.slice(0, 220);
    try {
      const parsed = JSON.parse(body);
      detail = String(parsed?.error?.message || detail).slice(0, 220);
    } catch {
      // Mantém apenas a mensagem curta retornada pela API.
    }
    if (res.status === 429) {
      throw new Error(
        "A cota gratuita do Gemini foi atingida ou está temporariamente limitada (HTTP 429). Aguarde a renovação da cota; nenhum texto substituto foi criado.",
      );
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "O Google recusou a chave Gemini (HTTP " + res.status + "). Confira GEMINI_API_KEY e as permissões; nada foi gerado.",
      );
    }
    throw new Error(`Gemini API texto HTTP ${res.status}: ${detail}`);
  }

  const json: any = await res.json();
  const candidate = json?.candidates?.[0];
  if (candidate?.finishReason === "SAFETY" || candidate?.finishReason === "RECITATION") {
    throw new Error("O Gemini bloqueou a resposta por segurança ou direitos autorais. Nada foi gerado.");
  }
  const result = (candidate?.content?.parts ?? [])
    .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
    .join("")
    .trim();
  if (!result) {
    throw new Error("Gemini API retornou uma resposta vazia; nenhum conteúdo simulado foi criado.");
  }
  return result;
}
