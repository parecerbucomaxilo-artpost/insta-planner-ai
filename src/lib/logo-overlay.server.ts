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

export async function overlayLogo(
  imageB64: string,
  origin?: string,
  sizePct = 14,
  opts?: { withAvatar?: boolean; avatarUrl?: string; withLogo?: boolean },
): Promise<string> {
  try {
    const photon = await import("@cf-wasm/photon").catch((e) => {
      console.warn("[overlayLogo] photon indisponível, pulando overlay:", e);
      return null;
    });
    if (!photon) return imageB64;
    const { PhotonImage, resize, watermark, SamplingFilter } = photon;

    const baseBytes = Uint8Array.from(atob(imageB64), (c) => c.charCodeAt(0));
    const base = PhotonImage.new_from_byteslice(baseBytes);
    const w = base.get_width();
    const target = Math.max(48, Math.round((w * sizePct) / 100));
    const margin = Math.round(w * 0.03);
    const freeList: Array<{ free: () => void }> = [];

    if (opts?.withLogo !== false) {
      const logoBytes = await fetchBytes(logoAsset.url, origin);
      const logoFull = PhotonImage.new_from_byteslice(logoBytes);
      const logo = resize(logoFull, target, target, SamplingFilter.Lanczos3);
      watermark(base, logo, BigInt(Math.max(0, w - target - margin)), BigInt(margin));
      freeList.push(logoFull, logo);
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

// Overlay das DUAS logos de aluno (modo "Planner Simplificado / Estudantes").
// Aplica logo-aluno-1 no canto inf. esquerdo e logo-aluno-2 no canto inf. direito.
export async function overlayAlunoLogos(
  imageB64: string,
  origin?: string,
  sizePct = 12,
): Promise<string> {
  try {
    const photon = await import("@cf-wasm/photon").catch(() => null);
    if (!photon) return imageB64;
    const { PhotonImage, resize, watermark, SamplingFilter } = photon;

    const baseBytes = Uint8Array.from(atob(imageB64), (c) => c.charCodeAt(0));
    const base = PhotonImage.new_from_byteslice(baseBytes);
    const w = base.get_width();
    const h = base.get_height();
    const target = Math.max(64, Math.round((w * sizePct) / 100));
    const margin = Math.round(w * 0.035);
    const freeList: Array<{ free: () => void }> = [];

    for (const [asset, isRight] of [
      [logoAluno1, false] as const,
      [logoAluno2, true] as const,
    ]) {
      const bytes = await fetchBytes(asset.url, origin);
      const full = PhotonImage.new_from_byteslice(bytes);
      const small = resize(full, target, target, SamplingFilter.Lanczos3);
      const x = isRight ? Math.max(0, w - target - margin) : margin;
      const y = Math.max(0, h - target - margin);
      watermark(base, small, BigInt(x), BigInt(y));
      freeList.push(full, small);
    }

    const outBytes = base.get_bytes_jpeg(90);
    base.free();
    for (const f of freeList) f.free();
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
