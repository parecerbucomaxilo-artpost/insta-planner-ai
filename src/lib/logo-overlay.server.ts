// Aplica a LOGO REAL (canto sup. direito) e o AVATAR REAL (canto sup. esquerdo)
// na imagem gerada pela IA. Import dinâmico do @cf-wasm/photon para não
// derrubar o módulo quando o WASM não conseguir ser resolvido pelo bundler.
import logoAsset from "@/assets/logo-planner.png.asset.json";
import avatarAsset from "@/assets/avatar-francisco.jpg.asset.json";
import logoAluno1 from "@/assets/logo-aluno-1.png.asset.json";
import logoAluno2 from "@/assets/logo-aluno-2.png.asset.json";

const DEFAULT_ORIGIN = "https://insta-planner-ai.lovable.app";
const cache = new Map<string, Uint8Array>();

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

function statsRGBA(px: Uint8Array): { mean: number; std: number } {
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let i = 0; i + 3 < px.length; i += 4) {
    const a = px[i + 3];
    if (a === 0) continue;
    const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    sum += lum;
    sumSq += lum * lum;
    n++;
  }
  if (!n) return { mean: 128, std: 0 };
  const mean = sum / n;
  const std = Math.sqrt(Math.max(0, sumSq / n - mean * mean));
  return { mean, std };
}

function applyAlpha(px: Uint8Array, alpha: number): Uint8Array {
  const out = new Uint8Array(px.length);
  out.set(px);
  for (let i = 3; i < out.length; i += 4) {
    out[i] = Math.round(out[i] * alpha);
  }
  return out;
}

export async function overlayLogo(
  imageB64: string,
  origin?: string,
  sizePct = 14,
  opts?: { withAvatar?: boolean; avatarUrl?: string; withLogo?: boolean; position?: Pos; smart?: boolean },
): Promise<string> {
  try {
    const photon: any = await import("@cf-wasm/photon").catch((e) => {
      console.warn("[overlayLogo] photon indisponível, pulando overlay:", e);
      return null;
    });
    if (!photon) return imageB64;
    const { PhotonImage, resize, watermark, SamplingFilter, crop } = photon;

    const baseBytes = Uint8Array.from(atob(imageB64), (c) => c.charCodeAt(0));
    const base = PhotonImage.new_from_byteslice(baseBytes);
    const w = base.get_width();
    const h = base.get_height();
    const margin = Math.round(w * 0.03);
    const requested = opts?.position ?? "top-right";
    const freeList: Array<{ free: () => void }> = [];

    // Smart placement: escolhe canto mais limpo, ajusta tamanho e opacidade.
    let pos: Pos = requested;
    let target = Math.max(48, Math.round((w * sizePct) / 100));
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
          try {
            if (typeof crop !== "function") break;
            const region = crop(base, c.x1, c.y1, Math.min(w, c.x1 + sample), Math.min(h, c.y1 + sample));
            const px = typeof region.get_raw_pixels === "function" ? region.get_raw_pixels() : null;
            if (px) {
              const { mean, std } = statsRGBA(px);
              const penalty = c.pos === requested ? 0 : 6;
              const score = std + penalty;
              if (score < best.std) best = { pos: c.pos, std: score, mean };
            }
            region.free();
          } catch {}
        }
        if (Number.isFinite(best.std)) {
          pos = best.pos;
          const busy = Math.min(1, best.std / 60);
          const scale = 1 - busy * 0.25;
          target = Math.max(56, Math.round(((w * sizePct) / 100) * scale));
          alpha = best.mean > 180 ? 0.95 : best.mean < 60 ? 0.78 : 0.9;
          if (busy > 0.5) alpha = Math.min(alpha, 0.8);
        }
      } catch (e) {
        console.warn("[overlayLogo] smart-mode falhou, usando padrão:", e);
      }
    }


    const logoX = pos === "top-left" || pos === "bottom-left" ? margin : Math.max(0, w - target - margin);
    const logoY = pos === "bottom-right" || pos === "bottom-left" ? Math.max(0, h - target - margin) : margin;

    if (opts?.withLogo !== false) {
      const logoBytes = await fetchBytes(logoAsset.url, origin);
      const logoFull = PhotonImage.new_from_byteslice(logoBytes);
      const logoResized = resize(logoFull, target, target, SamplingFilter.Lanczos3);
      let logoToStamp: any = logoResized;
      let extraFree: any = null;
      if (alpha < 0.99) {
        try {
          const px = logoResized.get_raw_pixels();
          const adjusted = applyAlpha(px, alpha);
          const withAlpha = PhotonImage.new(adjusted, target, target);
          logoToStamp = withAlpha;
          extraFree = withAlpha;
        } catch {}
      }
      watermark(base, logoToStamp, BigInt(logoX), BigInt(logoY));
      freeList.push(logoFull, logoResized);
      if (extraFree) freeList.push(extraFree);
    }

    if (opts?.withAvatar) {
      const avUrl = opts.avatarUrl || avatarAsset.url;
      const avBytes = await fetchBytes(avUrl, origin);
      const avFull = PhotonImage.new_from_byteslice(avBytes);
      const av = resize(avFull, target, target, SamplingFilter.Lanczos3);
      watermark(base, av, BigInt(margin), BigInt(margin));
      freeList.push(avFull, av);
    }

    const outBytes = base.get_bytes_jpeg(90);
    base.free();
    for (const f of freeList) f.free();

    let bin = "";
    for (let i = 0; i < outBytes.length; i++) bin += String.fromCharCode(outBytes[i]);
    return btoa(bin);
  } catch (e) {
    console.error("[overlayLogo] falha — devolvendo imagem original:", e);
    return imageB64;
  }
}


