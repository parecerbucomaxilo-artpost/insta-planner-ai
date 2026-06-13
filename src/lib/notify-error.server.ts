// Server-only helper to record error notifications for all users of the project.
// Errors come from cron endpoints (no user context) so we broadcast to every
// perfil_usuario row — with 1-2 users this is fine and keeps the badge working
// regardless of who is logged in.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface ErrorNotifInput {
  tipo: "geracao" | "publicacao_instagram" | "publicacao_linkedin" | "sistema";
  titulo: string;
  mensagem: string;
  postId?: string;
  contexto?: Record<string, unknown>;
}

export async function logErrorForAllUsers(input: ErrorNotifInput): Promise<void> {
  try {
    const { data: users } = await supabaseAdmin
      .from("perfil_usuario")
      .select("user_id");
    const userIds = (users ?? []).map((u: any) => u.user_id).filter(Boolean);
    if (userIds.length === 0) return;

    const rows = userIds.map((uid: string) => ({
      user_id: uid,
      tipo: input.tipo,
      titulo: input.titulo,
      mensagem: input.mensagem.slice(0, 1000),
      post_id: input.postId ?? null,
      contexto: input.contexto ?? {},
    }));
    await supabaseAdmin.from("notificacoes_erro").insert(rows);
  } catch (err) {
    console.error("[notify-error] falhou ao registrar:", err);
  }
}
