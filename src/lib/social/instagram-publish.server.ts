const GRAPH_VERSION = "v21.0";
const TEMP_USER_ID = "00000000-0000-0000-0000-000000000000";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;
const DEFAULT_MAKE_WEBHOOK = "https://hook.us2.make.com/vxh3w2d4e014i1rkig6xxp2dm6fkxprn";

type PublishVia = "meta" | "webhook";

type PublishPostInput = {
  supabaseAdmin: any;
  postId: string;
  userId: string;
};

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

async function uploadDataUrl(supabaseAdmin: any, value: string) {
  const parsed = parseDataUrl(value);
  if (!parsed) return value;
  const fileName = `published/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${parsed.ext}`;
  const { error } = await supabaseAdmin.storage
    .from("post-images")
    .upload(fileName, parsed.buffer, { contentType: parsed.mimeType, cacheControl: "604800", upsert: false });
  if (error) throw new Error(`Upload da imagem para publicação falhou: ${error.message}`);
  const { data, error: signError } = await supabaseAdmin.storage.from("post-images").createSignedUrl(fileName, SIGNED_URL_TTL_SECONDS);
  if (signError || !data?.signedUrl) throw new Error(`Imagem indisponível para publicação: ${signError?.message || fileName}`);
  return data.signedUrl;
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

async function createFetchableUrl(supabaseAdmin: any, value: string | null | undefined) {
  if (!value) return null;
  if (value.startsWith("blob:")) {
    throw new Error("Imagem ainda não foi salva no servidor (blob local). Gere ou salve o post novamente antes de publicar.");
  }
  if (value.startsWith("data:")) return uploadDataUrl(supabaseAdmin, value);
  const ref = getStorageObjectRef(value);
  if (!ref) {
    if (!/^https?:\/\//i.test(value)) {
      throw new Error(`Imagem com URL inválida para publicação: ${value.slice(0, 80)}`);
    }
    return value;
  }
  const { data, error } = await supabaseAdmin.storage.from(ref.bucket).createSignedUrl(ref.path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) throw new Error(`Imagem indisponível para publicação: ${error?.message || ref.path}`);
  return data.signedUrl;
}

async function graphPost(edge: string, params: Record<string, string | number | boolean>) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) body.set(key, String(value));
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${edge}`, { method: "POST", body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const message = json?.error?.message || `Meta respondeu ${res.status}`;
    throw new Error(`Instagram: ${message}`);
  }
  return json as { id?: string };
}

async function graphGet(edge: string, accessToken: string) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${edge}`);
  url.searchParams.set("fields", "status_code,status");
  url.searchParams.set("access_token", accessToken);
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(json?.error?.message || `Meta respondeu ${res.status}`);
  return json as { status_code?: string; status?: string };
}

