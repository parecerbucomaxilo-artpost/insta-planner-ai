import { createHmac } from "crypto";

const GRAPH_VERSION = "v21.0";
const TEMP_USER_ID = "00000000-0000-0000-0000-000000000000";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;
const DEFAULT_MAKE_WEBHOOK = "https://hook.us2.make.com/vxh3w2d4e014i1rkig6xxp2dm6fkxprn";
// Conta historicamente associada ao DEFAULT_MAKE_WEBHOOK (cenário Make original).
// Usada como fallback seguro quando o perfil dessa conta ainda não tem webhook próprio salvo.
const DEFAULT_WEBHOOK_ACCOUNT = "drfranciscomenezes";
const LIGA_ACCOUNT = "lactbmf.anhanguerasbo";

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

function isInvalidMetaTokenMessage(message: string) {
  return /access token|OAuthException|Cannot parse|token.*inválid|token.*expirad|Session has expired|Error validating access token/i.test(message);
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
  // Bucket post-images é privado por política do workspace — usar sempre URL assinada (Instagram aceita).
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
  // Bucket post-images é privado — sempre assinar (a URL pública retorna 400 e o Instagram rejeita com erro 9004).

  const { data, error } = await supabaseAdmin.storage.from(ref.bucket).createSignedUrl(ref.path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) throw new Error(`Imagem indisponível para publicação: ${error?.message || ref.path}`);
  return data.signedUrl;
}

async function graphPost(edge: string, params: Record<string, string | number | boolean>, host = "graph.facebook.com") {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) body.set(key, String(value));
  const res = await fetch(`https://${host}/${GRAPH_VERSION}/${edge}`, { method: "POST", body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const raw = json?.error?.message || `Meta respondeu ${res.status}`;
    const isBadToken = /access token|OAuthException|Cannot parse/i.test(raw);
    const message = isBadToken
      ? `${raw} — o token Meta salvo está inválido/expirado. Em Configurações → Redes Sociais, reconecte a conta ou cole um novo Access Token (Graph API Explorer).`
      : raw;
    throw new Error(`Instagram: ${message}`);
  }

  return json as { id?: string };
}

async function graphGet(edge: string, accessToken: string, host = "graph.facebook.com") {
  const url = new URL(`https://${host}/${GRAPH_VERSION}/${edge}`);
  url.searchParams.set("fields", "status_code,status");
  url.searchParams.set("access_token", accessToken);
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(json?.error?.message || `Meta respondeu ${res.status}`);
  return json as { status_code?: string; status?: string };
}

async function graphGetFields<T extends Record<string, unknown>>(edge: string, accessToken: string, fields: string, host = "graph.facebook.com") {
  const url = new URL(`https://${host}/${GRAPH_VERSION}/${edge}`);
  url.searchParams.set("fields", fields);
  url.searchParams.set("access_token", accessToken);
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(json?.error?.message || `Meta respondeu ${res.status}`);
  return json as T;
}

async function assertMetaAccountMatchesTarget(igBusinessId: string, token: string, targetAccount: string | null) {
  if (!targetAccount) return;
  let connectedAccount: string | null = null;
  try {
    const account = await graphGetFields<{ username?: string }>(igBusinessId, token, "username");
    connectedAccount = normalizeInstagramAccount(account.username);
  } catch {
    const account = await graphGetFields<{ username?: string; data?: Array<{ username?: string }> }>("me", token, "user_id,username", "graph.instagram.com");
    const directAccount = Array.isArray(account.data) ? account.data[0] : account;
    connectedAccount = normalizeInstagramAccount(directAccount?.username);
  }
  if (connectedAccount !== targetAccount) {
    throw new Error(
      `Conta Meta conectada não confere: o token é de @${connectedAccount || "desconhecida"}, ` +
      `mas este post é para @${targetAccount}. Reconecte a Meta da conta correta antes de publicar.`,
    );
  }
}

