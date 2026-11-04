// Aplica a LOGO REAL no canto inferior direito da imagem gerada pela IA.
// Não depende de WASM: usa composição RGBA em JS puro para nunca publicar sem logo.
import * as jpeg from "jpeg-js";
// upng-js: PNG decoder puro em JS (sem zlib nativo) — compatível com Cloudflare Workers.
// Substitui fast-png, que quebrava com "Class constructor Inflate cannot be invoked without 'new'".
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — upng-js não expõe types.
import UPNG from "upng-js";
import logoDrFranciscoAsset from "@/assets/logo-dr-francisco.png.asset.json";
import logoAnhanguera from "@/assets/logo-anhanguera-sbo.png?url";
import logoNspAsset from "@/assets/logo-nsp.png.asset.json";
import logoLiga from "@/assets/logo-liga-ctbmf.png?url";
import avatarAsset from "@/assets/avatar-francisco.jpg.asset.json";

const DEFAULT_ORIGIN = "https://insta-planner-ai.lovable.app";
const logoDrFrancisco = logoDrFranciscoAsset.url;
const logoNsp = logoNspAsset.url;
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
  let res = await fetch(full);
  // Em preview local, assets importados com ?url existem no Vite em localhost,
  // enquanto DEFAULT_ORIGIN aponta para o publicado. Tenta o host local antes
  // de bloquear a geração por logo indisponível.
  if (!res.ok && !origin && !url.startsWith("http")) {
    try {
      const local = `http://localhost:8080${url}`;
      res = await fetch(local);
    } catch {
      // mantém a resposta original para a mensagem de erro abaixo
    }
  }
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
    // UPNG.toRGBA8 devolve sempre RGBA 8-bit em ArrayBuffer, uma entrada por frame.
    const png = UPNG.decode(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    const frames = UPNG.toRGBA8(png);
    if (!frames || !frames.length) throw new Error("PNG sem frames decodificáveis");
    const rgba = new Uint8Array(frames[0]);
    return { width: png.width, height: png.height, data: rgba };
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
  const sw = source.width;
  const sh = source.height;
  const xRatio = sw / targetW;
  const yRatio = sh / targetH;

  // Bilinear com premultiplied alpha — evita halo escuro/borda serrilhada em
  // logos com transparência (o problema visual de "logo distorcida").
  for (let y = 0; y < targetH; y++) {
    const fy = (y + 0.5) * yRatio - 0.5;
    const y0 = Math.max(0, Math.floor(fy));
    const y1 = Math.min(sh - 1, y0 + 1);
    const wy = fy - y0;
    for (let x = 0; x < targetW; x++) {
      const fx = (x + 0.5) * xRatio - 0.5;
      const x0 = Math.max(0, Math.floor(fx));
      const x1 = Math.min(sw - 1, x0 + 1);
      const wx = fx - x0;

      const i00 = (y0 * sw + x0) * 4;
      const i01 = (y0 * sw + x1) * 4;
      const i10 = (y1 * sw + x0) * 4;
      const i11 = (y1 * sw + x1) * 4;

      const a00 = source.data[i00 + 3] / 255;
      const a01 = source.data[i01 + 3] / 255;
      const a10 = source.data[i10 + 3] / 255;
      const a11 = source.data[i11 + 3] / 255;

      const w00 = (1 - wx) * (1 - wy);
      const w01 = wx * (1 - wy);
      const w10 = (1 - wx) * wy;
      const w11 = wx * wy;

      const aOut = a00 * w00 + a01 * w01 + a10 * w10 + a11 * w11;
      const dst = (y * targetW + x) * 4;
      if (aOut <= 0.001) {
        out[dst] = 0; out[dst + 1] = 0; out[dst + 2] = 0; out[dst + 3] = 0;
        continue;
      }
      for (let c = 0; c < 3; c++) {
        const v =
          source.data[i00 + c] * a00 * w00 +
          source.data[i01 + c] * a01 * w01 +
          source.data[i10 + c] * a10 * w10 +
          source.data[i11 + c] * a11 * w11;
        out[dst + c] = Math.round(v / aOut);
      }
      out[dst + 3] = Math.round(aOut * 255);
    }
  }

  return { width: targetW, height: targetH, data: out };
}

