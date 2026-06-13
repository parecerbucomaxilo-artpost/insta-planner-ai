import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listMyNotifs, markAllNotifsRead } from "@/lib/notifications.functions";

interface Notif {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  post_id: string | null;
  lida: boolean;
  created_at: string;
}

export function NotificationsBell() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listMyNotifs);
  const markRead = useServerFn(markAllNotifsRead);

  const { data } = useQuery({
    queryKey: ["notificacoes-erro"],
    queryFn: () => fetchList(),
    refetchInterval: 60_000,
  });

  const items: Notif[] = (data?.items ?? []) as Notif[];
  const naoLidas = data?.naoLidas ?? 0;

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!open && naoLidas > 0) {
          markRead().then(() => qc.invalidateQueries({ queryKey: ["notificacoes-erro"] }));
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative" aria-label="Notificações">
          <Bell className="h-4 w-4" />
          {naoLidas > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] bg-destructive text-destructive-foreground border-0">
              {naoLidas > 9 ? "9+" : naoLidas}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
        <div className="px-3 py-2 border-b">
          <p className="text-sm font-semibold">Notificações</p>
          <p className="text-xs text-muted-foreground">
            {items.length === 0 ? "Nenhuma notificação" : `${items.length} recentes`}
          </p>
        </div>
        {items.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            Tudo certo por aqui.
          </div>
        ) : (
          <ul className="divide-y">
            {items.map((n) => (
              <li key={n.id} className={`px-3 py-2 text-sm ${n.lida ? "opacity-60" : ""}`}>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{n.titulo}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{n.mensagem}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
