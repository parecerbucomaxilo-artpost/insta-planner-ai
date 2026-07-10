import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const publishInstagramNow = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const tempUserId = "00000000-0000-0000-0000-000000000000";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { publishInstagramPostById } = await import("@/lib/social/instagram-publish.server");
    const { data: post, error } = await supabaseAdmin
      .from("posts")
      .select("user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(`DB: ${error.message}`);
    const userId = post?.user_id || tempUserId;
    try {
      return await publishInstagramPostById({ supabaseAdmin, postId: data.id, userId });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code = /access token|OAuthException|Cannot parse|token Meta|token.*inválido|token.*expirado/i.test(message)
        ? "META_TOKEN_INVALID"
        : "INSTAGRAM_PUBLISH_FAILED";
      console.warn("[publishInstagramNow] publicação bloqueada", { postId: data.id, code, message });
      return { ok: false, via: "meta" as const, code, error: message };
    }
  });
