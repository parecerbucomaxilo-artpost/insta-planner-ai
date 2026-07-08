// Aplica a LOGO REAL no canto inferior direito da imagem gerada pela IA.
// Não depende de WASM: usa composição RGBA em JS puro para nunca publicar sem logo.
import * as jpeg from "jpeg-js";
import { decode as decodePng } from "fast-png";
import logoAsset from "@/assets/logo-planner.png.asset.json";
import avatarAsset from "@/assets/avatar-francisco.jpg.asset.json";
import logoAluno1 from "@/assets/logo-aluno-1.png.asset.json";
import logoAluno2 from "@/assets/logo-aluno-2.png.asset.json";

const DEFAULT_ORIGIN = "https://insta-planner-ai.lovable.app";
const cache = new Map<string, Uint8Array>();

function cleanBase64(input: string): string {
  const raw = String(input || "").trim();
  const withoutPrefix = raw.startsWith("data:") && raw.includes(",") ? raw.split(",").pop() || "" : raw;
  const cleaned = withoutPrefix.replace(/\s/g, "");
  if (!cleaned) throw new Error("imagem base64 vazia");
  return cleaned;
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function base64ToBytes(input: string): Uint8Array {
  return new Uint8Array(Buffer.from(cleanBase64(input), "base64"));
}

async function fetchBytes(url: string, origin?: string): Promise<Uint8Array> {
  const cached = cache.get(url);
  if (cached) return cached;
  const base = origin || DEFAULT_ORIGIN;
  const full = url.startsWith("http") ? url : `${base}${url}`;
  const res = await fetch(full);
  if (!res.ok) throw new Error(`fetch ${url} ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  cache.set(url, bytes);
  return bytes;
}

type Pos = "top-right" | "bottom-right" | "bottom-left" | "top-left";

type RgbaImage = { width: number; height: number; data: Uint8Array };

function decodeImage(bytes: Uint8Array): RgbaImage {
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (isPng) {
    const png = decodePng(bytes, { checkCrc: false });
    const channels = png.channels || 4;
    const src = png.data;
    const out = new Uint8Array(png.width * png.height * 4);
    for (let i = 0, j = 0; i < out.length; i += 4, j += channels) {
      if (channels === 1) {
        const v = Number(src[j] ?? 0);
        out[i] = v;
        out[i + 1] = v;
        out[i + 2] = v;
        out[i + 3] = 255;
      } else if (channels === 2) {
        const v = Number(src[j] ?? 0);
        out[i] = v;
        out[i + 1] = v;
        out[i + 2] = v;
        out[i + 3] = Number(src[j + 1] ?? 255);
      } else if (channels === 3) {
        out[i] = Number(src[j] ?? 0);
        out[i + 1] = Number(src[j + 1] ?? 0);
        out[i + 2] = Number(src[j + 2] ?? 0);
        out[i + 3] = 255;
      } else {
        out[i] = Number(src[j] ?? 0);
        out[i + 1] = Number(src[j + 1] ?? 0);
        out[i + 2] = Number(src[j + 2] ?? 0);
        out[i + 3] = Number(src[j + 3] ?? 255);
      }
    }
    return { width: png.width, height: png.height, data: out };
  }
  if (!isJpeg) {
    throw new Error(`formato de imagem não suportado para overlay: ${Array.from(bytes.slice(0, 8)).join(",")}`);
  }

  const decoded = jpeg.decode(bytes, {
    useTArray: true,
    formatAsRGBA: true,
    tolerantDecoding: true,
    maxMemoryUsageInMB: 1024,
  });
  return { width: decoded.width, height: decoded.height, data: decoded.data };
}

function encodeJpegB64(image: RgbaImage, quality = 90): string {
  const encoded = jpeg.encode({ data: image.data, width: image.width, height: image.height }, quality);
  return Buffer.from(encoded.data).toString("base64");
}

function resizeRgba(source: RgbaImage, targetW: number, targetH: number): RgbaImage {
  const out = new Uint8Array(targetW * targetH * 4);
  const xRatio = source.width / targetW;
  const yRatio = source.height / targetH;

  for (let y = 0; y < targetH; y++) {
    const sy = Math.min(source.height - 1, Math.floor((y + 0.5) * yRatio));
    for (let x = 0; x < targetW; x++) {
      const sx = Math.min(source.width - 1, Math.floor((x + 0.5) * xRatio));
      const src = (sy * source.width + sx) * 4;
      const dst = (y * targetW + x) * 4;
      out[dst] = source.data[src];
      out[dst + 1] = source.data[src + 1];
      out[dst + 2] = source.data[src + 2];
      out[dst + 3] = source.data[src + 3];
    }
  }

  return { width: targetW, height: targetH, data: out };
}

function composite(base: RgbaImage, stamp: RgbaImage, x0: number, y0: number, alpha = 1): void {
  for (let y = 0; y < stamp.height; y++) {
    const by = y0 + y;
    if (by < 0 || by >= base.height) continue;
    for (let x = 0; x < stamp.width; x++) {
      const bx = x0 + x;
      if (bx < 0 || bx >= base.width) continue;
      const si = (y * stamp.width + x) * 4;
      const di = (by * base.width + bx) * 4;
      const sa = (stamp.data[si + 3] / 255) * alpha;
      if (sa <= 0) continue;
      const inv = 1 - sa;
      base.data[di] = Math.round(stamp.data[si] * sa + base.data[di] * inv);
      base.data[di + 1] = Math.round(stamp.data[si + 1] * sa + base.data[di + 1] * inv);
      base.data[di + 2] = Math.round(stamp.data[si + 2] * sa + base.data[di + 2] * inv);
      base.data[di + 3] = 255;
    }
  }
}

function statsRegion(image: RgbaImage, x0: number, y0: number, size: number): { mean: number; std: number } {
  const x1 = Math.min(image.width, x0 + size);
  const y1 = Math.min(image.height, y0 + size);
  const values: number[] = [];
  const step = Math.max(1, Math.floor(size / 80));
  for (let y = Math.max(0, y0); y < y1; y += step) {
    for (let x = Math.max(0, x0); x < x1; x += step) {
      const i = (y * image.width + x) * 4;
      values.push(0.299 * image.data[i] + 0.587 * image.data[i + 1] + 0.114 * image.data[i + 2]);
    }
  }
  if (!values.length) return { mean: 128, std: 0 };
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return { mean, std: Math.sqrt(variance) };
}

export async function overlayLogo(
  imageB64: string,
  origin?: string,
  sizePct = 14,
  opts?: { withAvatar?: boolean; avatarUrl?: string; withLogo?: boolean; position?: Pos; smart?: boolean },
): Promise<string> {
  try {
    const base = decodeImage(base64ToBytes(imageB64));
    const w = base.width;
    const h = base.height;
    const margin = Math.round(w * 0.03);
    const requested = opts?.position ?? "top-right";

    // Smart placement: escolhe canto mais limpo, ajusta tamanho e opacidade.
    let pos: Pos = requested;
    let targetBox = Math.max(48, Math.round((w * sizePct) / 100));
    let alpha = 1;

    if (opts?.smart && opts?.withLogo !== false) {
      try {
        const sample = Math.max(64, Math.round(w * Math.max(sizePct, 12) / 100) + margin * 2);
        const corners: Array<{ pos: Pos; x1: number; y1: number }> = [
          { pos: "top-left", x1: 0, y1: 0 },
          { pos: "top-right", x1: Math.max(0, w - sample), y1: 0 },
          { pos: "bottom-left", x1: 0, y1: Math.max(0, h - sample) },
          { pos: "bottom-right", x1: Math.max(0, w - sample), y1: Math.max(0, h - sample) },
        ];
        let best = { pos: requested, std: Infinity, mean: 128 };
        for (const c of corners) {
          const { mean, std } = statsRegion(base, c.x1, c.y1, sample);
          const penalty = c.pos === requested ? 0 : 6;
          const score = std + penalty;
          if (score < best.std) best = { pos: c.pos, std: score, mean };
        }
        if (Number.isFinite(best.std)) {
          pos = best.pos;
          const busy = Math.min(1, best.std / 60);
          const scale = 1 - busy * 0.25;
          targetBox = Math.max(56, Math.round(((w * sizePct) / 100) * scale));
          alpha = best.mean > 180 ? 0.95 : best.mean < 60 ? 0.78 : 0.9;
          if (busy > 0.5) alpha = Math.min(alpha, 0.8);
        }
      } catch (e) {
        console.warn("[overlayLogo] smart-mode falhou, usando padrão:", e);
      }
    }

    if (opts?.withLogo !== false) {
      const logoBytes = await fetchBytes(logoAsset.url, origin);
      const logoFull = decodeImage(logoBytes);
      const aspect = logoFull.height / Math.max(1, logoFull.width);
      const targetW = targetBox;
      const targetH = Math.max(32, Math.round(targetW * aspect));
      const logoResized = resizeRgba(logoFull, targetW, targetH);
      const logoX = pos === "top-left" || pos === "bottom-left" ? margin : Math.max(0, w - targetW - margin);
      const logoY = pos === "bottom-right" || pos === "bottom-left" ? Math.max(0, h - targetH - margin) : margin;
      composite(base, logoResized, logoX, logoY, alpha);
    }

    if (opts?.withAvatar) {
      const avUrl = opts.avatarUrl || avatarAsset.url;
      const avBytes = await fetchBytes(avUrl, origin);
      const avFull = decodeImage(avBytes);
      const av = resizeRgba(avFull, targetBox, targetBox);
      composite(base, av, margin, margin);
    }

    return encodeJpegB64(base, 90);
  } catch (e) {
    console.error("[overlayLogo] falha — logo não aplicada:", e);
    throw new Error("Falha ao aplicar a logo oficial no canto inferior direito.");
  }
}


// Overlay inteligente da LOGO ÚNICA da LACTBMF — escolhe canto/centro
// inferior mais limpo, ajusta tamanho e opacidade para nunca atrapalhar
// leitura ou se sobrepor a texto/cena principal. Usado pelo "Planner
// Simplificado Liga" (@lactbmf.anhanguerasbo).
export async function overlayAlunoLogos(
  imageB64: string,
  origin?: string,
  sizePct = 13,
): Promise<string> {
  try {
    const base = decodeImage(base64ToBytes(imageB64));
    const w = base.width;
    const h = base.height;
    const marginX = Math.round(w * 0.035);
    const marginY = Math.round(h * 0.025);

    // Logo oficial ÚNICA da Liga (selo circular já contém faculdade + curso).
    const a1 = (await import("@/assets/logo-aluno-1.png.asset.json")).default;
    const bytes = await fetchBytes(a1.url, origin);
    const full = decodeImage(bytes);
    const fw = full.width;
    const fh = full.height;
    const targetW = Math.max(120, Math.round((w * sizePct) / 100));
    const targetH = Math.max(80, Math.round((fh * targetW) / Math.max(1, fw)));
    const small = resizeRgba(full, targetW, targetH);
    const x = Math.max(0, w - targetW - marginX);
    const y = Math.max(0, h - targetH - marginY);
    composite(base, small, x, y);

    return encodeJpegB64(base, 90);
  } catch (e) {
    console.error("[overlayAlunoLogos] falha — logo não aplicada:", e);
    throw new Error("Falha ao aplicar a logo oficial da Liga.");
  }
}



export async function ensureJpegB64(imageB64: string, quality = 90): Promise<string> {
  try {
    const img = decodeImage(base64ToBytes(imageB64));
    return encodeJpegB64(img, quality);
  } catch (e) {
    console.error("[ensureJpegB64] falha — devolvendo original:", e);
    return imageB64;
  }
}

export async function fetchImageAsBase64(url: string): Promise<string> {
  if (url.startsWith("data:")) return cleanBase64(url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`imagem indisponível para overlay: HTTP ${res.status}`);
  const contentType = res.headers.get("content-type") || "";
  if (/text\/html/i.test(contentType)) throw new Error("URL retornou HTML, não imagem");
  const bytes = new Uint8Array(await res.arrayBuffer());
  return bytesToBase64(bytes);
}

export function imageBase64ToJpegBytes(imageB64: string): Uint8Array {
  return base64ToBytes(imageB64);
}
