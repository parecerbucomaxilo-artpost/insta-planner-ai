import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { WorkerMailer } from "worker-mailer";

type Input = {
  evento: "agendado" | "publicado";
  postId?: string;
  tipo?: string;
  legenda?: string;
  dataAgendamento?: string | null;
};

export const sendPostEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Input) => data)
  .handler(async ({ data, context }) => {
    const host = process.env.SMTP_HOST;
    const portStr = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;

    if (!host || !portStr || !user || !pass) {
      console.error("[sendPostEmail] SMTP env vars ausentes");
      return { success: false, error: "SMTP não configurado" };
    }

    const port = Number(portStr);
    const email = context.claims.email as string | undefined;
    if (!email) {
      return { success: false, error: "Usuário sem e-mail" };
    }

    const eventoLabel = data.evento === "agendado" ? "agendado" : "publicado";
    const subject = `✅ Post ${eventoLabel} — Planner Dr. Francisco Menezes`;

    const dataFmt = data.dataAgendamento
      ? new Date(data.dataAgendamento).toLocaleString("pt-BR", {
          dateStyle: "long",
          timeStyle: "short",
          timeZone: "America/Sao_Paulo",
        })
      : "Imediato";

    const legendaShort = (data.legenda || "").slice(0, 400);

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0a1f44">
        <h2 style="color:#0a1f44;margin:0 0 12px">Post ${eventoLabel} com sucesso</h2>
        <p style="margin:0 0 16px;color:#334">Seu conteúdo foi registrado no Planner.</p>
        <table style="width:100%;border-collapse:collapse;background:#f5f8ff;border-radius:8px">
          <tr><td style="padding:10px 14px;color:#566;width:140px">Tipo</td><td style="padding:10px 14px;font-weight:600">${data.tipo || "-"}</td></tr>
          <tr><td style="padding:10px 14px;color:#566">Data</td><td style="padding:10px 14px;font-weight:600">${dataFmt}</td></tr>
          <tr><td style="padding:10px 14px;color:#566">ID</td><td style="padding:10px 14px;font-family:monospace;font-size:12px">${data.postId || "-"}</td></tr>
        </table>
        ${legendaShort ? `<div style="margin-top:16px;padding:14px;border-left:4px solid #0066ff;background:#fafbff;white-space:pre-wrap">${legendaShort.replace(/</g, "&lt;")}</div>` : ""}
        <p style="margin-top:24px;font-size:12px;color:#889">Planner Dr. Francisco Menezes</p>
      </div>
    `;

    try {
      const mailer = await WorkerMailer.connect({
        host,
        port,
        secure: port === 465,
        credentials: { username: user, password: pass },
        authType: "login",
      });

      await mailer.send({
        from: { name: "Planner Dr. Francisco", email: user },
        to: { email },
        subject,
        html,
        text: `Post ${eventoLabel}. Tipo: ${data.tipo || "-"}. Data: ${dataFmt}.`,
      });

      await mailer.close();
      return { success: true };
    } catch (e) {
      console.error("[sendPostEmail] Falha SMTP:", e);
      return {
        success: false,
        error: e instanceof Error ? e.message : "Erro SMTP",
      };
    }
  });