// Recorta bordas totalmente transparentes de um PNG RGBA — o selo oficial
// da LACTBMF vem em canvas 1080x1350 com metade inferior transparente,
// o que fazia o overlay aparecer "cortado" (deslocado para cima).
function trimAlpha(image: RgbaImage): RgbaImage {
  const { width: w, height: h, data } = image;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0 || maxY < 0) return image;
  const nw = maxX - minX + 1;
  const nh = maxY - minY + 1;
  if (nw === w && nh === h) return image;
  const out = new Uint8Array(nw * nh * 4);
  for (let y = 0; y < nh; y++) {
    const srcRow = (y + minY) * w + minX;
    const dstRow = y * nw;
    for (let x = 0; x < nw; x++) {
      const s = (srcRow + x) * 4;
      const d = (dstRow + x) * 4;
      out[d] = data[s]; out[d+1] = data[s+1]; out[d+2] = data[s+2]; out[d+3] = data[s+3];
    }
  }
  return { width: nw, height: nh, data: out };
}

function removeNearWhiteMatte(image: RgbaImage): RgbaImage {
  const { width: w, height: h, data } = image;

  let transparentPixels = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] <= 8) transparentPixels++;
  }

  // A logo oficial do Prof. Francisco é majoritariamente branca, mas tem
  // transparência real ao redor. Se aplicarmos a remoção de branco nela, a
  // própria marca fica “cortada”. Só tratamos matte branco em arquivos sem
  // transparência útil (ex.: PNG/JPEG antigo exportado com fundo branco sólido).
  const transparentRatio = transparentPixels / Math.max(1, w * h);
  if (transparentRatio > 0.04) return image;

  const out = new Uint8Array(data);
  let changed = false;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = out[i];
      const g = out[i + 1];
      const b = out[i + 2];
      const a = out[i + 3];
      if (a <= 8) continue;

      // Remove fundos brancos/quase brancos exportados junto da logo.
      // Não remove a marca branca do Planner Chico porque o arquivo correto
      // tem transparência ao redor; este fallback só atua como proteção contra
      // PNG/JPEG antigos com canvas branco que cortava a arte em quadrado.
      const nearWhite = r > 242 && g > 242 && b > 242;
      const lowChroma = Math.max(r, g, b) - Math.min(r, g, b) < 14;
      const onOuterCanvas = x < w * 0.08 || x > w * 0.92 || y < h * 0.08 || y > h * 0.92;
      if (nearWhite && lowChroma && onOuterCanvas) {
        out[i + 3] = 0;
        changed = true;
      }
    }
  }

  return changed ? trimAlpha({ width: w, height: h, data: out }) : image;
}

function cropImage(image: RgbaImage, minX: number, minY: number, maxX: number, maxY: number): RgbaImage {
  const { width: w, data } = image;
  const pad = Math.max(2, Math.round(Math.max(maxX - minX + 1, maxY - minY + 1) * 0.025));
  const x0 = Math.max(0, minX - pad);
  const y0 = Math.max(0, minY - pad);
  const x1 = Math.min(image.width - 1, maxX + pad);
  const y1 = Math.min(image.height - 1, maxY + pad);
  const nw = x1 - x0 + 1;
  const nh = y1 - y0 + 1;
  if (nw === image.width && nh === image.height) return image;
  const out = new Uint8Array(nw * nh * 4);
  for (let y = 0; y < nh; y++) {
    const srcRow = (y + y0) * w + x0;
    const dstRow = y * nw;
    for (let x = 0; x < nw; x++) {
      const s = (srcRow + x) * 4;
      const d = (dstRow + x) * 4;
      out[d] = data[s]; out[d + 1] = data[s + 1]; out[d + 2] = data[s + 2]; out[d + 3] = data[s + 3];
    }
  }
  return { width: nw, height: nh, data: out };
}

