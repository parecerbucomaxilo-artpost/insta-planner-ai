// Publicação real no LinkedIn via gateway Lovable.
// Usa o connector LinkedIn (OAuth gerenciado) — token injetado pelo gateway.

const GATEWAY = "https://connector-gateway.lovable.dev/linkedin";
const SIGNED_URL_TTL = 60 * 60 * 24 * 7;

type PublishInput = {
  supabaseAdmin: any;
  postId: string;
  userId?: string;
};

function authHeaders() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const liKey = process.env.LINKEDIN_API_KEY;
  if (!lovableKey) throw new Error("LOVABLE_API_KEY ausente.");
  if (!liKey) throw new Error("LinkedIn não conectado (LINKEDIN_API_KEY ausente).");
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": liKey,
  } as const;
}

async function getMemberUrn(): Promise<string> {
  const res = await fetch(`${GATEWAY}/v2/userinfo`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`LinkedIn /userinfo ${res.status}: ${await res.text().catch(() => "")}`);
  const { sub } = (await res.json()) as { sub: string };
  if (!sub) throw new Error("LinkedIn não retornou sub.");
  return `urn:li:person:${sub}`;
}

function getStorageRef(value: string) {
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    const i = parts.findIndex((p) => p === "object");
    const bucket = i >= 0 ? parts[i + 2] : null;
    const path = i >= 0 ? parts.slice(i + 3).map(decodeURIComponent).join("/") : null;
    return bucket && path ? { bucket, path } : null;
  } catch {
    return null;
  }
}

async function fetchImageBytes(supabaseAdmin: any, imageUrl: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  const ref = getStorageRef(imageUrl);
  let target = imageUrl;
  if (ref) {
    const { data, error } = await supabaseAdmin.storage.from(ref.bucket).createSignedUrl(ref.path, SIGNED_URL_TTL);
    if (error || !data?.signedUrl) throw new Error(`Imagem indisponível: ${error?.message || ref.path}`);
    target = data.signedUrl;
  }
  const r = await fetch(target);
  if (!r.ok) throw new Error(`Falha ao baixar imagem ${r.status}`);
  const buf = new Uint8Array(await r.arrayBuffer());
  const ct = r.headers.get("content-type") || "image/png";
  return { bytes: buf, contentType: ct };
}

async function uploadImageAsset(ownerUrn: string, bytes: Uint8Array, contentType: string): Promise<string> {
  // 1) registerUpload
  const reg = await fetch(`${GATEWAY}/v2/assets?action=registerUpload`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
        owner: ownerUrn,
        serviceRelationships: [{ relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" }],
      },
    }),
  });
  if (!reg.ok) throw new Error(`registerUpload ${reg.status}: ${await reg.text().catch(() => "")}`);
  const regJson = (await reg.json()) as any;
  const uploadUrl: string = regJson?.value?.uploadMechanism?.["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]?.uploadUrl;
  const asset: string = regJson?.value?.asset;
  if (!uploadUrl || !asset) throw new Error("registerUpload sem uploadUrl/asset.");

  // 2) PUT bytes (signed URL — sem auth header)
  const put = await fetch(uploadUrl, { method: "PUT", body: bytes as any, headers: { "Content-Type": contentType } });
  if (!put.ok && put.status !== 201) throw new Error(`Upload imagem ${put.status}`);

  return asset;
}

export async function publishLinkedInPostById({ supabaseAdmin, postId }: PublishInput) {
  const { data: post, error } = await supabaseAdmin
    .from("posts")
    .select("id,legenda,legenda_linkedin,url_imagem,imagens_carrossel,postar_linkedin,status")
    .eq("id", postId)
    .maybeSingle();
  if (error) throw new Error(`DB: ${error.message}`);
  if (!post) throw new Error("Post não encontrado.");
  if (!post.postar_linkedin) throw new Error("Post não está marcado para LinkedIn.");

  const text: string = (post.legenda_linkedin || post.legenda || "").trim();
  if (!text) throw new Error("Sem legenda para publicar no LinkedIn.");

  const carrossel: string[] = Array.isArray(post.imagens_carrossel) ? post.imagens_carrossel.filter((x: any) => typeof x === "string") : [];
  const imageUrl: string | null = post.url_imagem || carrossel[0] || null;

  const ownerUrn = await getMemberUrn();

  let media: any[] = [];
  let category: "NONE" | "IMAGE" = "NONE";
  if (imageUrl) {
    try {
      const { bytes, contentType } = await fetchImageBytes(supabaseAdmin, imageUrl);
      const asset = await uploadImageAsset(ownerUrn, bytes, contentType);
      category = "IMAGE";
      media = [{ status: "READY", media: asset, title: { text: "" }, description: { text: "" } }];
    } catch (e: any) {
      // Se falhar upload, publica texto puro em vez de quebrar tudo.
      console.warn("LinkedIn image upload falhou, publicando só texto:", e?.message);
    }
  }

  const body = {
    author: ownerUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: category,
        ...(media.length ? { media } : {}),
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
  };

  const res = await fetch(`${GATEWAY}/v2/ugcPosts`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "X-Restli-Protocol-Version": "2.0.0" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`LinkedIn ugcPosts ${res.status}: ${t}`);
  }
  const json = (await res.json().catch(() => ({}))) as any;
  const ugcId: string = json?.id || res.headers.get("x-restli-id") || "";
  const shareUrl = ugcId ? `https://www.linkedin.com/feed/update/${encodeURIComponent(ugcId)}/` : "https://www.linkedin.com/feed/";

  await supabaseAdmin
    .from("posts")
    .update({ status: "Publicado", updated_at: new Date().toISOString() })
    .eq("id", postId);

  return { ok: true as const, shareUrl, ugcId };
}
