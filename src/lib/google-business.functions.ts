import { createServerFn } from "@tanstack/react-start";

/** Informa se a integração do Google Business (webhook de publicação) está configurada. */
export const googleBusinessStatus = createServerFn({ method: "GET" }).handler(async () => {
  const conectado = Boolean(process.env.MAKE_GBP_WEBHOOK_URL);
  return {
    conectado,
    mensagem: conectado
      ? "Google Business conectado: os posts são enviados nos horários agendados."
      : "Google Business não está conectado — o post não será publicado no Google.",
  };
});
