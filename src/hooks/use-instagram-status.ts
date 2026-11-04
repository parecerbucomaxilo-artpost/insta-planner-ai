import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listInstagramConnections } from "@/lib/instagram-status.functions";

export function useInstagramStatus() {
  const getStatus = useServerFn(listInstagramConnections);
  const cache = useQueryClient();
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => { if (active) setUid(data.user?.id || null); });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      setUid(session?.user.id || null);
      cache.removeQueries({ queryKey: ["instagram-connections"] });
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [cache]);
  const query = useQuery({ queryKey: ["instagram-connections", uid], queryFn: () => getStatus(), enabled: !!uid, retry: false, staleTime: 60_000, refetchOnWindowFocus: "always", refetchInterval: 60_000 });
  useEffect(() => {
    const refresh = () => { if (uid) void query.refetch(); };
    const message = (event: MessageEvent) => { if (event.origin === "https://insta-planner-ai.lovable.app" && ["meta-oauth-done", "instagram-oauth-done"].includes(event.data?.type)) refresh(); };
    window.addEventListener("message", message);
    return () => window.removeEventListener("message", message);
  }, [uid, query.refetch]);
  return { contas: query.data || [], loading: query.isPending && !!uid, error: query.isError ? "Não foi possível verificar Instagram. Contas salvas preservadas; tente novamente." : "", refresh: query.refetch };
}