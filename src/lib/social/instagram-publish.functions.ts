import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TEMP_USER_ID = "00000000-0000-0000-0000-000000000000";

export const publishInstagramNow = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { publishInstagramPostById } = await import("@/lib/social/instagram-publish.server");
    const { data: post, error } = await supabaseAdmin
      .from("posts")
      .select("user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(`DB: ${error.message}`);
    const userId = post?.user_id || TEMP_USER_ID;
    try {
      return await publishInstagramPostById({ supabaseAdmin, postId: data.id, userId });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code = /410|scenario listening|webhook.*inativo|webhook.*inválido/i.test(message)
        ? "MAKE_WEBHOOK_INACTIVE"
        : "INSTAGRAM_PUBLISH_FAILED";
      console.warn("[publishInstagramNow] publicação bloqueada", { postId: data.id, code, message });
      return { ok: false, via: "webhook" as const, code, error: message };
    }
  });
