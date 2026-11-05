import { withRealism } from "@/lib/image-realism";
// Lovable AI Gateway — catalog-verified models, no provider fallback.
// A geração preserva o provedor selecionado e nunca retorna uma imagem substituta.

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";

/** Converte recusas do Gateway em mensagens acionáveis sem fingir que consultamos o saldo.
 * O Gateway não oferece neste fluxo uma consulta prévia de créditos; o status real
 * só é conhecido quando a chamada de geração é respondida.
 */
async function gatewayErrorMessage(res: Response, operation: "texto" | "imagem"): Promise<string> {
  const body = await res.text().catch(() => "");
  let detail = body.slice(0, 240);
  try {
    const parsed = JSON.parse(body);
    detail = String(parsed?.error?.message || parsed?.message || parsed?.error || detail).slice(0, 240);
  } catch {
    // Mantém o trecho textual retornado pelo Gateway.
  }
  if (res.status === 402) {
    return `Lovable AI recusou a geração de ${operation} (HTTP 402): possível saldo/créditos insuficientes ou cobrança não habilitada no workspace. Confira o uso e o faturamento do Lovable AI. Nenhum conteúdo substituto foi criado.`;
  }
  if (res.status === 429) {
    return `Lovable AI limitou a geração de ${operation} (HTTP 429): limite de uso ou de requisições atingido. Aguarde e confira os limites do workspace. Nenhum conteúdo substituto foi criado.`;
  }
  if (res.status === 401 || res.status === 403) {
    return `Lovable AI não autorizou a geração de ${operation} (HTTP ${res.status}): confira a chave e as permissões do workspace. Nenhum conteúdo substituto foi criado.`;
  }
  return `Lovable AI ${operation} HTTP ${res.status}: ${detail}`;
}

import { DEFAULT_TEXT_MODEL, DEFAULT_IMAGE_MODEL, GEMINI_FREE_TEXT_MODEL, modelRoute, validateModel, PREFIXO_OPENAI_DIRETO } from "./ai-models";
export { MODELOS_IA, MODELOS_IMAGEM } from "./ai-models";

// ---------------- Texto: GPT-5 mini via Lovable Gateway ----------------

