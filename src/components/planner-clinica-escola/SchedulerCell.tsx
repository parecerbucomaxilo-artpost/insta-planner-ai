import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/planner-clinica-escola/StatusBadge";
import type { Agendamento } from "@/integrations/supabase/types"n
interface SchedulerCellProps {
 agendamento?: Agendamento;
 onClick: () => void;
 onRemove: (id: string) => void;
}

export function SchedulerCell({ agendamento, onClick, onRemove }: SchedulerCellProps) {
 if (!agendamento) {
 return (
 <button
 type="button"
 onClick={onClick}
 className="w-full h-full min-h-[60px] rounded-md border border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/5 transition-colors flex items-center justify-center text-muted-foreground/50 text-xs"
 >
 +
 </button>
 );
 }

 return (
 <div
 className={cn(
 "w-full h-full min-h-[60px] rounded-md border p-2 cursor-pointer transition-all hover:shadow-md",
 "bg-primary/5 border-primary/20"
 )}
 onClick={onClick}
 >
 <div className="flex items-start justify-between gap-1">
 <p className="text-xs font-semibold truncate">{agendamento.paciente}</p>
 <button
 type="button"
 onClick={(e) => {
 e.stopPropagation();
 onRemove(agendamento.id);
 }}
 className="text-muted-foreground hover:text-destructive text-xs"
 >
 ×
 </button>
 </div>
 <p className="text-[10px] text-muted-foreground truncate">{agendamento.procedimento}</p>
 <StatusBadge status={agendamento.status} />
 </div>
 );
}