function trimLogoCanvas(image: RgbaImage): RgbaImage {
  const alphaTrimmed = removeNearWhiteMatte(trimAlpha(image));
  const { width: w, height: h, data } = alphaTrimmed;
  const corner = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return [data[i], data[i + 1], data[i + 2]] as const;
  };
  const samples = [corner(0, 0), corner(w - 1, 0), corner(0, h - 1), corner(w - 1, h - 1)];
  const bg = samples.reduce((acc, rgb) => [acc[0] + rgb[0], acc[1] + rgb[1], acc[2] + rgb[2]], [0, 0, 0]).map((v) => v / samples.length);
  const isLikelySolidWhite = bg.every((v) => v > 232);
  if (!isLikelySolidWhite) return alphaTrimmed;

  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const delta = Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]);
      if (data[i + 3] > 8 && delta > 42) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0 || maxY < 0) return alphaTrimmed;
  return cropImage(alphaTrimmed, minX, minY, maxX, maxY);
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

// Chip/plate arredondado semi-transparente atrás da logo — evita a
// sensação de "logo colada por cima" e garante legibilidade sobre
// fundos ocupados ou coloridos.
function drawRoundedPlate(
  base: RgbaImage,
  x0: number,
  y0: number,
  w: number,
  h: number,
  radius: number,
  rgb: [number, number, number],
  alpha: number,
): void {
  const r = Math.min(radius, Math.floor(Math.min(w, h) / 2));
  for (let y = 0; y < h; y++) {
    const by = y0 + y;
    if (by < 0 || by >= base.height) continue;
    for (let x = 0; x < w; x++) {
      const bx = x0 + x;
      if (bx < 0 || bx >= base.width) continue;
      // corta cantos arredondados
      const dx = x < r ? r - x : x >= w - r ? x - (w - r - 1) : 0;
      const dy = y < r ? r - y : y >= h - r ? y - (h - r - 1) : 0;
      if (dx * dx + dy * dy > r * r) continue;
      const di = (by * base.width + bx) * 4;
      const inv = 1 - alpha;
      base.data[di] = Math.round(rgb[0] * alpha + base.data[di] * inv);
      base.data[di + 1] = Math.round(rgb[1] * alpha + base.data[di + 1] * inv);
      base.data[di + 2] = Math.round(rgb[2] * alpha + base.data[di + 2] * inv);
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
  opts?: { withAvatar?: boolean; avatarUrl?: string; withLogo?: boolean; position?: Pos; smart?: boolean; logoUrl?: string; logoUrls?: string[]; prominent?: boolean },
): Promise<string> {
  try {
    const base = decodeImage(base64ToBytes(imageB64));
    const w = base.width;
    const h = base.height;
    // Watermark discreto: logo pequena (~7% da largura), sem placa/chip, semi-transparente.
    const WATERMARK_PCT = 7;
    sizePct = Math.min(sizePct, opts?.prominent ? 18 : WATERMARK_PCT);
    const margin = Math.round(w * 0.028);
    const requested = opts?.position ?? "bottom-right";

    // Smart placement: escolhe canto mais limpo. Sem chip/plate — só ajusta opacidade.
    let pos: Pos = requested;
    let targetBox = Math.max(56, Math.round((w * sizePct) / 100));
    // Opacidade base do watermark (bem discreto).
    let alpha = opts?.prominent ? 1 : 0.42;

    if (opts?.smart && opts?.withLogo !== false) {
      try {
        const sample = Math.max(64, Math.round(w * Math.max(sizePct, 10) / 100) + margin * 2);
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
          // Watermark: sobe um pouco em fundo escuro (branco fica visível),
          // desce em fundo claro (evita "logo apagando" a arte).
          alpha = opts?.prominent ? 1 : best.mean > 180 ? 0.38 : best.mean < 60 ? 0.5 : 0.42;
        }
      } catch (e) {
        console.warn("[overlayLogo] smart-mode falhou, usando padrão:", e);
      }
    }

    if (opts?.withLogo !== false) {
      const logoUrls = (opts?.logoUrls?.length ? opts.logoUrls : [opts?.logoUrl || logoDrFrancisco]).filter(Boolean);
      const logoImages = await Promise.all(
        logoUrls.map(async (url) => trimLogoCanvas(decodeImage(await fetchBytes(url, origin)))),
      );

      const anchorX = (contentW: number) =>
        pos === "top-left" || pos === "bottom-left" ? margin : Math.max(0, w - contentW - margin);
      const anchorY = (contentH: number) =>
        pos === "top-right" || pos === "top-left" ? margin : Math.max(0, h - contentH - margin);

      if (logoImages.length > 1) {
        // Múltiplas logos em linha: mesma altura, gap pequeno, sem placa.
        const gap = Math.round(w * 0.014);
        const targetH = Math.max(40, Math.round(targetBox * 0.72));
        const resized = logoImages.map((logo) =>
          resizeRgba(logo, Math.max(30, Math.round((logo.width * targetH) / Math.max(1, logo.height))), targetH),
        );
        const totalW = resized.reduce((sum, logo) => sum + logo.width, 0) + gap * (resized.length - 1);
        // Se ficou largo demais, reduz proporcionalmente para caber em 45% da imagem.
        const maxW = Math.round(w * 0.45);
        const scale = totalW > maxW ? maxW / totalW : 1;
        const finalH = Math.max(28, Math.round(targetH * scale));
        const finalLogos = scale < 1
          ? logoImages.map((logo) => resizeRgba(logo, Math.max(24, Math.round((logo.width * finalH) / Math.max(1, logo.height))), finalH))
          : resized;
        const finalTotalW = finalLogos.reduce((sum, logo) => sum + logo.width, 0) + gap * (finalLogos.length - 1);
        const x0 = anchorX(finalTotalW);
        const y0 = anchorY(finalH);
        let cursorX = x0;
        for (const logo of finalLogos) {
          composite(base, logo, cursorX, y0, alpha);
          cursorX += logo.width + gap;
        }
      } else if (logoImages[0]) {
        const logoFull = logoImages[0];
        const aspect = logoFull.height / Math.max(1, logoFull.width);
        const isWideStrip = aspect < 0.35;
        const targetW = isWideStrip ? Math.round(w * 0.32) : targetBox;
        const targetH = Math.max(28, Math.round(targetW * aspect));
        const x0 = anchorX(targetW);
        const y0 = anchorY(targetH);
        const logoResized = resizeRgba(logoFull, targetW, targetH);
        composite(base, logoResized, x0, y0, alpha);
      }
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


// Overlay legado com trio institucional da Liga: Anhanguera, NSP e LACTBMF.
// A seleção manual do dashboard usa `overlayLogo`; esta função fica como
// fallback para fluxos antigos que não enviem `logoKey`.
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

    // 3 logos institucionais fixas para publicações antigas/automáticas da Liga:
    // Anhanguera (esq.), NSP (centro), LACTBMF (dir.).
    const [anhangueraBytes, nspBytes, ligaBytes] = await Promise.all([
      fetchBytes(logoAnhanguera, origin),
      fetchBytes(logoNsp, origin),
      fetchBytes(logoLiga, origin),
    ]);

    const decode = (b: Uint8Array) => trimAlpha(decodeImage(b));
    const logos = [decode(anhangueraBytes), decode(nspBytes), decode(ligaBytes)];

    const targetH = Math.max(70, Math.round((h * sizePct) / 100));
    const resized = logos.map((l) => {
      const tw = Math.max(70, Math.round((l.width * targetH) / Math.max(1, l.height)));
      return resizeRgba(l, tw, targetH);
    });

    const y = Math.max(0, h - targetH - marginY);
    // esquerda
    composite(base, resized[0], marginX, y);
    // direita (liga)
    const xRight = Math.max(0, w - resized[2].width - marginX);
    composite(base, resized[2], xRight, y);
    // centro (aluno-2) — centralizado no espaço restante
    const xCenter = Math.round((w - resized[1].width) / 2);
    composite(base, resized[1], xCenter, y);

    return encodeJpegB64(base, 90);
  } catch (e) {
    console.error("[overlayAlunoLogos] falha — logo não aplicada:", e);
    throw new Error("Falha ao aplicar as 3 logos institucionais.");
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
