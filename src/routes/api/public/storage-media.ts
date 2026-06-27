import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

const ALLOWED_BUCKETS = new Set(["post-images", "posts_media"]);

function isValidToken(bucket: string, path: string, token: string | null, secret: string | undefined) {
  if (!bucket || !path || !token || !secret) return false;
  const expected = createHmac("sha256", secret).update(`${bucket}:${path}`).digest("hex");
  const provided = Buffer.from(token);
  const safeExpected = Buffer.from(expected);
  return provided.length === safeExpected.length && timingSafeEqual(provided, safeExpected);
}

export const Route = createFileRoute("/api/public/storage-media")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const bucket = url.searchParams.get("bucket") || "";
        const path = url.searchParams.get("path") || "";
        const token = url.searchParams.get("token");

        if (!ALLOWED_BUCKETS.has(bucket) || !path || path.includes("..")) {
          return new Response("Arquivo inválido.", { status: 400 });
        }

        if (!isValidToken(bucket, path, token, process.env.CRON_SECRET)) {
          return new Response("Não autorizado.", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from(bucket).download(path);
        if (error || !data) {
          return new Response("Imagem não encontrada.", { status: 404 });
        }

        return new Response(data, {
          headers: {
            "Content-Type": data.type || "image/jpeg",
            "Cache-Control": "public, max-age=604800, immutable",
          },
        });
      },
    },
  },
});