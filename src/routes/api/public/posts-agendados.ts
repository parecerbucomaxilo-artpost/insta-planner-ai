import { createFileRoute } from "@tanstack/react-router";
import { createHmac } from "crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

const TEMP_USER_ID = "00000000-0000-0000-0000-000000000000";
const LIGA_ACCOUNT = "lactbmf.anhanguerasbo";

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;
const CACHE_REFRESH_MARGIN_MS = 60 * 60 * 1000;
const PUBLIC_APP_URL = "https://insta-planner-ai.lovable.app";

function isCacheValid(expiresAt: string | null | undefined) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() - Date.now() > CACHE_REFRESH_MARGIN_MS;
}

function isFetchableCachedUrl(value: string | null | undefined) {
  return Boolean(value && !value.startsWith("data:") && !value.startsWith("blob:"));
}

function normalizeCarousel(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === "string" && item.length > 0);
  } catch {
    return [value];
  }
  return [];
}

function normalizeInstagramAccount(value: string | null | undefined) {
  return String(value || "").trim().replace(/^@+/, "").toLowerCase() || null;
}

function buildMakeFiles(imageUrls: string[]) {
  return imageUrls.map((url, index) => ({
    url,
    file_url: url,
    fileUrl: url,
    image_url: url,
    imageUrl: url,
    photo_url: url,
    photoUrl: url,
    "Photo URL": url,
    name: `imagem-${index + 1}.jpg`,
    filename: `imagem-${index + 1}.jpg`,
  }));
}

function buildConfirmationFields(postId: string) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return {};
  const confirmToken = createHmac("sha256", secret).update(postId).digest("hex");
  return {
    confirmar_publicado_url: "https://insta-planner-ai.lovable.app/api/public/confirmar-publicado",
    confirmation_url: "https://insta-planner-ai.lovable.app/api/public/confirmar-publicado",
    postback_url: "https://insta-planner-ai.lovable.app/api/public/confirmar-publicado",
    confirm_token: confirmToken,
    token_confirmacao: confirmToken,
  };
}

function parseDataUrl(value: string) {
  const match = value.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!match) return null;
  const mimeType = match[1] || "image/png";
  const isBase64 = Boolean(match[2]);
  const raw = match[3] || "";
  const buffer = isBase64 ? Buffer.from(raw, "base64") : Buffer.from(decodeURIComponent(raw));
  const ext = mimeType.includes("jpeg") || mimeType.includes("jpg") ? "jpg" : mimeType.includes("webp") ? "webp" : "png";
  return { buffer, mimeType, ext };
}

function getStorageObjectRef(value: string | null | undefined) {
  if (!value || value.startsWith("blob:") || value.startsWith("data:")) return null;
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    const objectIndex = parts.findIndex((part) => part === "object");
    const bucket = objectIndex >= 0 ? parts[objectIndex + 2] : null;
    const path = objectIndex >= 0 ? parts.slice(objectIndex + 3).map(decodeURIComponent).join("/") : null;
    return bucket && path ? { bucket, path } : null;
  } catch {
    return null;
  }
}

function createStorageProxyUrl(bucket: string, path: string) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null;
  const token = createHmac("sha256", secret).update(`${bucket}:${path}`).digest("hex");
  const url = new URL("/api/public/storage-media", PUBLIC_APP_URL);
  url.searchParams.set("bucket", bucket);
  url.searchParams.set("path", path);
  url.searchParams.set("token", token);
  return url.toString();
}

async function createFetchableUrl(supabaseAdmin: any, value: string | null | undefined) {
  if (!value) return null;
  if (value.startsWith("data:")) {
    const parsed = parseDataUrl(value);
    if (!parsed) return value;
    const fileName = `scheduled/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${parsed.ext}`;
    const { error } = await supabaseAdmin.storage
      .from("post-images")
      .upload(fileName, parsed.buffer, { contentType: parsed.mimeType, cacheControl: "604800", upsert: false });
    if (error) throw new Error(`Upload da imagem agendada falhou: ${error.message}`);
    // Para publicação via Meta/Make, usar URL assinada direta do Storage: preserva extensão e Content-Type,
    // evitando 400 de validação de imagem em proxies sem sufixo .jpg/.png.
    const { data, error: signError } = await supabaseAdmin.storage.from("post-images").createSignedUrl(fileName, SIGNED_URL_TTL_SECONDS);
    if (signError || !data?.signedUrl) throw new Error(`Imagem indisponível para publicação: ${signError?.message || fileName}`);
    return data.signedUrl;
  }
  const ref = getStorageObjectRef(value);
  if (!ref) return value;
  // A URL pública do bucket privado retorna 400; a assinada é acessível por integradores externos.
  const { data, error } = await supabaseAdmin.storage.from(ref.bucket).createSignedUrl(ref.path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) throw new Error(`Imagem indisponível para publicação: ${error?.message || ref.path}`);
  return data.signedUrl;
}

