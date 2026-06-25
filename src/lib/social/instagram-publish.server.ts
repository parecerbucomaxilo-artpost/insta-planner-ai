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

function normalizeInstagramAccount(value: string | null | undefined) {
  const normalized = String(value || "").trim().replace(/^@+/, "").toLowerCase();
  return normalized || null;
}

async function findInstagramProfileByAccount(supabaseAdmin: any, conta: string, columns: string) {
  const normalized = normalizeInstagramAccount(conta);
  if (!normalized) return null;
  const variants = [normalized, `@${normalized}`];
  const fields = ["arroba_usuario", "instagram_arroba"];

  for (const field of fields) {
    for (const value of variants) {
      const { data, error } = await supabaseAdmin
        .from("perfil_usuario")
        .select(columns)
        .ilike(field, value)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`DB: ${error.message}`);
      if (data) return data;
    }
  }

  return null;
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

async function publishViaWebhook(webhookUrl: string, payload: Record<string, unknown>): Promise<{
  queued: true;
  status: number | "timeout";
  confirmed?: boolean;
  externalId?: string;
}> {
  // Make está configurado com "Webhook response 15" como 1ª rota → responde em <2s.
  // Se o Make responder "Queue is full", a requisição não deve virar erro fatal no app.
  const maxAttempts = 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
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
        // Make recebeu o payload mas demorou a responder — tratamos como enfileirado.
        console.warn("[instagram-webhook] timeout: assumindo enfileirado no Make");
        return { queued: true, status: "timeout" as const };
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
    const text = await res.text().catch(() => "");
    if (res.ok) {
      let json: any = null;
      try { json = text ? JSON.parse(text) : null; } catch { /* resposta simples do Make */ }
      if (json && (json.ok === false || json.success === false || json.error)) {
        throw new Error(`Make recebeu o post, mas respondeu falha: ${json.error || json.message || text.slice(0, 200)}`);
      }
      const confirmed = Boolean(json?.published === true || json?.publicado === true || json?.status === "published" || json?.status === "Publicado");
      const externalId = String(json?.instagram_id || json?.media_id || json?.id || "") || undefined;
      return { queued: true, status: res.status, confirmed, externalId };
    }
    const isQueueFull = /queue\s*is\s*full|queue full|rate/i.test(text);
    console.error(`[instagram-webhook] respondeu`, res.status, "url=", webhookUrl, "body=", text);
    if (isQueueFull) {
      console.warn("[instagram-webhook] fila cheia no Make: mantendo post para nova tentativa automática");
      throw new Error("Webhook Instagram: Queue is full — post mantido para nova tentativa automática.");
    }
    const makeGone = res.status === 410 || /no scenario listening for this webhook/i.test(text);
    if (makeGone) {
      throw new Error(
        "Webhook Instagram inválido ou inativo no Make (410). " +
        "Copie a URL do cenário IG Liga LACTBMF ativo e salve no destino da conta antes de publicar.",
      );
    }
    const hint = res.status === 400
        ? " — cenário do Make recusou o payload. Verifique se o cenário está ATIVO."
        : "";
    throw new Error(`Webhook Instagram respondeu ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}${hint}`);
  }
  throw new Error("Webhook Instagram não foi disparado.");
}