// Overlay inteligente da LOGO ÚNICA da LACTBMF — escolhe canto/centro
// inferior mais limpo, ajusta tamanho e opacidade para nunca atrapalhar
// leitura ou se sobrepor a texto/cena principal. Usado pelo "Planner
// Simplificado Liga" (@lactbmf.anhanguerasbo).
export async function overlayAlunoLogos(
  imageB64: string,
  origin?: string,
  sizePct = 12,
): Promise<string> {
  try {
    const photon: any = await import("@cf-wasm/photon").catch(() => null);
    if (!photon) return imageB64;
    const { PhotonImage, resize, watermark, SamplingFilter, crop } = photon;
    const logoLiga = (await import("@/assets/logo-liga-ctbmf.png.asset.json")).default;

    const baseBytes = Uint8Array.from(atob(imageB64), (c) => c.charCodeAt(0));
    const base = PhotonImage.new_from_byteslice(baseBytes);
    const w = base.get_width();
    const h = base.get_height();
    const marginX = Math.round(w * 0.03);
    const marginY = Math.round(h * 0.02);

    const bytes = await fetchBytes(logoLiga.url, origin);
    const full = PhotonImage.new_from_byteslice(bytes);
    const fw = full.get_width();
    const fh = full.get_height();

    let targetW = Math.max(72, Math.round((w * sizePct) / 100));
    let alpha = 1;
    type Spot = { name: "bl" | "bc" | "br"; x: number };
    let chosen: Spot = { name: "bc", x: Math.max(0, Math.round((w - targetW) / 2)) };

    try {
      const sampleH = Math.round(h * 0.18);
      const sampleW = Math.max(targetW + marginX * 2, Math.round(w * 0.34));
      const y1 = Math.max(0, h - sampleH);
      const spots: Array<Spot & { x1: number }> = [
        { name: "bl", x: marginX, x1: 0 },
        { name: "bc", x: Math.max(0, Math.round((w - targetW) / 2)), x1: Math.max(0, Math.round((w - sampleW) / 2)) },
        { name: "br", x: Math.max(0, w - targetW - marginX), x1: Math.max(0, w - sampleW) },
      ];
      let best: { spot: Spot; std: number; mean: number } | null = null;
      if (typeof crop === "function") {
        for (const s of spots) {
          try {
            const region = crop(base, s.x1, y1, Math.min(w, s.x1 + sampleW), h);
            const px = typeof region.get_raw_pixels === "function" ? region.get_raw_pixels() : null;
            if (px) {
              const { mean, std } = statsRGBA(px);
              const penalty = s.name === "bc" ? 0 : 4;
              const score = std + penalty;
              if (!best || score < best.std) best = { spot: s, std: score, mean };
            }
            region.free();
          } catch {}
        }
      }
      if (best) {
        const busy = Math.min(1, best.std / 60);
        const scale = 1 - busy * 0.25;
        targetW = Math.max(80, Math.round(((w * sizePct) / 100) * scale));
        alpha = best.mean > 180 ? 0.95 : best.mean < 60 ? 0.85 : 0.9;
        if (busy > 0.55) alpha = Math.min(alpha, 0.78);
        chosen = {
          name: best.spot.name,
          x:
            best.spot.name === "bl"
              ? marginX
              : best.spot.name === "br"
                ? Math.max(0, w - targetW - marginX)
                : Math.max(0, Math.round((w - targetW) / 2)),
        };
      }
    } catch (e) {
      console.warn("[overlayAlunoLogos] smart-mode falhou, usando centro:", e);
    }

    const targetH = Math.max(48, Math.round((fh * targetW) / Math.max(1, fw)));
    const small = resize(full, targetW, targetH, SamplingFilter.Lanczos3);
    let stamp: any = small;
    let extraFree: any = null;
    if (alpha < 0.99) {
      try {
        const px = small.get_raw_pixels();
        const adjusted = applyAlpha(px, alpha);
        const withAlpha = PhotonImage.new(adjusted, targetW, targetH);
        stamp = withAlpha;
        extraFree = withAlpha;
      } catch {}
    }
    const y = Math.max(0, h - targetH - marginY);
    watermark(base, stamp, BigInt(chosen.x), BigInt(y));

    const outBytes = base.get_bytes_jpeg(90);
    base.free();
    full.free();
    small.free();
    if (extraFree) extraFree.free();
    let bin = "";
    for (let i = 0; i < outBytes.length; i++) bin += String.fromCharCode(outBytes[i]);
    return btoa(bin);
  } catch (e) {
    console.error("[overlayAlunoLogos] falha — devolvendo original:", e);
    return imageB64;
  }
}


export async function ensureJpegB64(imageB64: string, quality = 90): Promise<string> {
  try {
    const photon = await import("@cf-wasm/photon").catch(() => null);
    if (!photon) return imageB64;
    const { PhotonImage } = photon;
    const bytes = Uint8Array.from(atob(imageB64), (c) => c.charCodeAt(0));
    const img = PhotonImage.new_from_byteslice(bytes);
    const out = img.get_bytes_jpeg(quality);
    img.free();
    let bin = "";
    for (let i = 0; i < out.length; i++) bin += String.fromCharCode(out[i]);
    return btoa(bin);
  } catch (e) {
    console.error("[ensureJpegB64] falha — devolvendo original:", e);
    return imageB64;
  }
}