async function waitForContainerReady(containerId: string, accessToken: string, host = "graph.facebook.com") {
  for (let i = 0; i < 10; i += 1) {
    const status = await graphGet(containerId, accessToken, host);
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
  const publishWithHost = async (host: string) => {
  if (isCarousel && imageUrls.length > 1) {
    const children = await Promise.all(
      imageUrls.slice(0, 10).map(async (imageUrl) => {
        const child = await graphPost(`${igBusinessId}/media`, {
          image_url: imageUrl,
          is_carousel_item: true,
          access_token: token,
        }, host);
        if (!child.id) throw new Error("Instagram: container do carrossel não foi criado.");
        return child.id;
      }),
    );
    const parent = await graphPost(`${igBusinessId}/media`, {
      media_type: "CAROUSEL",
      children: children.join(","),
      caption,
      access_token: token,
    }, host);
    if (!parent.id) throw new Error("Instagram: container principal não foi criado.");
    await waitForContainerReady(parent.id, token, host);
    const published = await graphPost(`${igBusinessId}/media_publish`, { creation_id: parent.id, access_token: token }, host);
    return published.id;
  }

  const created = await graphPost(`${igBusinessId}/media`, {
    image_url: imageUrls[0],
    ...(isStory ? { media_type: "STORIES" } : { caption }),
    access_token: token,
  }, host);
  if (!created.id) throw new Error("Instagram: container da imagem não foi criado.");
  await waitForContainerReady(created.id, token, host);
  const published = await graphPost(`${igBusinessId}/media_publish`, { creation_id: created.id, access_token: token }, host);
  return published.id;
  };

  try {
    return await publishWithHost("graph.facebook.com");
  } catch (facebookError) {
    try {
      return await publishWithHost("graph.instagram.com");
    } catch {
      throw facebookError;
    }
  }
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

async function publishViaWebhook(webhookUrl: string, payload: Record<string, unknown>, account?: string | null): Promise<{
  queued: true;
  status: number | "timeout";
  confirmed?: boolean;
  externalId?: string;
}> {
  const requiredPhotoUrl = String(payload.photo_url || payload["Photo URL"] || payload.image_url || payload.url_imagem || "").trim();
  if (!requiredPhotoUrl) {
    throw new Error("Photo URL vazio: o post precisa ter uma imagem pública antes de enviar ao Make.");
  }
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
      const normalizedAccount = normalizeInstagramAccount(account);
      const accountLabel = normalizedAccount ? `@${normalizedAccount}` : "desta conta";
      const scenarioLabel = normalizedAccount === "lactbmf.anhanguerasbo"
        ? "IG Liga LACTBMF"
        : normalizedAccount === "drfranciscomenezes"
          ? "IG Chico / @drfranciscomenezes"
          : `Instagram de ${accountLabel}`;
      throw new Error(
        "Webhook Instagram inválido ou inativo no Make (410). " +
        `Copie a URL do cenário ${scenarioLabel} ativo e salve no destino de publicação de ${accountLabel} antes de publicar.`,
      );
    }
    if (res.status >= 500) {
      const normalizedAccount = normalizeInstagramAccount(account);
      const accountLabel = normalizedAccount ? `@${normalizedAccount}` : "desta conta";
      throw new Error(
        `O cenário do Make recebeu o post de ${accountLabel}, mas falhou internamente (${res.status}). ` +
        "Verifique no History do Make qual módulo ficou vermelho; o app já enviou imagens em URL pública compatível.",
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

    const contaAlvo = normalizeInstagramAccount((post as any).instagram_conta);

    // SUSPENSÃO MANUAL: publicação no @drfranciscomenezes está desabilitada
    // por decisão do usuário. Posts sem conta definida também param aqui,
    // porque o fallback histórico era justamente o perfil pessoal.
    if (!contaAlvo) {
      throw new Error(
        `Publicação bloqueada: este post não tem instagram_conta definida. ` +
        `Para Liga, defina instagram_conta=@${LIGA_ACCOUNT}; o sistema não usa mais @${DEFAULT_WEBHOOK_ACCOUNT} como fallback.`,
      );
    }

    if (contaAlvo === DEFAULT_WEBHOOK_ACCOUNT) {
      throw new Error(
        `Publicação no @${DEFAULT_WEBHOOK_ACCOUNT} está SUSPENSA por decisão do usuário. ` +
        `Reatribua o post a outra conta (ex: @${LIGA_ACCOUNT}) ou reative no código (instagram-publish.server.ts).`,
      );
    }

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
        throw new Error(
          contaAlvo === LIGA_ACCOUNT
            ? `Destino da Liga não configurado. Salve um webhook próprio da Liga ou um token manual de @${LIGA_ACCOUNT}; o sistema não usará a conta @${DEFAULT_WEBHOOK_ACCOUNT}.`
            : `Conta @${contaAlvo} não tem destino configurado (token Meta ou webhook próprio). ` +
              `Configure o perfil dessa conta em "Configurações > Perfil" antes de publicar — ` +
              `senão o post seria publicado na conta errada.`,
        );
      }
      // Se o perfil dessa conta NÃO tem token Meta próprio mas tem webhook próprio, usa o webhook próprio.
      // NUNCA reaproveitar o token Meta de outro perfil (publicaria no IG errado).
    }


    const carousel = normalizeCarousel(post.imagens_carrossel);
    const sourceUrls = post.tipo_post === "Carrossel" && carousel.length > 0 ? carousel : [post.url_imagem].filter(Boolean);
    let imageUrls = (await Promise.all(sourceUrls.map((url: string) => createFetchableUrl(supabaseAdmin, url)))).filter(Boolean) as string[];
    if (imageUrls.length === 0) throw new Error("Este post não tem imagem para publicar.");

    // Garantia de marca: re-aplica a logo na hora da publicação para posts antigos
    // gerados antes do overlay automático (ou sem ele por qualquer motivo).
    const contaParaLogo = contaAlvo || normalizeInstagramAccount(perfil?.arroba_usuario);
    if (contaParaLogo === "drfranciscomenezes" || contaParaLogo === "lactbmf.anhanguerasbo") {
      try {
        const { overlayLogo, overlayAlunoLogos } = await import("@/lib/logo-overlay.server");
        imageUrls = await Promise.all(imageUrls.map(async (url) => {
          const res = await fetch(url);
          if (!res.ok) return url;
          const buf = new Uint8Array(await res.arrayBuffer());
          let bin = "";
          for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
          const b64 = btoa(bin);
          const stamped = contaParaLogo === "lactbmf.anhanguerasbo"
            ? await overlayAlunoLogos(b64)
            : await overlayLogo(b64, undefined, 10, { withLogo: true, position: "bottom-right", smart: true });
          if (stamped === b64) return url; // overlay falhou; mantém original
          const fileName = `published/stamped-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
          const bytes = Uint8Array.from(atob(stamped), (c) => c.charCodeAt(0));
          const { error: upErr } = await supabaseAdmin.storage
            .from("post-images")
            .upload(fileName, bytes, { contentType: "image/jpeg", cacheControl: "604800", upsert: false });
          if (upErr) return url;
          const { data: signed } = await supabaseAdmin.storage
            .from("post-images")
            .createSignedUrl(fileName, SIGNED_URL_TTL_SECONDS);
          return signed?.signedUrl || url;
        }));
      } catch (e) {
        console.warn("[instagram-publish] overlay na publicação falhou — seguindo com imagem original:", e);
      }
    }


    const caption = post.legenda_instagram || post.legenda || "";
    const isStory = /stor/i.test(post.formato_midia || "");
    const isCarousel = post.tipo_post === "Carrossel" && imageUrls.length > 1;
    const postType = isStory ? "story" : isCarousel ? "carrossel" : "feed";
    // Campo usado pelo Router do Make: deve representar a rota (feed/carrossel/stories),
    // não o tipo técnico do arquivo (imagem). Antes feed ia como "imagem" e podia cair
    // fora dos filtros do cenário da Liga.
    const makeTipo = isCarousel ? "carrossel" : isStory ? "stories" : "feed";
    const makeTipoSingular = isStory ? "story" : makeTipo;
    const makeMediaKind = isCarousel ? "carousel" : isStory ? "story" : "photo";
    const makeRota = isCarousel ? "Carrossel" : isStory ? "Story" : "Post único";
    const primaryImageUrl = imageUrls[0];
    let via: PublishVia = "webhook";
    let externalId: string | undefined;
    let confirmedByWebhook = false;

    const ownWebhook = perfil.instagram_webhook_url || perfil.webhook_url || null;
    const targetAccount = normalizeInstagramAccount(contaAlvo || perfil.arroba_usuario || perfil.instagram_arroba);
    const isLigaTarget = targetAccount === "lactbmf.anhanguerasbo";
    const isChicoTarget = targetAccount === "drfranciscomenezes";
    const forbiddenAccount = isLigaTarget ? "drfranciscomenezes" : isChicoTarget ? "lactbmf.anhanguerasbo" : undefined;

    if (isChicoTarget) {
      throw new Error(
        `Publicação bloqueada: @${DEFAULT_WEBHOOK_ACCOUNT} está suspenso. ` +
        `Posts da Liga devem usar exclusivamente @${LIGA_ACCOUNT} e o webhook/token próprio da Liga.`,
      );
    }

    const publishWebhookForProfile = async (reason?: string) => {
      // Garantia anti-cross-posting: quando o post tem instagram_conta,
      // só publicamos via webhook PRÓPRIO desse perfil. NUNCA cai no
      // DEFAULT_MAKE_WEBHOOK nem em webhook de outro perfil — isso publicaria
      // conteúdo da Liga na conta @drfranciscomenezes (ou vice-versa).
      if (contaAlvo && contaAlvo !== DEFAULT_WEBHOOK_ACCOUNT && !ownWebhook) {
        throw new Error(
          reason
            ? `${reason} Além disso, @${contaAlvo} não tem webhook próprio configurado. Salve um webhook próprio dessa conta para publicar sem depender do token Meta.`
            : `Conta @${contaAlvo} sem webhook próprio configurado. ` +
              `Cadastre o webhook do Make específico dessa conta em "Configurações > Perfil" ` +
              `antes de publicar — o fallback global publicaria na conta errada.`,
        );
      }
      const webhookUrl = ownWebhook || DEFAULT_MAKE_WEBHOOK;
      via = "webhook";
      const webhookResult = await publishViaWebhook(webhookUrl, {
        id: post.id,
        post_id: post.id,
        ...buildConfirmationFields(post.id),
        user_id: userId,
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
        plataforma: "Instagram",
        type: makeTipo,
        tipo: makeTipo,
        tipo_make: makeTipo,
        tipo_make_singular: makeTipoSingular,
        tipo_publicacao: postType,
        tipo_midia: makeMediaKind,
        post_type: postType,
        media_type: postType,
        media_kind: makeMediaKind,
        formato: makeTipo,
        formato_publicacao: postType,
        content_type: "post",
        tipo_conteudo: makeMediaKind,
        tipo_arquivo: makeMediaKind,
        tipo_imagem: "imagem",
        tipo_post: post.tipo_post,
        rota: makeRota,
        router_route: makeRota,
        make_route: makeRota,
        eh_carrossel: isCarousel,
        carrossel: isCarousel,
        is_carousel: isCarousel,
        legenda: caption,
        caption,
        caption_instagram: caption,
        texto: caption,
        url_imagem: primaryImageUrl,
        imagem_url: primaryImageUrl,
        image_url: primaryImageUrl,
        media_url: primaryImageUrl,
        arquivo_url: primaryImageUrl,
        photo_url: primaryImageUrl,
        photo_url_obrigatorio: primaryImageUrl,
        photoUrl: primaryImageUrl,
        PhotoUrl: primaryImageUrl,
        photoURL: primaryImageUrl,
        "Photo URL": primaryImageUrl,
        "photo url": primaryImageUrl,
        "PHOTO URL": primaryImageUrl,
        "Image URL": primaryImageUrl,
        "image url": primaryImageUrl,
        photo: primaryImageUrl,
        foto_url: primaryImageUrl,
        foto: primaryImageUrl,
        picture: primaryImageUrl,
        picture_url: primaryImageUrl,
        thumbnail_url: primaryImageUrl,
        link_imagem: primaryImageUrl,
        link: primaryImageUrl,
        url: primaryImageUrl,
        imagens_carrossel: imageUrls,
        image_urls: imageUrls,
        images: imageUrls,
        photos: imageUrls,
        fotos: imageUrls,
        photo_urls: imageUrls,
        files: buildMakeFiles(imageUrls),
        Files: buildMakeFiles(imageUrls),
        arquivos: buildMakeFiles(imageUrls),
        carousel_files: buildMakeFiles(imageUrls),
        carrossel_files: buildMakeFiles(imageUrls),
        file_urls: imageUrls,
        FileURLs: imageUrls,
        imagens_carrossel_json: JSON.stringify(imageUrls),
        image_urls_json: JSON.stringify(imageUrls),
        photos_json: JSON.stringify(imageUrls),
        photo_urls_csv: imageUrls.join(","),
      }, contaAlvo || perfil.arroba_usuario || perfil.instagram_arroba || null);
      externalId = webhookResult.externalId || `make:${webhookResult.status}`;
      confirmedByWebhook = Boolean(webhookResult.confirmed);
    };

    if (perfil.instagram_access_token && perfil.instagram_business_account_id) {
      via = "meta";
      try {
        await assertMetaAccountMatchesTarget(perfil.instagram_business_account_id, perfil.instagram_access_token, contaAlvo);
        externalId = await publishViaMeta({
          igBusinessId: perfil.instagram_business_account_id,
          token: perfil.instagram_access_token,
          caption,
          imageUrls,
          isStory,
          isCarousel,
        });
      } catch (metaError) {
        const metaMessage = metaError instanceof Error ? metaError.message : String(metaError);
        if (!isInvalidMetaTokenMessage(metaMessage)) throw metaError;

        await supabaseAdmin
          .from("perfil_usuario")
          .update({ instagram_access_token: null, instagram_business_account_id: null, updated_at: new Date().toISOString() })
          .eq("id", perfil.id);

        await publishWebhookForProfile(
          `Token Meta inválido/expirado para @${targetAccount || "esta conta"}: ${metaMessage}.`,
        );
      }
    } else {
      await publishWebhookForProfile();
    }

    const nextStatus = via === "meta" || confirmedByWebhook ? "Publicado" : "EnviadoMake";
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