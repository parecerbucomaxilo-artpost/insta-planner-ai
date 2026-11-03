import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLinkedInStatus } from "@/lib/social/linkedin-status.functions";
import { canSendToLinkedIn, LINKEDIN_RECONNECT_MESSAGE } from "@/lib/social/linkedin-status";

/** Optional background check, deliberately outside route loading and navigation. */
export function useLinkedInStatus() {
  const getStatus = useServerFn(getLinkedInStatus);
  const query = useQuery({
    queryKey: ["linkedin-optional-status"],
    queryFn: () => getStatus(),
    retry: false,
    staleTime: 60_000,
  });
  return {
    connected: canSendToLinkedIn(query.data),
    message: query.isPending ? "Verificando integração opcional do LinkedIn…" : query.data?.message ?? LINKEDIN_RECONNECT_MESSAGE,
    refresh: query.refetch,
  };
}