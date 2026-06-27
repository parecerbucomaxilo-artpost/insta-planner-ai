import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

const ALLOWED_BUCKETS = new Set(["post-images", "posts_media"]);
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "*",
} as const;

function isValidToken(bucket: string, path: string, token: string | null, secret: string | undefined) {
  if (!bucket || !path || !token || !secret) return false;
  const expected = createHmac("sha256", secret).update(`${bucket}:${path}`).digest("hex");
  const provided = Buffer.from(token);
  const safeExpected = Buffer.from(expected);
  return provided.length === safeExpected.length && timingSafeEqual(provided, safeExpected);
}

async function serveMedia(request: Request, headOnly = false): Promise<Response> {
  const url = new URL(request.url);
  const bucket = url.searchParams.get("bucket") || "";
  const path = url.searchParams.get("path") || "";
  const token = url.searchParams.get("token");

  if (!ALLOWED_BUCKETS.has(bucket) || !path || path.includes("..")) {
    return new Response(headOnly ? null : "Arquivo inválido.", { status: 400, headers: corsHeaders });
  }

  if (!isValidToken(bucket, path, token, process.env.CRON_SECRET)) {
    return new Response(headOnly ? null : "Não autorizado.", { status: 401, headers: corsHeaders });
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.storage.from(bucket).download(path);
  if (error || !data) {
    return new Response(headOnly ? null : "Imagem não encontrada.", { status: 404, headers: corsHeaders });
  }

  return new Response(headOnly ? null : data, {
    headers: {
      "Content-Type": data.type || "image/jpeg",
      "Cache-Control": "public, max-age=604800, immutable",
      ...corsHeaders,
    },
  });
}

export const Route = createFileRoute("/api/public/storage-media")({
  server: {
    handlers: {
      GET: async ({ request }) => serveMedia(request),
      HEAD: async ({ request }) => serveMedia(request, true),
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
    },
  },
});