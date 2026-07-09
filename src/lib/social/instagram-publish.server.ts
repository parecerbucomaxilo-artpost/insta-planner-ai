const GRAPH_VERSION = "v21.0";
const TEMP_USER_ID = "00000000-0000-0000-0000-000000000000";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;
const LIGA_ACCOUNT = "lactbmf.anhanguerasbo";

type PublishVia = "meta" | "manual-liga";

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

function isFutureDate(value: unknown) {
  if (!value) return false;
  const time = new Date(String(value)).getTime();
  return Number.isFinite(time) && time > Date.now() + 60_000;
}

function chooseFetchableSource(publicUrl: string | null | undefined, cacheUrl: string | null | undefined, cacheExpiresAt: unknown) {
  const cached = typeof cacheUrl === "string" && cacheUrl.trim() && isFutureDate(cacheExpiresAt)
    ? cacheUrl.trim()
    : null;
  return cached || publicUrl || null;
}

function pairCarouselSources(publicUrls: unknown, cacheUrls: unknown, cacheExpiresAt: unknown) {
  const publicList = normalizeCarousel(publicUrls);
  const cacheList = isFutureDate(cacheExpiresAt) ? normalizeCarousel(cacheUrls) : [];
  return publicList.map((url, index) => cacheList[index] || url);
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
  // Meta valida a mídia pelo caminho/Content-Type. A URL assinada mantém o arquivo .jpg/.png no path;
  // a rota proxy (/api/public/storage-media?...), embora funcione no navegador, pode ser recusada com 400.
  const { data, error: signError } = await supabaseAdmin.storage.from("post-images").createSignedUrl(fileName, SIGNED_URL_TTL_SECONDS);
  if (signError || !data?.signedUrl) throw new Error(`Imagem indisponível para publicação: ${signError?.message || fileName}`);
  return data.signedUrl;
}

