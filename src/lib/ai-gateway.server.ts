// Geração de texto/imagem com estratégia free-first.
// Catálogo único de modelos em src/lib/ai-models.ts (também usado pela interface).
// Provedores: Gemini API (chave gratuita), Groq (chave gratuita), Pollinations
// (grátis com limites / chave gratuita). SEM modelos pagos: o Lovable AI Gateway não é chamado.
// Chaves ficam SOMENTE em segredos do servidor; nunca são registradas em logs.
import * as jpeg from "jpeg-js";
import {
  MODELOS_IA,
  MODELOS_IMAGEM,
  DEFAULT_TEXT_MODEL,
  DEFAULT_IMAGE_MODEL,
  normalizeTextModel,
  normalizeImageModel,
  type ModeloTexto,
  type ModeloImagem,
} from "@/lib/ai-models";

export { MODELOS_IA, MODELOS_IMAGEM };
export type { ModeloTexto, ModeloImagem };


function sizeToWH(size?: string): { width: number; height: number } {
  if (size === "1536x1024") return { width: 1536, height: 1024 };
  if (size === "1024x1536") return { width: 1024, height: 1536 };
  return { width: 1024, height: 1024 };
}

/** Quais provedores gratuitos têm chave configurada (somente booleanos). */
export function freeProvidersStatus() {
  return {
    gemini: !!process.env.GEMINI_API_KEY,
    groq: !!process.env.GROQ_API_KEY,
    pollinations: !!process.env.POLLINATIONS_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    // Aceite explícito de cobrança: segredo do servidor com valor exatamente "sim".
    openaiPagoLiberado: process.env.OPENAI_ACEITO_COBRANCA?.trim().toLowerCase() === "sim",
    geminiPagoLiberado: process.env.GEMINI_ACEITO_COBRANCA?.trim().toLowerCase() === "sim",
  };
}

/** Bloqueia chamadas pagas sem chave + aceite. Mensagem explica o motivo ao usuário. */
function exigirPagoLiberado(provedor: "openai" | "gemini") {
  const s = freeProvidersStatus();
  if (provedor === "openai") {
    if (!s.openai) throw new Error("OpenAI API desativada: cadastre OPENAI_API_KEY em Secrets (a assinatura ChatGPT não inclui API).");
    if (!s.openaiPagoLiberado) throw new Error("OpenAI API é paga: adicione o segredo OPENAI_ACEITO_COBRANCA=sim para confirmar que aceita os custos.");
  } else {
    if (!s.gemini) throw new Error("Gemini API desativada: cadastre GEMINI_API_KEY em Secrets (a assinatura Gemini/Google One não inclui API).");
    if (!s.geminiPagoLiberado) throw new Error("Imagem pelo Gemini API é paga: adicione o segredo GEMINI_ACEITO_COBRANCA=sim para confirmar que aceita os custos.");
  }
}

/** True quando o modelo de texto escolhido pode, de fato, chamar alguma IA. */
export function textModelUsesAI(model?: string): boolean {
  const id = normalizeTextModel(model);
  const s = freeProvidersStatus();
  if (id === "local/sem-custo") return false;
  if (id === "auto/gratis") return s.gemini || s.groq || s.pollinations;
  if (id.startsWith("gemini/")) return s.gemini;
  if (id.startsWith("groq/")) return s.groq;
  if (id.startsWith("pollinations/")) return s.pollinations;
  if (id.startsWith("openai/")) return s.openai && s.openaiPagoLiberado;
  return false;
}

async function openAICompatChat(opts: {
  url: string;
  apiKey: string;
  model: string;
  system?: string;
  prompt: string;
  label: string;
}): Promise<string> {
  const res = await fetch(opts.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.apiKey}` },
    body: JSON.stringify({
      model: opts.model,
      messages: [
        ...(opts.system ? [{ role: "system", content: opts.system }] : []),
        { role: "user", content: opts.prompt },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${opts.label} texto ${res.status}: ${body.slice(0, 200)}`);
  }
  const json: any = await res.json();
  const txt = json?.choices?.[0]?.message?.content?.toString().trim() || "";
  if (!txt) throw new Error(`${opts.label}: resposta vazia`);
  return txt;
}

