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

/**
 * Aplica uma faixa sutil no rodapé com o nome do profissional e CRO/UF.
 * Estética premium: barra navy translúcida + tipografia clara.
 */
export async function applyDoctorBadge(
  baseImageDataUrl: string,
  info: { nome: string; cro: string },
): Promise<string> {
  const nome = info.nome.trim();
  const cro = info.cro.trim();
  if (!nome && !cro) return baseImageDataUrl;

  const load = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  const base = await load(baseImageDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = base.naturalWidth;
  canvas.height = base.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado");

  ctx.drawImage(base, 0, 0);

  const W = canvas.width;
  const H = canvas.height;
  const barH = Math.round(H * 0.075);
  const barY = H - barH;

  // Faixa navy translúcida
  const grad = ctx.createLinearGradient(0, barY, 0, H);
  grad.addColorStop(0, "rgba(7, 16, 38, 0)");
  grad.addColorStop(0.4, "rgba(7, 16, 38, 0.55)");
  grad.addColorStop(1, "rgba(7, 16, 38, 0.85)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, barY - Math.round(barH * 0.4), W, barH + Math.round(barH * 0.4));

  // Linha cyan finíssima superior
  ctx.fillStyle = "rgba(125, 211, 252, 0.55)";
  ctx.fillRect(0, barY, W, Math.max(1, Math.round(H * 0.002)));

  // Texto
  const pad = Math.round(W * 0.04);
  const fontPx = Math.round(barH * 0.42);
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.textBaseline = "middle";
  ctx.font = `600 ${fontPx}px ui-serif, "Georgia", "Times New Roman", serif`;
  const nomeTxt = nome ? (nome.startsWith("Dr") ? nome : `Dr(a). ${nome}`) : "";
  ctx.textAlign = "left";
  ctx.fillText(nomeTxt, pad, barY + barH / 2);

  if (cro) {
    ctx.font = `400 ${Math.round(fontPx * 0.85)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = "rgba(190, 219, 254, 0.95)";
    ctx.textAlign = "right";
    ctx.fillText(`CRO ${cro}`, W - pad, barY + barH / 2);
  }

  return canvas.toDataURL("image/png");
}
