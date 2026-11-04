/** Internal approval is Rascunho; scheduling is an explicit approved transition. */
export function assertPublicationAllowed(status: string, scheduledAt: string | null | undefined, now = Date.now()) {
  if (status === "Rascunho") return;
  if (status === "Agendado") {
    const due = scheduledAt ? Date.parse(scheduledAt) : NaN;
    if (!Number.isFinite(due)) throw new Error("Post agendado sem horário válido.");
    if (due > now) throw new Error("Este post será enviado somente no horário escolhido.");
    return;
  }
  throw new Error("Publicação bloqueada: aprove o post antes de enviar; posts enviados ou negados não podem ser reenviados.");
}