async function generateTextFree(provider: "gemini" | "groq" | "pollinations", model: string, system: string | undefined, prompt: string) {
  if (provider === "gemini") {
    const k = process.env.GEMINI_API_KEY;
    if (!k) throw new Error("GEMINI_API_KEY não configurada");
    return openAICompatChat({ url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", apiKey: k, model, system, prompt, label: "Gemini" });
  }
  if (provider === "groq") {
    const k = process.env.GROQ_API_KEY;
    if (!k) throw new Error("GROQ_API_KEY não configurada");
    return openAICompatChat({ url: "https://api.groq.com/openai/v1/chat/completions", apiKey: k, model, system, prompt, label: "Groq" });
  }
  const k = process.env.POLLINATIONS_API_KEY;
  if (!k) throw new Error("POLLINATIONS_API_KEY não configurada");
  return openAICompatChat({ url: "https://gen.pollinations.ai/v1/chat/completions", apiKey: k, model, system, prompt, label: "Pollinations" });
}

// ---------------- Texto ----------------

export async function generateTextAI(opts: {
  apiKey?: string;
  system?: string;
  prompt: string;
  model?: ModeloTexto | string;
  maxTokens?: number;
}): Promise<string> {
  const model = normalizeTextModel((opts.model as string) || DEFAULT_TEXT_MODEL);
  if (model === "local/sem-custo") throw new Error("Modelo sem IA selecionado");

  if (model === "auto/gratis") {
    // Cada provedor é tentado UMA vez (sem loops). Ordem: Gemini → Groq → Pollinations.
    const s = freeProvidersStatus();
    const chain: Array<["gemini" | "groq" | "pollinations", string]> = [];
    if (s.gemini) chain.push(["gemini", "gemini-3.8-flash"]);
    if (s.groq) chain.push(["groq", "openai/gpt-oss-120b"]);
    if (s.pollinations) chain.push(["pollinations", "openai"]);
    if (!chain.length) throw new Error("Nenhuma chave gratuita de texto configurada");
    const erros: string[] = [];
    for (const [p, m] of chain) {
      try {
        return await generateTextFree(p, m, opts.system, opts.prompt);
      } catch (err) {
        erros.push(err instanceof Error ? err.message : String(err));
      }
    }
    throw new Error(`Provedores gratuitos falharam: ${erros.join(" | ").slice(0, 400)}`);
  }
  if (model.startsWith("gemini/")) return generateTextFree("gemini", model.slice(7), opts.system, opts.prompt);
  if (model.startsWith("groq/")) return generateTextFree("groq", model.slice(5), opts.system, opts.prompt);
  if (model.startsWith("pollinations/")) return generateTextFree("pollinations", model.slice(13), opts.system, opts.prompt);
  if (model.startsWith("openai/")) {
    exigirPagoLiberado("openai");
    return openAICompatChat({ url: "https://api.openai.com/v1/chat/completions", apiKey: process.env.OPENAI_API_KEY!, model: model.slice(7), system: opts.system, prompt: opts.prompt, label: "OpenAI" });
  }

  throw new Error(`Modelo de texto não suportado: ${model}`);
}

// ---------------- Fallback local (gerador procedural anatômico) ----------------

function hashText(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}
function blend(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  const u = Math.max(0, Math.min(1, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * u),
    Math.round(a[1] + (b[1] - a[1]) * u),
    Math.round(a[2] + (b[2] - a[2]) * u),
  ];
}
function setPixel(px: Uint8Array, w: number, h: number, x: number, y: number, color: [number, number, number], alpha = 1) {
  const ix = Math.round(x), iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= w || iy >= h) return;
  const p = (iy * w + ix) * 4;
  const a = Math.max(0, Math.min(1, alpha));
  px[p] = Math.round(px[p] * (1 - a) + color[0] * a);
  px[p + 1] = Math.round(px[p + 1] * (1 - a) + color[1] * a);
  px[p + 2] = Math.round(px[p + 2] * (1 - a) + color[2] * a);
  px[p + 3] = 255;
}
function fillEllipse(px: Uint8Array, w: number, h: number, cx: number, cy: number, rx: number, ry: number, color: [number, number, number], alpha = 1) {
  const x0 = Math.max(0, Math.floor(cx - rx)), x1 = Math.min(w - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(h - 1, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const dx = (x - cx) / rx, dy = (y - cy) / ry;
    const d = dx * dx + dy * dy;
    if (d <= 1) setPixel(px, w, h, x, y, color, alpha * Math.min(1, (1 - d) * 2.5));
  }
}
function fillRect(px: Uint8Array, w: number, h: number, x: number, y: number, rw: number, rh: number, color: [number, number, number], alpha = 1) {
  const x0 = Math.max(0, Math.floor(x)), x1 = Math.min(w, Math.ceil(x + rw));
  const y0 = Math.max(0, Math.floor(y)), y1 = Math.min(h, Math.ceil(y + rh));
  for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) setPixel(px, w, h, xx, yy, color, alpha);
}

async function generateImageLocal(opts: { prompt: string; size?: "1024x1024" | "1024x1536" | "1536x1024" }): Promise<string> {
  const { width, height } = sizeToWH(opts.size);
  const px = new Uint8Array(width * height * 4);
  const seed = hashText(`${opts.prompt}|${Date.now()}|${Math.random()}`);
  const isLiga = /Liga Acadêmica|graduação|lactbmf|anhanguera/i.test(opts.prompt);
  const navy = hexToRgb(isLiga ? "#2D2C32" : "#0c2340");
  const navy2 = hexToRgb(isLiga ? "#111114" : "#14366b");
  const cyan = hexToRgb(isLiga ? "#DD8E3C" : "#2dd4ff");
  const white = hexToRgb("#ffffff");
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const radial = Math.hypot((x - width * 0.58) / width, (y - height * 0.38) / height);
    const t = Math.min(1, y / height * 0.7 + radial * 0.8);
    const c = blend(navy2, navy, t);
    const p = (y * width + x) * 4;
    px[p] = c[0]; px[p + 1] = c[1]; px[p + 2] = c[2]; px[p + 3] = 255;
  }
  fillEllipse(px, width, height, width * 0.72, height * 0.25, width * 0.28, height * 0.16, cyan, 0.10);
  fillEllipse(px, width, height, width * 0.18, height * 0.78, width * 0.22, height * 0.13, white, 0.06);
  const bandH = Math.round(height * 0.16);
  fillRect(px, width, height, 0, height - bandH, width, bandH, hexToRgb("#06182c"), 0.62);
  const out = jpeg.encode({ data: px, width, height }, 90).data;
  void seed;
  return Buffer.from(out).toString("base64");
}

