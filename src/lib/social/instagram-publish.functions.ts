import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const publishInstagramNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: owned, error: ownerError } = await context.supabase.from("posts").select("id,user_id").eq("id", data.id).eq("user_id", context.userId).maybeSingle();
    if (ownerError || !owned) throw new Error("Post não pertence à sua conta.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { publishInstagramPostById } = await import("@/lib/social/instagram-publish.server");
    const { data: post, error } = await supabaseAdmin
      .from("posts")
      .select("user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(`DB: ${error.message}`);
    const userId = context.userId;
    try {
      return await publishInstagramPostById({ supabaseAdmin, postId: data.id, userId });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code = /access token|OAuthException|Cannot parse|token Meta|token.*inválido|token.*expirado/i.test(message)
        ? "META_TOKEN_INVALID"
        : "INSTAGRAM_PUBLISH_FAILED";
      console.warn("[publishInstagramNow] publicação bloqueada", { postId: data.id, code });
      return { ok: false, via: "meta" as const, code, error: message };
    }
  });
