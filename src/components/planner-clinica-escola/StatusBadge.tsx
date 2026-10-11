import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Agendamento } from "@/integrations/supabase/types"n
interface StatusBadgeProps {
 status: Agendamento["status"];
}

export function StatusBadge({ status }: StatusBadgeProps) {
 const variants = {
 pendente: "bg-amber-100 text-amber-800 border-amber-200",
 confirmado: "bg-emerald-100 text-emerald-800 border-emerald-200",
 cancelado: "bg-red-100 text-red-800 border-red-200",
 } as const;

 const labels = {
 pendente: "Pendente",
 confirmado: "Confirmado",
 cancelado: "Cancelado",
 } as const;

 return (
 <Badge
 variant="outline"
 className={cn("text-[10px] mt-1", variants[status])}
 >
 {labels[status]}
 </Badge>
 );
}