// Pollinations.ai — documentado em gen.pollinations.ai. Sem chave: endpoint clássico
// image.pollinations.ai, limitado a 1 imagem a cada 45 s por IP (verificado em 25/10/2026).
// Com POLLINATIONS_API_KEY (cadastro gratuito em enter.pollinations.ai): gen.pollinations.ai.
async function generateImagePollinations(opts: {
  prompt: string;
  size: "1024x1024" | "1024x1536" | "1536x1024";
  model?: string; // "flux" | "zimage" | "flux-klein"
}): Promise<string> {
  const { width, height } = sizeToWH(opts.size);
  const model = (opts.model || "flux").replace(/^pollinations\//, "");
  // A API recebe o prompt na URL; limita o tamanho (o tema vem primeiro no prompt).
  const prompt = encodeURIComponent(opts.prompt.slice(0, 1800));
  const qs = `width=${width}&height=${height}&model=${encodeURIComponent(model)}&nologo=true&seed=${Math.floor(Math.random() * 1_000_000)}`;
  const key = process.env.POLLINATIONS_API_KEY;
  const res = key
    ? await fetch(`https://gen.pollinations.ai/image/${prompt}?${qs}`, { headers: { Authorization: `Bearer ${key}` } })
    : await fetch(`https://image.pollinations.ai/prompt/${prompt}?${qs}`);
  const ct = res.headers.get("content-type") || "";
  if (!res.ok || !ct.startsWith("image/")) {
    const body = await res.text().catch(() => "");
    throw new Error(`Pollinations imagem ${res.status}: ${body.slice(0, 200)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.toString("base64");
}

/**
 * Gera imagem com o modelo escolhido. NÃO troca silenciosamente por fundo procedural:
 * se a IA falhar, lança erro com o motivo. O fundo liso só é usado quando o usuário
 * escolhe "local/sem-custo" explicitamente (ou pelo chamador, que deve avisar o usuário).
 */
export async function generateImageBase64(opts: {
  apiKey?: string;
  prompt: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024";
  model?: ModeloImagem | string;
  referenceImageUrls?: string[];
}): Promise<string> {
  const size = opts.size ?? "1024x1024";
  const model = normalizeImageModel((opts.model as string) || DEFAULT_IMAGE_MODEL);

  if (model === "local/sem-custo") return generateImageLocal({ prompt: opts.prompt, size });
  if (model === "auto/gratis") return generateImagePollinations({ prompt: opts.prompt, size, model: "flux" });
  if (model.startsWith("pollinations/")) return generateImagePollinations({ prompt: opts.prompt, size, model });
  if (model.startsWith("openai/")) {
    exigirPagoLiberado("openai");
    return generateImageOpenAI({ prompt: opts.prompt, size, model: model.slice(7) });
  }
  if (model.startsWith("gemini/")) {
    exigirPagoLiberado("gemini");
    return generateImageGemini({ prompt: opts.prompt, size, model: model.slice(7) });
  }

  throw new Error(`Modelo de imagem não suportado: ${model}`);
}

// OpenAI Images API oficial (POST /v1/images/generations). Pago; só após aceite.
async function generateImageOpenAI(opts: { prompt: string; size: string; model: string }): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: opts.model, prompt: opts.prompt.slice(0, 30000), size: opts.size, n: 1 }),
  });
  if (!res.ok) throw new Error(`OpenAI imagem ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const json: any = await res.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI imagem: resposta sem imagem");
  return b64;
}

// Gemini API oficial (generateContent com saída de imagem). Pago; só após aceite.
async function generateImageGemini(opts: { prompt: string; size: string; model: string }): Promise<string> {
  const aspect = opts.size === "1536x1024" ? "3:2" : opts.size === "1024x1536" ? "2:3" : "1:1";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
    body: JSON.stringify({
      contents: [{ parts: [{ text: opts.prompt.slice(0, 30000) }] }],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: aspect } },
    }),
  });
  if (!res.ok) throw new Error(`Gemini imagem ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const json: any = await res.json();
  const parts: any[] = json?.candidates?.[0]?.content?.parts ?? [];
  const img = parts.find((p) => p?.inlineData?.data || p?.inline_data?.data);
  const b64 = img?.inlineData?.data ?? img?.inline_data?.data;
  if (!b64) throw new Error("Gemini imagem: resposta sem imagem");
  return b64;
}
