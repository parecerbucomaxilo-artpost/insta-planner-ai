// Gerador local sem cobrança: cria imagens JPEG no próprio backend, sem chamar IA externa.

export const MODELOS_IMAGEM = [
  { id: "local/sem-custo", label: "Imagem local (sem custo)" },
] as const;

export type ModeloImagem = (typeof MODELOS_IMAGEM)[number]["id"];

function sizeToWH(size?: string): { width: number; height: number } {
  if (size === "1536x1024") return { width: 1536, height: 1024 };
  if (size === "1024x1536") return { width: 1024, height: 1536 };
  return { width: 1024, height: 1024 };
}

function hashText(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
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
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= w || iy >= h) return;
  const p = (iy * w + ix) * 4;
  const a = Math.max(0, Math.min(1, alpha));
  px[p] = Math.round(px[p] * (1 - a) + color[0] * a);
  px[p + 1] = Math.round(px[p + 1] * (1 - a) + color[1] * a);
  px[p + 2] = Math.round(px[p + 2] * (1 - a) + color[2] * a);
  px[p + 3] = 255;
}

function fillEllipse(px: Uint8Array, w: number, h: number, cx: number, cy: number, rx: number, ry: number, color: [number, number, number], alpha = 1) {
  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(w - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(h - 1, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const d = dx * dx + dy * dy;
      if (d <= 1) setPixel(px, w, h, x, y, color, alpha * Math.min(1, (1 - d) * 2.5));
    }
  }
}

function strokeEllipse(px: Uint8Array, w: number, h: number, cx: number, cy: number, rx: number, ry: number, color: [number, number, number], alpha = 1, thickness = 3) {
  const steps = Math.max(180, Math.round((rx + ry) * 0.8));
  for (let i = 0; i <= steps; i++) {
    const a = (Math.PI * 2 * i) / steps;
    const x = cx + Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry;
    fillEllipse(px, w, h, x, y, thickness, thickness, color, alpha);
  }
}

function line(px: Uint8Array, w: number, h: number, x0: number, y0: number, x1: number, y1: number, color: [number, number, number], alpha = 1, thickness = 4) {
  const steps = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    fillEllipse(px, w, h, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, thickness, thickness, color, alpha);
  }
}

function fillRect(px: Uint8Array, w: number, h: number, x: number, y: number, rw: number, rh: number, color: [number, number, number], alpha = 1) {
  const x0 = Math.max(0, Math.floor(x));
  const x1 = Math.min(w, Math.ceil(x + rw));
  const y0 = Math.max(0, Math.floor(y));
  const y1 = Math.min(h, Math.ceil(y + rh));
  for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) setPixel(px, w, h, xx, yy, color, alpha);
}

function drawTooth(px: Uint8Array, w: number, h: number, cx: number, cy: number, scale: number, seed: number) {
  const white = hexToRgb("#f8fbff");
  const cyan = hexToRgb("#2dd4ff");
  const shadow = hexToRgb("#7fb6d6");
  fillEllipse(px, w, h, cx, cy - scale * 0.4, scale * 0.75, scale * 0.58, white, 0.93);
  fillEllipse(px, w, h, cx - scale * 0.36, cy + scale * 0.22, scale * 0.22, scale * 0.86, white, 0.88);
  fillEllipse(px, w, h, cx + scale * 0.36, cy + scale * 0.22, scale * 0.22, scale * 0.86, white, 0.88);
  strokeEllipse(px, w, h, cx, cy - scale * 0.34, scale * 0.78, scale * 0.62, cyan, 0.38, Math.max(2, scale * 0.018));
  line(px, w, h, cx - scale * 0.52, cy - scale * 0.2, cx + scale * 0.52, cy - scale * 0.2, shadow, 0.35, Math.max(2, scale * 0.01));
  const nerveY = cy + scale * (0.72 + ((seed % 5) - 2) * 0.015);
  line(px, w, h, cx - scale * 0.9, nerveY, cx + scale * 0.9, nerveY - scale * 0.05, cyan, 0.65, Math.max(2, scale * 0.018));
}

function drawJaw(px: Uint8Array, w: number, h: number, seed: number) {
  const cyan = hexToRgb("#2dd4ff");
  const bone = hexToRgb("#eaf7ff");
  const baseY = h * 0.58;
  const startX = w * 0.2;
  const endX = w * 0.8;
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const x = startX + (endX - startX) * t;
    const y = baseY + Math.sin((t + (seed % 7) * 0.02) * Math.PI) * h * 0.07;
    drawTooth(px, w, h, x, y, Math.min(w, h) * 0.095, seed + i * 17);
  }
  line(px, w, h, startX - w * 0.03, baseY + h * 0.12, endX + w * 0.03, baseY + h * 0.12, bone, 0.2, Math.max(8, w * 0.008));
  line(px, w, h, startX - w * 0.04, baseY + h * 0.16, endX + w * 0.04, baseY + h * 0.16, cyan, 0.28, Math.max(4, w * 0.004));
}

export async function generateImageBase64(opts: {
  apiKey?: string;
  prompt: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024";
  model?: ModeloImagem | string;
  referenceImageUrls?: string[];
}): Promise<string> {
  const photon: any = await import("@cf-wasm/photon");
  const { PhotonImage } = photon;
  const { width, height } = sizeToWH(opts.size);
  const px = new Uint8Array(width * height * 4);
  const seed = hashText(`${opts.prompt}|${opts.size}|${Date.now()}|${Math.random()}`);
  const isLiga = /Liga Acadêmica|graduação|lactbmf|anhanguera/i.test(opts.prompt);
  const navy = hexToRgb(isLiga ? "#2D2C32" : "#0c2340");
  const navy2 = hexToRgb(isLiga ? "#111114" : "#14366b");
  const cyan = hexToRgb(isLiga ? "#DD8E3C" : "#2dd4ff");
  const white = hexToRgb("#ffffff");

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const radial = Math.hypot((x - width * 0.58) / width, (y - height * 0.38) / height);
      const t = Math.min(1, y / height * 0.7 + radial * 0.8);
      const c = blend(navy2, navy, t);
      const p = (y * width + x) * 4;
      px[p] = c[0]; px[p + 1] = c[1]; px[p + 2] = c[2]; px[p + 3] = 255;
    }
  }

  for (let i = 0; i < 9; i++) {
    const x = ((seed >>> (i % 16)) % width) + (i - 4) * width * 0.03;
    const y = (height * (0.12 + i * 0.085)) % height;
    line(px, width, height, x - width * 0.18, y, x + width * 0.18, y + height * 0.06, cyan, 0.12, Math.max(2, width * 0.002));
  }

  fillEllipse(px, width, height, width * 0.72, height * 0.25, width * 0.28, height * 0.16, cyan, 0.08);
  fillEllipse(px, width, height, width * 0.18, height * 0.78, width * 0.22, height * 0.13, white, 0.06);
  drawJaw(px, width, height, seed);

  const bandH = Math.round(height * 0.16);
  fillRect(px, width, height, 0, height - bandH, width, bandH, hexToRgb("#06182c"), 0.62);
  line(px, width, height, width * 0.08, height - bandH + height * 0.025, width * 0.92, height - bandH + height * 0.025, cyan, 0.75, Math.max(3, width * 0.003));

  const accentX = width * (0.12 + (seed % 30) / 100);
  strokeEllipse(px, width, height, accentX, height * 0.28, width * 0.08, width * 0.08, cyan, 0.55, Math.max(3, width * 0.003));

  const img = PhotonImage.new(px, width, height);
  const out = img.get_bytes_jpeg(92);
  img.free();
  return Buffer.from(out).toString("base64");
}