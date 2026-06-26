import { timingSafeEqual } from "crypto";

/**
 * Valida o header x-cron-secret contra CRON_SECRET (env).
 * Retorna `null` se autorizado, ou uma `Response` 401/500 caso contrário.
 *
 * Use em endpoints públicos invocados apenas por cron/Make:
 *   const denied = requireCronSecret(request);
 *   if (denied) return denied;
 */
export function requireCronSecret(request: Request): Response | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return new Response(JSON.stringify({ error: "CRON_SECRET not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  const incoming = request.headers.get("x-cron-secret") ?? "";
  const a = Buffer.from(incoming);
  const b = Buffer.from(expected);
  const ok = a.length === b.length && timingSafeEqual(a, b);
  if (!ok) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}