export async function generateTextAI(opts: {
  apiKey?: string;
  system?: string;
  prompt: string;
  model?: string;
  maxTokens?: number;
}): Promise<string> {
  const model = validateModel(opts.model || DEFAULT_TEXT_MODEL, "text");
  if (model === GEMINI_FREE_TEXT_MODEL) {
    const { generateGeminiFreeText } = await import("./gemini-free.server");
    return generateGeminiFreeText({
      system: opts.system,
      prompt: opts.prompt,
      maxTokens: opts.maxTokens,
    });
  }
  if (model.startsWith(PREFIXO_OPENAI_DIRETO)) {
    const { openaiDiretoTexto } = await import("./openai-direct.server");
    return openaiDiretoTexto({ model, system: opts.system, prompt: opts.prompt });
  }
  const apiKey = opts.apiKey || process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

  const res = await fetch(`${GATEWAY_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model,
      messages: [
        ...(opts.system ? [{ role: "system", content: opts.system }] : []),
        { role: "user", content: opts.prompt },
      ],
      ...(model === "openai/gpt-6-luna" ? { reasoning_effort: "none" } : {}),
      // Model upgrades omit optional legacy output caps. Legacy preferences retain theirs.
      ...(![
        "openai/gpt-6-luna",
        "openai/gpt-6.1-sol",
        "google/gemini-3.8-flash",
        "google/gemini-4-argon",
      ].includes(model) && opts.maxTokens
        ? { [model.startsWith("openai/") ? "max_completion_tokens" : "max_tokens"]: opts.maxTokens }
        : {}),
    }),
  });

  if (!res.ok) {
    throw new Error(await gatewayErrorMessage(res, "texto"));
  }
  const json: any = await res.json();
  if (
    json?.choices?.[0]?.message?.refusal ||
    json?.choices?.[0]?.finish_reason === "content_filter"
  )
    throw new Error("O provedor recusou a geração do texto. Solicitação encerrada.");
  const text = json?.choices?.[0]?.message?.content?.toString().trim();
  if (!text)
    throw new Error("Lovable AI texto: resposta vazia; nenhum conteúdo simulado foi criado.");
  return text;
}

// ---------------- Imagem: Gemini Nano Banana via Lovable Gateway ----------------

async function generateImageGateway(opts: {
  apiKey: string;
  prompt: string;
  model: string;
  size: "1024x1024" | "1024x1536" | "1536x1024";
  referenceImageUrls?: string[];
}): Promise<string> {
  const isOpenAIImage = opts.model.startsWith("openai/gpt-image");

  const fetchUrlAsB64 = async (url: string) => {
    const r2 = await fetch(url);
    if (!r2.ok) throw new Error(`Lovable AI imagem: falha ao baixar URL ${r2.status}`);
    const buf = Buffer.from(await r2.arrayBuffer());
    return buf.toString("base64");
  };

  const extractImageB64 = async (json: any): Promise<string> => {
    if (
      json?.error ||
      json?.choices?.[0]?.finish_reason === "content_filter" ||
      json?.choices?.[0]?.message?.refusal
    ) {
      throw new Error("O provedor recusou a geração da imagem. A solicitação foi encerrada.");
    }
    const first = json?.data?.[0];
    const direct = first?.b64_json || first?.image?.b64_json || first?.image?.base64;
    if (typeof direct === "string" && direct.trim()) {
      console.info("[image-response]", { model: opts.model, origin: "provider-inline" });
      return direct.startsWith("data:") ? direct.split(",")[1] || "" : direct;
    }
    const url = first?.url || first?.image_url?.url || first?.image_url;
    if (typeof url === "string" && url.trim()) {
      if (!url.startsWith("data:") && !url.startsWith("https://"))
        throw new Error("Origem da imagem inválida.");
      console.info("[image-response]", {
        model: opts.model,
        origin: url.startsWith("data:") ? "provider-inline" : new URL(url).origin,
      });
      return url.startsWith("data:") ? url.split(",")[1] || "" : fetchUrlAsB64(url);
    }
    throw new Error("Lovable AI imagem: resposta sem b64/url");
  };

  if (isOpenAIImage) {
    const res = await fetch(`${GATEWAY_URL}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.apiKey}`,
        "Lovable-API-Key": opts.apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: opts.model,
        prompt: opts.prompt,
        size: opts.size,
        n: 1,
        quality: "low",
      }),
    });
    if (!res.ok) {
      throw new Error(await gatewayErrorMessage(res, "imagem"));
    }
    const json: any = await res.json();
    return extractImageB64(json);
  }

  // Gemini image via endpoint oficial de imagens do Gateway. O shape é diferente
  // do OpenAI: usa messages + modalities; o retorno é normalizado em data[0].b64_json.
  const userContent: any[] = [{ type: "text", text: opts.prompt }];
  for (const url of opts.referenceImageUrls ?? []) {
    userContent.push({ type: "image_url", image_url: { url } });
  }
  const res = await fetch(`${GATEWAY_URL}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
      "Lovable-API-Key": opts.apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: opts.model,
      ...(modelRoute(opts.model, "image").format === "generate-content"
        ? {
            contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
            generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
          }
        : {
            messages: [
              { role: "user", content: userContent.length === 1 ? opts.prompt : userContent },
            ],
            modalities: ["image", "text"],
          }),
    }),
  });
  if (!res.ok) {
    throw new Error(await gatewayErrorMessage(res, "imagem"));
  }
  const json: any = await res.json();
  return extractImageB64(json);
}

export async function generateImageBase64(opts: {
  apiKey?: string;
  prompt: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024";
  model?: string;
  referenceImageUrls?: string[];
}): Promise<string> {
  const apiKey = opts.apiKey || process.env.LOVABLE_API_KEY;
  const size = opts.size ?? "1024x1024";
  const model = opts.model || DEFAULT_IMAGE_MODEL;

  if (!opts.prompt.trim()) throw new Error("Brief visual vazio; geração bloqueada.");
  opts = { ...opts, prompt: withRealism(opts.prompt) };
  if (model === "local/sem-custo") {
    throw new Error(
      "O modelo local não gera imagens contextuais. Selecione um dos geradores de imagem existentes para continuar; nenhuma imagem genérica foi criada.",
    );
  }
  validateModel(model, "image");
  if (model.startsWith(PREFIXO_OPENAI_DIRETO)) {
    const { openaiDiretoImagem } = await import("./openai-direct.server");
    return openaiDiretoImagem({ model, prompt: opts.prompt, size });
  }
  if (!apiKey)
    throw new Error("Gerador de imagem não configurado; nenhuma imagem substituta foi criada.");
  return generateImageGateway({
    apiKey,
    prompt: opts.prompt,
    model,
    size,
    referenceImageUrls: opts.referenceImageUrls,
  });
}