function getStorageObjectRef(value: string | null | undefined) {
  if (!value || value.startsWith("blob:") || value.startsWith("data:")) return null;
  try {
    const url = new URL(value);
    if (url.pathname.endsWith("/api/public/storage-media")) {
      const bucket = url.searchParams.get("bucket");
      const path = url.searchParams.get("path");
      return bucket && path ? { bucket, path } : null;
    }
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
  // Bucket post-images é privado: a URL pública retorna 400. Para publicação direta na Meta,
  // preferimos URL assinada do Storage, não proxy, para preservar extensão real do arquivo.
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

async function publishViaMeta({ igBusinessId, token, caption, imageUrls, isStory, isCarousel, collaborators }: {
  igBusinessId: string;
  token: string;
  caption: string;
  imageUrls: string[];
  isStory: boolean;
  isCarousel: boolean;
  collaborators?: string[];
}) {
  const collaboratorsParam: Record<string, string> = collaborators && collaborators.length > 0 && !isStory
    ? { collaborators: JSON.stringify(collaborators) }
    : {};

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
      ...collaboratorsParam,
      access_token: token,
    }, host);
    if (!parent.id) throw new Error("Instagram: container principal não foi criado.");
    await waitForContainerReady(parent.id, token, host);
    const published = await graphPost(`${igBusinessId}/media_publish`, { creation_id: parent.id, access_token: token }, host);
    return published.id;
  }

  const created = await graphPost(`${igBusinessId}/media`, {
    image_url: imageUrls[0],
    ...(isStory ? { media_type: "STORIES" } : { caption, ...collaboratorsParam }),
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

export async function publishInstagramPostById({ supabaseAdmin, postId, userId }: PublishPostInput) {
  const { data: post, error: postError } = await supabaseAdmin
    .from("posts")
    .select("id,user_id,tipo_post,formato_midia,legenda,legenda_instagram,postar_instagram,url_imagem,url_imagem_cache,url_imagem_cache_expires_at,imagens_carrossel,imagens_carrossel_cache,imagens_carrossel_cache_expires_at,instagram_conta")
    .eq("id", postId)
    .maybeSingle();

  if (postError) throw new Error(`DB: ${postError.message}`);
  if (!post) throw new Error("Post não encontrado.");
  if (post.user_id && post.user_id !== userId && post.user_id !== TEMP_USER_ID) throw new Error("Este post pertence a outro usuário.");
  if (post.postar_instagram === false) throw new Error("Este post não está marcado para Instagram.");

  try {
    

    const originalContaAlvo = normalizeInstagramAccount((post as any).instagram_conta);
    // Liga agora tenta publicar diretamente no @lactbmf.anhanguerasbo quando houver token Meta.
    // Se ainda não houver conexão válida da Liga, mantemos fallback prático: publicar via
    // @drfranciscomenezes com convite de colaboração para a Liga.
    const isLigaPost = originalContaAlvo === LIGA_ACCOUNT;
    let collaboratorUsername: string | null = null;
    let contaAlvo = originalContaAlvo;

    if (!contaAlvo) {
      throw new Error(
        `Publicação bloqueada: este post não tem instagram_conta definida. ` +
        `Defina @drfranciscomenezes ou @${LIGA_ACCOUNT} antes de publicar.`,
      );
    }


    // Publicação no @drfranciscomenezes reativada.

    let perfil: any = null;

    // 0) Se o post tem instagram_conta, ROTEAR estritamente para o perfil dessa conta.
    if (contaAlvo) {
      perfil = await findInstagramProfileByAccount(
        supabaseAdmin,
        contaAlvo,
        "id,arroba_usuario,instagram_arroba,instagram_access_token,instagram_business_account_id",
      );
      // Liga/Francisco: se não existe perfil ainda, cria placeholder para receber token via OAuth/secret.
      if (!perfil && (contaAlvo === LIGA_ACCOUNT || contaAlvo === "drfranciscomenezes")) {
        const { data: created, error: createError } = await supabaseAdmin
          .from("perfil_usuario")
          .insert({ user_id: TEMP_USER_ID, arroba_usuario: contaAlvo, instagram_arroba: contaAlvo })
          .select("id,arroba_usuario,instagram_arroba,instagram_access_token,instagram_business_account_id")
          .maybeSingle();
        if (createError) throw new Error(`DB: ${createError.message}`);
        perfil = created;
      }
      if (!perfil) {
        throw new Error(
          `Conta @${contaAlvo} não tem perfil cadastrado. Conecte essa conta antes de publicar.`,
        );
      }
    }

    if (isLigaPost && (!perfil?.instagram_access_token || !perfil?.instagram_business_account_id)) {
      const franciscoPerfil = await findInstagramProfileByAccount(
        supabaseAdmin,
        "drfranciscomenezes",
        "id,arroba_usuario,instagram_arroba,instagram_access_token,instagram_business_account_id",
      );
      if (franciscoPerfil?.instagram_access_token && franciscoPerfil?.instagram_business_account_id) {
        perfil = franciscoPerfil;
        contaAlvo = "drfranciscomenezes";
        collaboratorUsername = LIGA_ACCOUNT;
      }
    }



    const carousel = pairCarouselSources(
      post.imagens_carrossel,
      (post as any).imagens_carrossel_cache,
      (post as any).imagens_carrossel_cache_expires_at,
    );
    const singleSource = chooseFetchableSource(
      post.url_imagem,
      (post as any).url_imagem_cache,
      (post as any).url_imagem_cache_expires_at,
    );
    const sourceUrls = post.tipo_post === "Carrossel" && carousel.length > 0
      ? carousel
      : [singleSource].filter((url): url is string => typeof url === "string" && url.length > 0);
    let imageUrls = (await Promise.all(sourceUrls.map((url: string) => createFetchableUrl(supabaseAdmin, url)))).filter(Boolean) as string[];
    if (imageUrls.length === 0) throw new Error("Este post não tem imagem para publicar.");

    // Garantia de marca: re-aplica a logo na hora da publicação para posts antigos
    // gerados antes do overlay automático (ou sem ele por qualquer motivo).
    const contaParaLogo = originalContaAlvo || contaAlvo || normalizeInstagramAccount(perfil?.arroba_usuario);
    if (contaParaLogo === "drfranciscomenezes" || contaParaLogo === "lactbmf.anhanguerasbo") {
      try {
        const { fetchImageAsBase64, imageBase64ToJpegBytes, overlayLogo, overlayAlunoLogos } = await import("@/lib/logo-overlay.server");
        imageUrls = await Promise.all(imageUrls.map(async (url) => {
          const b64 = await fetchImageAsBase64(url);
          const stamped = contaParaLogo === "lactbmf.anhanguerasbo"
            ? await overlayAlunoLogos(b64)
            : await overlayLogo(b64, undefined, 10, { withLogo: true, position: "bottom-right", smart: false });
          if (stamped === b64) throw new Error("A logo oficial não foi aplicada. Publicação bloqueada.");
          const fileName = `published/stamped-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
          const bytes = imageBase64ToJpegBytes(stamped);
          const { error: upErr } = await supabaseAdmin.storage
            .from("post-images")
            .upload(fileName, bytes, { contentType: "image/jpeg", cacheControl: "604800", upsert: false });
          if (upErr) throw new Error(`Falha ao salvar imagem com logo: ${upErr.message}`);
          const { data: signed, error: signError } = await supabaseAdmin.storage
            .from("post-images")
            .createSignedUrl(fileName, SIGNED_URL_TTL_SECONDS);
          if (signError || !signed?.signedUrl) throw new Error(`Imagem com logo indisponível para publicação: ${signError?.message || fileName}`);
          return signed.signedUrl;
        }));
      } catch (e) {
        console.error("[instagram-publish] overlay obrigatório falhou:", e);
        throw new Error("A publicação foi bloqueada porque a logo oficial não pôde ser aplicada.");
      }
    }


    const caption = post.legenda_instagram || post.legenda || "";
    const isStory = /stor/i.test(post.formato_midia || "");
    const isCarousel = post.tipo_post === "Carrossel" && imageUrls.length > 1;
    let via: PublishVia = "meta";
    let externalId: string | undefined;

    const targetAccount = normalizeInstagramAccount(contaAlvo || perfil.arroba_usuario || perfil.instagram_arroba);
    const isLigaTarget = targetAccount === "lactbmf.anhanguerasbo";

    // Fallback Liga: usa token da Liga salvo como secret (META_LIGA_ACCESS_TOKEN)
    // quando o perfil ainda não tem token Meta próprio. Resolve o IG Business ID via /me/accounts.
    if (isLigaTarget && (!perfil.instagram_access_token || !perfil.instagram_business_account_id)) {
      // A Liga (@lactbmf.anhanguerasbo) é administrada pelo Facebook do Francisco Rogério Aguiar de Menezes.
      // Aceitamos tanto META_LIGA_ACCESS_TOKEN quanto META_FRANCISCO_ACCESS_TOKEN como fallback.
      const tokensTentativa = [
        process.env.META_LIGA_ACCESS_TOKEN?.trim(),
        process.env.META_FRANCISCO_ACCESS_TOKEN?.trim(),
      ].filter((t): t is string => Boolean(t));
      for (const envToken of tokensTentativa) {
        let pageToken: string | undefined;
        let igId: string | undefined;
        try {
          const accounts = await graphGetFields<{ data?: Array<{ access_token?: string; instagram_business_account?: { id?: string; username?: string } }> }>(
            "me/accounts",
            envToken,
            "access_token,instagram_business_account{id,username}",
          );
          const match = (accounts.data || []).find((p) =>
            normalizeInstagramAccount(p.instagram_business_account?.username) === LIGA_ACCOUNT,
          );
          if (match?.instagram_business_account?.id) {
            pageToken = match.access_token || envToken;
            igId = match.instagram_business_account.id;
          }
        } catch (e) {
          console.warn("[instagram-publish] liga me/accounts falhou:", e instanceof Error ? e.message : e);
        }
        if (!igId) {
          try {
            const me = await graphGetFields<{ user_id?: string; id?: string; username?: string }>(
              "me",
              envToken,
              "user_id,username",
              "graph.instagram.com",
            );
            if (normalizeInstagramAccount(me.username) === LIGA_ACCOUNT) {
              igId = me.user_id || me.id;
              pageToken = envToken;
            }
          } catch (e) {
            console.warn("[instagram-publish] liga graph.instagram.com/me falhou:", e instanceof Error ? e.message : e);
          }
        }
        if (igId && pageToken) {
          perfil.instagram_access_token = pageToken;
          perfil.instagram_business_account_id = igId;
          await supabaseAdmin
            .from("perfil_usuario")
            .update({ instagram_access_token: pageToken, instagram_business_account_id: igId, updated_at: new Date().toISOString() })
            .eq("id", perfil.id);
          break;
        }
      }
      if (!perfil.instagram_business_account_id) {
        console.warn("[instagram-publish] nenhum token Meta (Liga/Francisco) resolveu IG Business ID para", LIGA_ACCOUNT);
      }
    }

    // Fallback Francisco: usa META_FRANCISCO_ACCESS_TOKEN quando o perfil não tem token salvo.
    const isFranciscoTarget = targetAccount === "drfranciscomenezes";
    if (isFranciscoTarget && (!perfil.instagram_access_token || !perfil.instagram_business_account_id)) {
      const envToken = process.env.META_FRANCISCO_ACCESS_TOKEN?.trim();
      if (envToken) {
        let pageToken: string | undefined;
        let igId: string | undefined;
        try {
          const accounts = await graphGetFields<{ data?: Array<{ access_token?: string; instagram_business_account?: { id?: string; username?: string } }> }>(
            "me/accounts",
            envToken,
            "access_token,instagram_business_account{id,username}",
          );
          const match = (accounts.data || []).find((p) =>
            normalizeInstagramAccount(p.instagram_business_account?.username) === "drfranciscomenezes",
          );
          if (match?.instagram_business_account?.id) {
            pageToken = match.access_token || envToken;
            igId = match.instagram_business_account.id;
          }
        } catch (e) {
          console.warn("[instagram-publish] francisco me/accounts falhou:", e instanceof Error ? e.message : e);
        }
        if (!igId) {
          try {
            const me = await graphGetFields<{ user_id?: string; id?: string; username?: string }>(
              "me",
              envToken,
              "user_id,username",
              "graph.instagram.com",
            );
            if (normalizeInstagramAccount(me.username) === "drfranciscomenezes") {
              igId = me.user_id || me.id;
              pageToken = envToken;
            }
          } catch (e) {
            console.warn("[instagram-publish] francisco graph.instagram.com/me falhou:", e instanceof Error ? e.message : e);
          }
        }
        if (igId && pageToken) {
          perfil.instagram_access_token = pageToken;
          perfil.instagram_business_account_id = igId;
          await supabaseAdmin
            .from("perfil_usuario")
            .update({ instagram_access_token: pageToken, instagram_business_account_id: igId, updated_at: new Date().toISOString() })
            .eq("id", perfil.id);
        }
      }
    }

    if (!perfil.instagram_access_token || !perfil.instagram_business_account_id) {
      throw new Error(
        `Conta @${targetAccount || "esta conta"} sem token Meta válido. ` +
        `Conecte o Instagram em "Configurações > Conectar Instagram" antes de publicar — ` +
        `não usamos mais Make/webhooks externos.`,
      );
    }

    via = "meta";
    try {
      if (!collaboratorUsername) {
        await assertMetaAccountMatchesTarget(perfil.instagram_business_account_id, perfil.instagram_access_token, contaAlvo);
      }
      externalId = await publishViaMeta({
        igBusinessId: perfil.instagram_business_account_id,
        token: perfil.instagram_access_token,
        caption,
        imageUrls,
        isStory,
        isCarousel,
        collaborators: collaboratorUsername ? [collaboratorUsername] : undefined,
      });

    } catch (metaError) {
      const metaMessage = metaError instanceof Error ? metaError.message : String(metaError);
      if (isInvalidMetaTokenMessage(metaMessage)) {
        await supabaseAdmin
          .from("perfil_usuario")
          .update({ instagram_access_token: null, instagram_business_account_id: null, updated_at: new Date().toISOString() })
          .eq("id", perfil.id);
        throw new Error(
          `Token Meta inválido/expirado para @${targetAccount || "esta conta"}: ${metaMessage}. ` +
          `Reconecte o Instagram em "Configurações > Conectar Instagram".`,
        );
      }
      throw metaError;
    }

    const nextStatus = "Publicado";
    const publishedAt = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("posts")
      .update({
        status: nextStatus,
        data_agendamento: publishedAt,
        user_id: userId,
      })
      .eq("id", post.id);
    if (updateError) throw new Error(`DB: ${updateError.message}`);

    return { ok: true, via, externalId, profileId: perfil.id, status: nextStatus };
  } catch (error) {
    await supabaseAdmin.from("posts").update({ status: "Erro", user_id: post.user_id === TEMP_USER_ID ? userId : post.user_id }).eq("id", post.id);
    throw error;
  }
}