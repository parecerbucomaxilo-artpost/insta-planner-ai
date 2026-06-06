/**
 * Compõe a logo como marca d'água sobre uma imagem (data URL),
 * retornando um novo data URL PNG.
 * Posição padrão: canto inferior direito; tamanho ~18% da menor dimensão.
 */
export async function applyWatermark(
  baseImageDataUrl: string,
  logoDataUrl: string,
  opts: { position?: "br" | "bl" | "tr" | "tl"; sizeRatio?: number; opacity?: number } = {},
): Promise<string> {
  const { position = "br", sizeRatio = 0.18, opacity = 0.92 } = opts;

  const load = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  const [base, logo] = await Promise.all([load(baseImageDataUrl), load(logoDataUrl)]);

  const canvas = document.createElement("canvas");
  canvas.width = base.naturalWidth;
  canvas.height = base.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado");

  ctx.drawImage(base, 0, 0);

  const minSide = Math.min(canvas.width, canvas.height);
  const target = Math.round(minSide * sizeRatio);
  const ratio = logo.naturalWidth / logo.naturalHeight;
  const w = ratio >= 1 ? target : Math.round(target * ratio);
  const h = ratio >= 1 ? Math.round(target / ratio) : target;

  const pad = Math.round(minSide * 0.035);
  let x = 0, y = 0;
  if (position === "br") { x = canvas.width - w - pad; y = canvas.height - h - pad; }
  else if (position === "bl") { x = pad; y = canvas.height - h - pad; }
  else if (position === "tr") { x = canvas.width - w - pad; y = pad; }
  else { x = pad; y = pad; }

  // Fundo translúcido para legibilidade
  const bgPad = Math.round(target * 0.08);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.beginPath();
  const r = Math.round(target * 0.12);
  const bx = x - bgPad, by = y - bgPad, bw = w + bgPad * 2, bh = h + bgPad * 2;
  ctx.moveTo(bx + r, by);
  ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
  ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
  ctx.arcTo(bx, by + bh, bx, by, r);
  ctx.arcTo(bx, by, bx + bw, by, r);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = opacity;
  ctx.drawImage(logo, x, y, w, h);
  ctx.globalAlpha = 1;

  return canvas.toDataURL("image/png");
}
