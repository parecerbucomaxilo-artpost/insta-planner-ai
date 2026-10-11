import { Card } from "@/components/ui/card";
import { CalendarCheck, Clock, Users, TrendingUp } from "lucide-react";

interface PlannerStatsProps {
 totalAgendamentos: number;
 agendamentosHoje: number;
 pacientesAtivos: number;
 taxaOcupacao: number;
}

export function PlannerStats({
 totalAgendamentos,
 agendamentosHoje,
 pacientesAtivos,
 taxaOcupacao,
}: PlannerStatsProps) {
 const stats = [
 { label: "Total de Agendamentos", value: totalAgendamentos, icon: CalendarCheck, color: "text-blue-600" },
 { label: "Agendamentos Hoje", value: agendamentosHoje, icon: Clock, color: "text-emerald-600" },
 { label: "Pacientes Ativos", value: pacientesAtivos, icon: Users, color: "text-violet-600" },
 { label: "Taxa de Ocupação", value: `${taxaOcupacao}%`, icon: TrendingUp, color: "text-amber-600" },
 ];

 return (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
 {stats.map(({ label, value, icon: Icon, color }) => (
 <Card key={label} className="p-4">
 <div className="flex items-center gap-3">
 <div className={`h-10 w-10 rounded-lg bg-muted flex items-center justify-center ${color}`}>
 <Icon className="h-5 w-5" />
 </div>
 <div>
 <p className="text-2xl font-bold">{value}</p>
 <p className="text-xs text-muted-foreground">{label}</p>
 </div>
 </div>
 </Card>
 ))}
 </div>
 );
}
