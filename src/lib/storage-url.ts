import { supabase } from "@/integrations/supabase/client";

const POST_MEDIA_BUCKETS = new Set(["post-images", "posts_media"]);
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

type StorageObjectRef = {
  bucket: string;
  path: string;
};

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function getPostStorageObjectRef(value: string | null | undefined): StorageObjectRef | null {
  if (!value || value.startsWith("blob:") || value.startsWith("data:")) return null;

  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    const objectIndex = parts.findIndex((part) => part === "object");
    const bucket = objectIndex >= 0 ? parts[objectIndex + 2] : null;
    const pathParts = objectIndex >= 0 ? parts.slice(objectIndex + 3) : [];

    if (!bucket || !POST_MEDIA_BUCKETS.has(bucket) || pathParts.length === 0) return null;
    return { bucket, path: pathParts.map(safeDecode).join("/") };
  } catch {
    const [bucket, ...pathParts] = value.split("/");
    if (!POST_MEDIA_BUCKETS.has(bucket) || pathParts.length === 0) return null;
    return { bucket, path: pathParts.map(safeDecode).join("/") };
  }
}

export async function createPostMediaDisplayUrl(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  const ref = getPostStorageObjectRef(value);
  if (!ref) return value;

  const { data, error } = await supabase.storage
    .from(ref.bucket)
    .createSignedUrl(ref.path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    console.warn("Não foi possível assinar URL de mídia:", error?.message ?? ref.path);
    return value;
  }

  return data.signedUrl;
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

export async function signPostMediaUrls<T extends { url_imagem?: string | null; url_da_imagem?: string | null; imagens_carrossel?: unknown }>(
  post: T,
): Promise<T & { imagens_carrossel: string[] }> {
  const [urlImagem, urlDaImagem, imagensCarrossel] = await Promise.all([
    createPostMediaDisplayUrl(post.url_imagem),
    createPostMediaDisplayUrl(post.url_da_imagem),
    Promise.all(normalizeCarousel(post.imagens_carrossel).map((url) => createPostMediaDisplayUrl(url))),
  ]);

  return {
    ...post,
    url_imagem: urlImagem,
    url_da_imagem: urlDaImagem,
    imagens_carrossel: imagensCarrossel.filter((url): url is string => Boolean(url)),
  };
}