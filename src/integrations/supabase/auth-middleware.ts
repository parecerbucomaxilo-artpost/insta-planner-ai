// Middleware de autenticação do Supabase. Requisições sem JWT válido são rejeitadas.
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabasePublishableKey) {
      throw new Error("Serviço de autenticação indisponível: configuração Supabase ausente.");
    }

    const request = getRequest();
    const authorization = request?.headers.get("authorization") ?? "";
    const bearer = /^Bearer\s+(.+)$/i.exec(authorization);
    const token = bearer?.[1]?.trim();

    if (!token) {
      throw new Error("Não autenticado.");
    }

    const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase.auth.getClaims(token);
    const userId = data?.claims?.sub;

    if (error || typeof userId !== "string" || !userId) {
      throw new Error("Não autenticado.");
    }

    return next({
      context: {
        supabase,
        userId,
        claims: data.claims,
      },
    });
  },
);