export const Route = createFileRoute("/api/public/posts-agendados")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: corsHeaders }),

      GET: async ({ request }) => {
        try {
          const { supabaseAdmin } = await import(
            "@/integrations/supabase/client.server"
          );

          const nowIso = new Date().toISOString();
          const url = new URL(request.url);
          const contaFiltro = normalizeInstagramAccount(url.searchParams.get("conta") || url.searchParams.get("instagram_conta"));

          if (contaFiltro === LIGA_ACCOUNT) {
            const { data: ligaPost } = await supabaseAdmin
              .from("posts")
              .select("id")
              .eq("status", "Agendado")
              .eq("instagram_conta", LIGA_ACCOUNT)
              .lte("data_agendamento", nowIso)
              .order("data_agendamento", { ascending: true })
              .limit(1)
              .maybeSingle();
            if (ligaPost?.id) {
              await supabaseAdmin
                .from("posts")
                .update({ status: "Rascunho", liga_dispatched_at: new Date().toISOString() })
                .eq("id", ligaPost.id);
            }
            return new Response(
              JSON.stringify({ post: null, message: "Liga em fluxo manual: post pronto salvo como rascunho para baixar/copiar no app." }),
              { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
            );
          }

          let query = supabaseAdmin
            .from("posts")
            .select(
              "id, tipo_post, formato_midia, url_imagem, url_imagem_cache, url_imagem_cache_expires_at, imagens_carrossel, imagens_carrossel_cache, imagens_carrossel_cache_expires_at, legenda, legenda_instagram, legenda_linkedin, data_agendamento, instagram_conta"
            )
            .eq("status", "Agendado")
            .lte("data_agendamento", nowIso)
            .order("data_agendamento", { ascending: true })
            .limit(1);
          if (contaFiltro) {
            query = query.eq("instagram_conta", contaFiltro);
          } else {
            // Segurança: quando algum integrador legado chama sem filtro, não
            // entregar posts da Liga nem do perfil pessoal suspenso.
            query = query.not("instagram_conta", "in", `(${LIGA_ACCOUNT},drfranciscomenezes)`);
          }
          const { data, error } = await query.maybeSingle();

          if (error) {
            return new Response(
              JSON.stringify({ error: error.message }),
              {
                status: 500,
                headers: { "Content-Type": "application/json", ...corsHeaders },
              }
            );
          }

          if (!data) {
            return new Response(
              JSON.stringify({ post: null, message: "Nenhum post agendado pronto para publicação." }),
              {
                status: 200,
                headers: { "Content-Type": "application/json", ...corsHeaders },
              }
            );
          }

          const cachedImagem = isFetchableCachedUrl(data.url_imagem_cache) && isCacheValid(data.url_imagem_cache_expires_at) ? data.url_imagem_cache : null;
          const cachedCarousel = isCacheValid(data.imagens_carrossel_cache_expires_at)
            ? normalizeCarousel(data.imagens_carrossel_cache).filter(isFetchableCachedUrl)
            : [];
          const originalCarousel = normalizeCarousel(data.imagens_carrossel);
          const isCarousel = data.tipo_post === "Carrossel" && originalCarousel.length > 1;
          const imageUrls = isCarousel
            ? (cachedCarousel.length > 0 ? cachedCarousel : (await Promise.all(originalCarousel.map((url) => createFetchableUrl(supabaseAdmin, url)))).filter(Boolean) as string[])
            : [cachedImagem || await createFetchableUrl(supabaseAdmin, data.url_imagem)].filter(Boolean) as string[];
          const urlImagem = imageUrls[0] ?? null;
          const refreshedImageCache = !cachedImagem && Boolean(urlImagem);
          const refreshedCarouselCache = isCarousel && cachedCarousel.length === 0 && imageUrls.length > 0;

          if (refreshedImageCache || refreshedCarouselCache) {
            await supabaseAdmin
              .from("posts")
              .update({
                ...(refreshedImageCache ? {
                  url_imagem_cache: urlImagem,
                  url_imagem_cache_expires_at: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
                } : {}),
                ...(refreshedCarouselCache ? {
                  imagens_carrossel_cache: imageUrls,
                  imagens_carrossel_cache_expires_at: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
                } : {}),
              })
              .eq("id", data.id);
          }

          const isStory = /stor/i.test(data.formato_midia || "");
          const postType = isStory ? "story" : isCarousel ? "carrossel" : "feed";
          const makeTipo = isStory ? "stories" : postType;
          const targetAccount = normalizeInstagramAccount(data.instagram_conta);
          const isLigaTarget = targetAccount === "lactbmf.anhanguerasbo";
          const isChicoTarget = targetAccount === "drfranciscomenezes";
          const forbiddenAccount = isLigaTarget ? "drfranciscomenezes" : isChicoTarget ? "lactbmf.anhanguerasbo" : undefined;
          const files = buildMakeFiles(imageUrls);

          return new Response(
            JSON.stringify({
              id: data.id,
              post_id: data.id,
              ...buildConfirmationFields(data.id),
              instagram_conta: targetAccount || undefined,
              conta: targetAccount || undefined,
              arroba: targetAccount || undefined,
              nome_perfil: isLigaTarget ? "Liga Acadêmica de CTBMF Anhanguera SBO" : targetAccount || undefined,
              profile_name: isLigaTarget ? "Liga Acadêmica de CTBMF Anhanguera SBO" : targetAccount || undefined,
              author_name: isLigaTarget ? "Liga Acadêmica de CTBMF Anhanguera SBO" : targetAccount || undefined,
              display_name: isLigaTarget ? "Liga Acadêmica de CTBMF Anhanguera SBO" : targetAccount || undefined,
              conta_destino: targetAccount || undefined,
              conta_destino_obrigatoria: targetAccount || undefined,
              target_instagram_account: targetAccount || undefined,
              target_instagram_username: targetAccount ? `@${targetAccount}` : undefined,
              make_scenario: isLigaTarget ? "liga_lactbmf" : isChicoTarget ? "chico_drfranciscomenezes" : "instagram",
              perfil_proibido: forbiddenAccount,
              forbidden_instagram_account: forbiddenAccount ? `@${forbiddenAccount}` : undefined,
              bloquear_publicacao_se_conta_diferente: Boolean(targetAccount),
              type: makeTipo,
              tipo: makeTipo,
              tipo_make: makeTipo,
              tipo_make_singular: isStory ? "story" : makeTipo,
              tipo_publicacao: postType,
              post_type: postType,
              media_type: postType,
              formato: makeTipo,
              tipo_post: data.tipo_post,
              is_carousel: isCarousel,
              url_imagem: urlImagem,
              imagem_url: urlImagem,
              image_url: urlImagem,
              media_url: urlImagem,
              arquivo_url: urlImagem,
              photo_url: urlImagem,
              photo_url_obrigatorio: urlImagem,
              photoUrl: urlImagem,
              PhotoUrl: urlImagem,
              photoURL: urlImagem,
              "Photo URL": urlImagem,
              "photo url": urlImagem,
              "PHOTO URL": urlImagem,
              "Image URL": urlImagem,
              "image url": urlImagem,
              photo: urlImagem,
              foto_url: urlImagem,
              foto: urlImagem,
              picture: urlImagem,
              picture_url: urlImagem,
              thumbnail_url: urlImagem,
              link_imagem: urlImagem,
              link: urlImagem,
              url: urlImagem,
              imagens_carrossel: imageUrls,
              image_urls: imageUrls,
              images: imageUrls,
              photos: imageUrls,
              fotos: imageUrls,
              photo_urls: imageUrls,
              files,
              Files: files,
              arquivos: files,
              carousel_files: files,
              carrossel_files: files,
              file_urls: imageUrls,
              FileURLs: imageUrls,
              imagens_carrossel_json: JSON.stringify(imageUrls),
              image_urls_json: JSON.stringify(imageUrls),
              photos_json: JSON.stringify(imageUrls),
              photo_urls_csv: imageUrls.join(","),
              legenda: data.legenda_instagram || data.legenda || "",
              texto: data.legenda_instagram || data.legenda || "",
              caption: data.legenda_instagram || data.legenda || "",
              legenda_instagram: data.legenda_instagram || data.legenda || "",
              legenda_linkedin: data.legenda_linkedin || data.legenda || "",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            }
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "Erro desconhecido";
          return new Response(
            JSON.stringify({ error: message }),
            {
              status: 500,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            }
          );
        }
      },
      POST: async () => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { publishInstagramPostById } = await import("@/lib/social/instagram-publish.server");

          const nowIso = new Date().toISOString();
          const { data: due, error: dueError } = await supabaseAdmin
            .from("posts")
            .select("id,user_id,instagram_conta")
            .eq("status", "Agendado")
            .eq("postar_instagram", true)
            .or(`instagram_conta.is.null,instagram_conta.neq.${LIGA_ACCOUNT}`)
            .lte("data_agendamento", nowIso)
            .order("data_agendamento", { ascending: true })
            .limit(1)
            .maybeSingle();

          if (dueError) {
            return new Response(JSON.stringify({ error: dueError.message }), {
              status: 500,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            });
          }

          if (!due) {
            return new Response(
              JSON.stringify({ ok: true, published: 0, message: "Sem posts vencidos para publicar." }),
              { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
            );
          }

          try {
            const result = await publishInstagramPostById({
              supabaseAdmin,
              postId: due.id,
              userId: due.user_id || TEMP_USER_ID,
            });
            return new Response(
              JSON.stringify({
                published: result.status === "Publicado" ? 1 : 0,
                sent_to_make: result.status === "EnviadoMake" ? 1 : 0,
                post_id: due.id,
                ...result,
              }),
              { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
            );
          } catch (err) {
            const message = err instanceof Error ? err.message : "Erro desconhecido";
            try {
              const { logErrorForAllUsers } = await import("@/lib/notify-error.server");
              await logErrorForAllUsers({
                tipo: "publicacao_instagram",
                titulo: "Falha ao publicar no Instagram",
                mensagem: message,
                postId: due.id,
              });
            } catch {}
            return new Response(
              JSON.stringify({ ok: false, post_id: due.id, error: message }),
              { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } },
            );
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : "Erro desconhecido";
          return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }
      },
    },
  },
});
