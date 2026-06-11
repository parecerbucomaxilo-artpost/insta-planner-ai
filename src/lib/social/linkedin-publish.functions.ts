import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase } from "@/integrations/supabase/client";

const GATEWAY = "https://connector-gateway.lovable.dev/linkedin";

type PublishInput = {
  text: string;
  imageUrls?: string[]; // 0..n; LinkedIn UGC suporta múltiplas imagens
};

type PublishResult = {
  ok: boolean;
  postUrn?: string;
  shareUrl?: string;
  error?: string;
};

async function gatewayHeaders() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  
  // Tentar buscar token manual do banco primeiro
  const { data: perfil } = await supabase
    .from("perfil_usuario")
    .select("linkedin_access_token")
    .limit(1)
    .maybeSingle();

  const linkedinKey = perfil?.linkedin_access_token || process.env.LINKEDIN_API_KEY;
  
  if (!lovableKey) throw new Error("LOVABLE_API_KEY ausente no backend.");
  if (!linkedinKey) throw new Error("LinkedIn não está conectado. Vá em Configurações → Integrações.");
  
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": linkedinKey,
  };
}

async function gatewayJson(path: string, init?: RequestInit) {
  const headers = await gatewayHeaders();
  const res = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: {
      ...headers,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      ...(init?.headers || {}),
    },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`LinkedIn ${path} ${res.status}: ${body.slice(0, 400)}`);
  try { return JSON.parse(body); } catch { return body; }
}

async function getMemberSub(): Promise<string> {
  const me = await gatewayJson(`/v2/userinfo`, { method: "GET" });
  if (!me?.sub) throw new Error("Não foi possível ler o ID do membro LinkedIn (sub).");
  return String(me.sub);
}

/** Registra upload, faz PUT da imagem na URL retornada, devolve o asset URN. */
async function uploadImageAsset(authorUrn: string, imageUrl: string): Promise<string> {
  // 1) registerUpload
  const reg = await gatewayJson(`/v2/assets?action=registerUpload`, {
    method: "POST",
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
        owner: authorUrn,
        serviceRelationships: [
          { relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" },
        ],
      },
    }),
  });
  const uploadUrl =
    reg?.value?.uploadMechanism?.["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]
      ?.uploadUrl;
  const asset = reg?.value?.asset;
  if (!uploadUrl || !asset) throw new Error("Resposta inválida do registerUpload do LinkedIn.");

  // 2) baixa bytes da imagem (URL pública do Supabase Storage)
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Falha ao baixar imagem (${imgRes.status}) ${imageUrl}`);
  const bytes = await imgRes.arrayBuffer();
  const contentType = imgRes.headers.get("content-type") || "image/jpeg";

  // 3) PUT direto na uploadUrl (não passa pelo gateway — é assinada)
  const headers = await gatewayHeaders();
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${headers["X-Connection-Api-Key"]}`,
      "Content-Type": contentType,
    },
    body: bytes,
  });
  if (!put.ok) {
    // Algumas variações exigem PUT sem Authorization (URL já assinada). Tenta de novo sem header.
    const put2 = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: bytes,
    });
    if (!put2.ok) {
      const txt = await put2.text().catch(() => "");
      throw new Error(`Upload da imagem para o LinkedIn falhou (${put2.status}): ${txt.slice(0, 200)}`);
    }
  }

  return asset as string;
}

export const publishToLinkedIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: PublishInput) => {
    if (!d || typeof d.text !== "string") throw new Error("text é obrigatório.");
    return d;
  })
  .handler(async ({ data }): Promise<PublishResult> => {
    try {
      const sub = await getMemberSub();
      const author = `urn:li:person:${sub}`;
      const text = data.text.slice(0, 2900);
      const images = (data.imageUrls || []).filter((u) => typeof u === "string" && u.length > 0).slice(0, 9);

      let mediaCategory: "NONE" | "IMAGE" = "NONE";
      const media: Array<{ status: string; media: string; description?: { text: string }; title?: { text: string } }> = [];
      if (images.length > 0) {
        mediaCategory = "IMAGE";
        for (const url of images) {
          const asset = await uploadImageAsset(author, url);
          media.push({
            status: "READY",
            media: asset,
            description: { text: "" },
            title: { text: "" },
          });
        }
      }

      const ugc = await gatewayJson(`/v2/ugcPosts`, {
        method: "POST",
        body: JSON.stringify({
          author,
          lifecycleState: "PUBLISHED",
          specificContent: {
            "com.linkedin.ugc.ShareContent": {
              shareCommentary: { text },
              shareMediaCategory: mediaCategory,
              ...(media.length > 0 ? { media } : {}),
            },
          },
          visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
        }),
      });

      const postUrn: string | undefined = ugc?.id || ugc?.["x-restli-id"];
      const shareUrl = postUrn ? `https://www.linkedin.com/feed/update/${encodeURIComponent(postUrn)}/` : undefined;

      return { ok: true, postUrn, shareUrl };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido ao publicar no LinkedIn";
      console.error("[publishToLinkedIn]", msg);
      return { ok: false, error: msg };
    }
  });

/** Lê o perfil público do membro autenticado (status da conexão). */
export const getLinkedInStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      const me = await gatewayJson(`/v2/userinfo`, { method: "GET" });
      return {
        connected: true as const,
        name: me?.name as string | undefined,
        email: me?.email as string | undefined,
        picture: me?.picture as string | undefined,
        sub: me?.sub as string | undefined,
      };
    } catch (e) {
      return {
        connected: false as const,
        error: e instanceof Error ? e.message : "Falha ao consultar LinkedIn",
      };
    }
  });
