import { createServerFn } from "@tanstack/react-start";

// Retorna apenas SE cada chave existe (booleanos). Nunca retorna valores de chaves.
export const getAIProvidersStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { freeProvidersStatus } = await import("@/lib/ai-gateway.server");
  return freeProvidersStatus();
});