async function waitForContainerReady(containerId: string, accessToken: string) {
  for (let i = 0; i < 10; i += 1) {
    const status = await graphGet(containerId, accessToken);
    if (!status.status_code || status.status_code === "FINISHED") return;
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
      throw new Error(`Instagram: mídia não ficou pronta (${status.status || status.status_code}).`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function publishViaMeta({ igBusinessId, token, caption, imageUrls, isStory, isCarousel }: {
  igBusinessId: string;
  token: string;
  caption: string;
  imageUrls: string[];
  isStory: boolean;
  isCarousel: boolean;
}) {
  if (isCarousel && imageUrls.length > 1) {
    const children = await Promise.all(
      imageUrls.slice(0, 10).map(async (imageUrl) => {
        const child = await graphPost(`${igBusinessId}/media`, {
          image_url: imageUrl,
          is_carousel_item: true,
          access_token: token,
        });
        if (!child.id) throw new Error("Instagram: container do carrossel não foi criado.");
        return child.id;
      }),
    );
    const parent = await graphPost(`${igBusinessId}/media`, {
      media_type: "CAROUSEL",
      children: children.join(","),
      caption,
      access_token: token,
    });
    if (!parent.id) throw new Error("Instagram: container principal não foi criado.");
    await waitForContainerReady(parent.id, token);
    const published = await graphPost(`${igBusinessId}/media_publish`, { creation_id: parent.id, access_token: token });
    return published.id;
  }

  const created = await graphPost(`${igBusinessId}/media`, {
    image_url: imageUrls[0],
    ...(isStory ? { media_type: "STORIES" } : { caption }),
    access_token: token,
  });
  if (!created.id) throw new Error("Instagram: container da imagem não foi criado.");
  await waitForContainerReady(created.id, token);
  const published = await graphPost(`${igBusinessId}/media_publish`, { creation_id: created.id, access_token: token });
  return published.id;
}

async function publishViaWebhook(webhookUrl: string, payload: Record<string, unknown>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  let res: Response;
  try {
    res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Webhook Instagram demorou para responder. Verifique o cenário no Make.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[instagram-webhook] respondeu", res.status, "url=", webhookUrl, "body=", text);
    const hint = res.status === 400
      ? " — cenário do Make recusou o payload. Verifique se o cenário está ATIVO e se o webhook aceita os campos enviados (image_url/imagens_carrossel/caption)."
      : "";
    throw new Error(`Webhook Instagram respondeu ${res.status}${text ? `: ${text.slice(0, 240)}` : ""}${hint}`);
  }
}

export async function publishInstagramPostById({ supabaseAdmin, postId, userId }: PublishPostInput) {
  const { data: post, error: postError } = await supabaseAdmin
    .from("posts")
    .select("id,user_id,tipo_post,formato_midia,legenda,legenda_instagram,postar_instagram,url_imagem,imagens_carrossel")
    .eq("id", postId)
    .maybeSingle();

  if (postError) throw new Error(`DB: ${postError.message}`);
  if (!post) throw new Error("Post não encontrado.");
  if (post.user_id && post.user_id !== userId && post.user_id !== TEMP_USER_ID) throw new Error("Este post pertence a outro usuário.");
  if (post.postar_instagram === false) throw new Error("Este post não está marcado para Instagram.");

  try {
    const hasDestino = (p: any) =>
      !!p && (
        (p.instagram_access_token && p.instagram_business_account_id) ||
        p.instagram_webhook_url ||
        p.webhook_url
      );

    let { data: perfil, error: perfilError } = await supabaseAdmin
      .from("perfil_usuario")
      .select("id,instagram_access_token,instagram_business_account_id,instagram_webhook_url,webhook_url")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (perfilError) throw new Error(`DB: ${perfilError.message}`);

    // Se o perfil do usuário não tem destino configurado, procura qualquer perfil que tenha.
    if (!hasDestino(perfil)) {
      const { data: configured, error: cfgErr } = await supabaseAdmin
        .from("perfil_usuario")
        .select("id,instagram_access_token,instagram_business_account_id,instagram_webhook_url,webhook_url")
        .or("instagram_webhook_url.not.is.null,webhook_url.not.is.null,instagram_access_token.not.is.null")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (cfgErr) throw new Error(`DB: ${cfgErr.message}`);
      if (configured) perfil = configured;
    }

    if (!perfil) throw new Error("Configure seu perfil antes de publicar no Instagram.");

    const carousel = normalizeCarousel(post.imagens_carrossel);
    const sourceUrls = post.tipo_post === "Carrossel" && carousel.length > 0 ? carousel : [post.url_imagem].filter(Boolean);
    const imageUrls = (await Promise.all(sourceUrls.map((url: string) => createFetchableUrl(supabaseAdmin, url)))).filter(Boolean) as string[];
    if (imageUrls.length === 0) throw new Error("Este post não tem imagem para publicar.");

    const caption = post.legenda_instagram || post.legenda || "";
    const isStory = /stor/i.test(post.formato_midia || "");
    const isCarousel = post.tipo_post === "Carrossel" && imageUrls.length > 1;
    const postType = isStory ? "stories" : isCarousel ? "carrossel" : "imagem";
    let via: PublishVia;
    let externalId: string | undefined;

    if (perfil.instagram_access_token && perfil.instagram_business_account_id) {
      via = "meta";
      externalId = await publishViaMeta({
        igBusinessId: perfil.instagram_business_account_id,
        token: perfil.instagram_access_token,
        caption,
        imageUrls,
        isStory,
        isCarousel,
      });
    } else {
      const webhookUrl = perfil.instagram_webhook_url || perfil.webhook_url || DEFAULT_MAKE_WEBHOOK;
      via = "webhook";
      await publishViaWebhook(webhookUrl, {
        id: post.id,
        post_id: post.id,
        user_id: userId,
        plataforma: "Instagram",
        type: "post",
        tipo: postType,
        post_type: postType,
        media_type: postType,
        formato: postType,
        tipo_post: post.tipo_post,
        is_carousel: isCarousel,
        legenda: caption,
        caption,
        caption_instagram: caption,
        texto: caption,
        url_imagem: imageUrls[0],
        imagem_url: imageUrls[0],
        image_url: imageUrls[0],
        media_url: imageUrls[0],
        arquivo_url: imageUrls[0],
        imagens_carrossel: imageUrls,
        image_urls: imageUrls,
        images: imageUrls,
      });
    }

    const { error: updateError } = await supabaseAdmin
      .from("posts")
      .update({ status: "Publicado", data_agendamento: new Date().toISOString(), user_id: userId })
      .eq("id", post.id);
    if (updateError) throw new Error(`DB: ${updateError.message}`);

    return { ok: true, via, externalId, profileId: perfil.id };
  } catch (error) {
    await supabaseAdmin.from("posts").update({ status: "Erro", user_id: post.user_id === TEMP_USER_ID ? userId : post.user_id }).eq("id", post.id);
    throw error;
  }
}