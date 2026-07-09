import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SIGNED_URL_TTL_SECONDS = 60 * 30;

function normalizeCarousel(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string" && v.length > 0);
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === "string" && v.length > 0);
  } catch {
    return [value];
  }
  return [];
}

function normalizeInstagramAccount(value: string | null | undefined): string {
  if (!value) return "";
  return value.toLowerCase().replace(/^@/, "").trim();
}

export const previewPostWithLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchImageAsBase64, overlayLogo } = await import("@/lib/logo-overlay.server");
    const { getLogoOption } = await import("@/lib/logos-catalog");

    const { data: post, error } = await context.supabase
      .from("posts")
      .select("id, tipo_post, url_imagem, imagens_carrossel, instagram_conta")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!post) throw new Error("Post não encontrado.");

    const carousel = normalizeCarousel((post as any).imagens_carrossel);
    const sourceUrls = post.tipo_post === "Carrossel" && carousel.length > 0
      ? carousel
      : [post.url_imagem].filter(Boolean) as string[];
    if (sourceUrls.length === 0) throw new Error("Este post não tem imagem para pré-visualizar.");

    const conta = normalizeInstagramAccount((post as any).instagram_conta);
    const isLiga = conta === "lactbmf.anhanguerasbo";
    const isChico = conta === "drfranciscomenezes" || (!isLiga && !conta);

    const results: string[] = [];
    for (const src of sourceUrls) {
      try {
        // Resolve URL (data URL ou storage path → fetchable)
        let fetchUrl = src;
        if (src.startsWith("data:")) {
          // já é base64
          const b64 = await fetchImageAsBase64(src);
          const stamped = isLiga
            ? await overlayLogo(b64, undefined, 10, { withLogo: true, position: "bottom-right", smart: false, logoUrl: getLogoOption("liga-ctbmf")?.url })
            : isChico
              ? await overlayLogo(b64, undefined, 10, { withLogo: true, position: "bottom-right", smart: false })
              : b64;
          results.push(`data:image/jpeg;base64,${stamped}`);
          continue;
        }
        // Se é storage path privado, gera signed
        try {
          const url = new URL(src);
          const parts = url.pathname.split("/").filter(Boolean);
          const objectIndex = parts.findIndex((p) => p === "object");
          if (objectIndex >= 0) {
            const bucket = parts[objectIndex + 2];
            const path = parts.slice(objectIndex + 3).map(decodeURIComponent).join("/");
            const { data: signed } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
            if (signed?.signedUrl) fetchUrl = signed.signedUrl;
          }
        } catch {}

        const b64 = await fetchImageAsBase64(fetchUrl);
        const stamped = isLiga
          ? await overlayLogo(b64, undefined, 10, { withLogo: true, position: "bottom-right", smart: false, logoUrl: getLogoOption("liga-ctbmf")?.url })
          : isChico
            ? await overlayLogo(b64, undefined, 10, { withLogo: true, position: "bottom-right", smart: false })
            : b64;
        results.push(`data:image/jpeg;base64,${stamped}`);
      } catch (e) {
        console.error("[previewPostWithLogo] overlay obrigatório falhou:", e);
        throw new Error("A prévia foi bloqueada porque a logo oficial não pôde ser aplicada.");
      }
    }

    return { ok: true as const, account: conta || "drfranciscomenezes", images: results };
  });