export async function publishInstagramPostById({ supabaseAdmin, postId, userId }: PublishPostInput) {
  const { data: post, error: postError } = await supabaseAdmin
    .from("posts")
    .select("id,user_id,tipo_post,formato_midia,legenda,legenda_instagram,postar_instagram,url_imagem,imagens_carrossel,instagram_conta")
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

    const hasMeta = (p: any) => !!p && !!p.instagram_access_token && !!p.instagram_business_account_id;

    const contaAlvo = normalizeInstagramAccount((post as any).instagram_conta);

    let perfil: any = null;

    // 0) Se o post tem instagram_conta, ROTEAR estritamente para o perfil dessa conta.
    //    Evita publicar Liga no @drfranciscomenezes (ou vice-versa).
    if (contaAlvo) {
      perfil = await findInstagramProfileByAccount(
        supabaseAdmin,
        contaAlvo,
        "id,arroba_usuario,instagram_arroba,instagram_access_token,instagram_business_account_id,instagram_webhook_url,webhook_url",
      );
      if (!hasDestino(perfil)) {
        // SEM perfil configurado para essa conta — NÃO publica em outra conta.
        // O webhook padrão do Make está apontado para @drfranciscomenezes;
        // cair nele aqui faria a Liga ser publicada na conta errada.
        throw new Error(
          `Conta @${contaAlvo} não tem destino configurado (token Meta ou webhook próprio). ` +
          `Configure o perfil dessa conta em "Configurações > Perfil" antes de publicar — ` +
          `senão o post seria publicado na conta errada.`,
        );
      }
      // Se o perfil dessa conta NÃO tem token Meta próprio mas tem webhook próprio, usa o webhook próprio.
      // NUNCA reaproveitar o token Meta de outro perfil (publicaria no IG errado).
    } else {
      const { data: metaPerfil, error: metaErr } = await supabaseAdmin
        .from("perfil_usuario")
        .select("id,arroba_usuario,instagram_arroba,instagram_access_token,instagram_business_account_id,instagram_webhook_url,webhook_url")
        .not("instagram_access_token", "is", null)
        .not("instagram_business_account_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (metaErr) throw new Error(`DB: ${metaErr.message}`);
      perfil = metaPerfil;

      if (!hasMeta(perfil)) {
        const { data: ownPerfil, error: ownErr } = await supabaseAdmin
          .from("perfil_usuario")
          .select("id,arroba_usuario,instagram_arroba,instagram_access_token,instagram_business_account_id,instagram_webhook_url,webhook_url")
          .eq("user_id", userId)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (ownErr) throw new Error(`DB: ${ownErr.message}`);
        perfil = ownPerfil;

        if (!hasDestino(perfil)) {
          const { data: configured } = await supabaseAdmin
            .from("perfil_usuario")
            .select("id,arroba_usuario,instagram_arroba,instagram_access_token,instagram_business_account_id,instagram_webhook_url,webhook_url")
            .or("instagram_webhook_url.not.is.null,webhook_url.not.is.null")
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          if (configured) perfil = configured;
        }
        if (!perfil) {
          perfil = { id: "webhook-padrao", instagram_webhook_url: DEFAULT_MAKE_WEBHOOK, webhook_url: null } as any;
        }
      }
    }

    const carousel = normalizeCarousel(post.imagens_carrossel);
    const sourceUrls = post.tipo_post === "Carrossel" && carousel.length > 0 ? carousel : [post.url_imagem].filter(Boolean);
    const imageUrls = (await Promise.all(sourceUrls.map((url: string) => createFetchableUrl(supabaseAdmin, url)))).filter(Boolean) as string[];
    if (imageUrls.length === 0) throw new Error("Este post não tem imagem para publicar.");

    const caption = post.legenda_instagram || post.legenda || "";
    const isStory = /stor/i.test(post.formato_midia || "");
    const isCarousel = post.tipo_post === "Carrossel" && imageUrls.length > 1;
    const postType = isStory ? "story" : isCarousel ? "carrossel" : "feed";
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
      const webhookResult = await publishViaWebhook(webhookUrl, {
        id: post.id,
        post_id: post.id,
        user_id: userId,
        instagram_conta: contaAlvo || perfil.arroba_usuario || undefined,
        conta: contaAlvo || perfil.arroba_usuario || perfil.instagram_arroba || undefined,
        arroba: contaAlvo || perfil.arroba_usuario || perfil.instagram_arroba || undefined,
        plataforma: "Instagram",
        type: postType,
        tipo: postType,
        post_type: postType,
        media_type: postType,
        formato: postType,
        content_type: "post",
        tipo_post: post.tipo_post,
        rota: isCarousel ? "Carrossel" : "Post único",
        router_route: isCarousel ? "Carrossel" : "Post único",
        make_route: isCarousel ? "Carrossel" : "Post único",
        eh_carrossel: isCarousel,
        carrossel: isCarousel,
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
      externalId = webhookResult.externalId || `make:${webhookResult.status}`;
      if (webhookResult.confirmed) via = "meta";
    }

    const nextStatus = via === "meta" ? "Publicado" : "EnviadoMake";
    const { error: updateError } = await supabaseAdmin
      .from("posts")
      .update({ status: nextStatus, data_agendamento: new Date().toISOString(), user_id: userId })
      .eq("id", post.id);
    if (updateError) throw new Error(`DB: ${updateError.message}`);

    return { ok: true, via, externalId, profileId: perfil.id, status: nextStatus };
  } catch (error) {
    // Se a fila do Make estiver cheia, NÃO marca como Erro — o post continua agendado
    // para que o usuário (ou o cron) tente novamente quando a fila esvaziar.
    const msg = error instanceof Error ? error.message : String(error);
    const isQueueFull = /queue\s*is\s*full|fila.*chei/i.test(msg);
    if (!isQueueFull) {
      await supabaseAdmin.from("posts").update({ status: "Erro", user_id: post.user_id === TEMP_USER_ID ? userId : post.user_id }).eq("id", post.id);
    }
    throw error;
  }
}