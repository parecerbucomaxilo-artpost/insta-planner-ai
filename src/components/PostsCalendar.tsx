import { useMemo, useState } from "react";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Film } from "lucide-react";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { PostRow } from "@/lib/posts-types";

const statusColor: Record<string, string> = {
  Rascunho: "bg-[var(--status-draft)]",
  Agendado: "bg-[var(--status-scheduled)]",
  Publicado: "bg-[var(--status-published)]",
  Erro: "bg-[var(--status-error)]",
};

export function PostsCalendar({ posts }: { posts: PostRow[] }) {
  const [selected, setSelected] = useState<Date | undefined>(new Date());

  const postsByDay = useMemo(() => {
    const map = new Map<string, PostRow[]>();
    for (const p of posts) {
      if (!p.data_agendamento) continue;
      const d = new Date(p.data_agendamento);
      const key = format(d, "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    return map;
  }, [posts]);

  const dayPosts = selected
    ? posts.filter((p) => p.data_agendamento && isSameDay(new Date(p.data_agendamento), selected))
    : [];

  return (
    <div className="grid lg:grid-cols-[auto_1fr] gap-6">
      <Card className="p-4 w-fit">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={setSelected}
          locale={ptBR}
          className="pointer-events-auto"
          components={{
            DayButton: (props) => {
              const key = format(props.day.date, "yyyy-MM-dd");
              const dayItems = postsByDay.get(key) ?? [];
              const hasReel = dayItems.some((p) => p.formato_midia === "Vídeo/Reels");
              return (
                <div className="relative">
                  <CalendarDayButton {...props} />
                  {hasReel && (
                    <Film className="pointer-events-none absolute top-0.5 right-0.5 h-3 w-3 text-violet-500" />
                  )}
                  {dayItems.length > 0 && (
                    <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                      {dayItems.slice(0, 3).map((p, i) => (
                        <span key={i} className={`h-1.5 w-1.5 rounded-full ${statusColor[p.status] ?? ""}`} />
                      ))}
                    </div>
                  )}
                </div>
              );
            },
          }}
        />
        <div className="mt-4 space-y-1.5 text-xs">
          {Object.entries(statusColor).map(([k, c]) => (
            <div key={k} className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${c}`} />
              <span className="text-muted-foreground">{k}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold mb-4">
          {selected ? format(selected, "PPP", { locale: ptBR }) : "Selecione uma data"}
        </h3>
        {dayPosts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum post agendado para esta data.</p>
        ) : (
          <ul className="space-y-3">
            {dayPosts.map((p) => {
              const thumb = p.url_imagem ?? (Array.isArray(p.imagens_carrossel) ? p.imagens_carrossel[0] : null);
              return (
                <li key={p.id} className="flex gap-3 p-3 rounded-lg border hover:bg-accent/40 transition-colors">
                  {thumb ? (
                    <img src={thumb} alt="" className="h-16 w-16 rounded-md object-cover" />
                  ) : (
                    <div className="h-16 w-16 rounded-md bg-muted" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">{p.tipo_post}</Badge>
                      <Badge className={`text-xs text-white ${statusColor[p.status]}`}>{p.status}</Badge>
                    </div>
                    <p className="text-sm line-clamp-2">{p.legenda || <span className="text-muted-foreground">(sem legenda)</span>}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {p.data_agendamento && format(new Date(p.data_agendamento), "HH:mm")}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
