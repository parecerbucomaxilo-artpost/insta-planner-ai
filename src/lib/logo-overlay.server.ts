// Aplica a LOGO REAL no canto superior direito da imagem gerada pela IA.
// Import dinâmico do @cf-wasm/photon para não derrubar o módulo quando o
// WASM não conseguir ser resolvido pelo bundler do Worker.
import logoAsset from "@/assets/logo-planner.png.asset.json";

let logoBytesCache: Uint8Array | null = null;
const DEFAULT_ORIGIN = "https://insta-planner-ai.lovable.app";

async function fetchLogoBytes(origin?: string): Promise<Uint8Array> {
  if (logoBytesCache) return logoBytesCache;
  const base = origin || DEFAULT_ORIGIN;
  const url = logoAsset.url.startsWith("http") ? logoAsset.url : `${base}${logoAsset.url}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Logo fetch ${res.status}`);
  logoBytesCache = new Uint8Array(await res.arrayBuffer());
  return logoBytesCache;
}

export async function overlayLogo(imageB64: string, origin?: string, sizePct = 14): Promise<string> {
  try {
    const photon = await import("@cf-wasm/photon").catch((e) => {
      console.warn("[overlayLogo] photon indisponível, pulando overlay:", e);
      return null;
    });
    if (!photon) return imageB64;
    const { PhotonImage, resize, watermark, SamplingFilter } = photon;

    const baseBytes = Uint8Array.from(atob(imageB64), (c) => c.charCodeAt(0));
    const base = PhotonImage.new_from_byteslice(baseBytes);

    const logoBytes = await fetchLogoBytes(origin);
    const logoFull = PhotonImage.new_from_byteslice(logoBytes);

    const w = base.get_width();
    const target = Math.max(48, Math.round((w * sizePct) / 100));
    const logo = resize(logoFull, target, target, SamplingFilter.Lanczos3);

    const margin = Math.round(w * 0.03);
    const x = Math.max(0, w - target - margin);
    const y = margin;

    watermark(base, logo, BigInt(x), BigInt(y));

    const outBytes = base.get_bytes_jpeg(90);
    base.free();
    logoFull.free();
    logo.free();

    let bin = "";
    for (let i = 0; i < outBytes.length; i++) bin += String.fromCharCode(outBytes[i]);
    return btoa(bin);
  } catch (e) {
    console.error("[overlayLogo] falha — devolvendo imagem original:", e);
    return imageB64;
  }
}
