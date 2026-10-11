import { SchedulerCell } from "@/components/planner-clinica-escola/SchedulerCell";
import type { Agendamento } from "@/integrations/supabase/types";

interface SchedulerTableProps {
 dias: readonly string[];
 horarios: readonly string[];
 agendamentosPorDia: Agendamento[][];
 onCellClick: (dia: number, horario: string) => void;
 onRemove: (id: string) => void;
}

export function SchedulerTable({
 dias,
 horarios,
 agendamentosPorDia,
 onCellClick,
 onRemove,
}: SchedulerTableProps) {
 return (
 <div className="overflow-x-auto rounded-lg border">
 <table className="w-full border-collapse text-sm">
 <caption className="sr-only">Grade semanal de horários da clínica escola</caption>
 <thead>
 <tr className="bg-muted/50">
 <th scope="col" className="p-2 text-xs font-semibold text-muted-foreground border-b text-left">
 Horário
 </th>
 {dias.map((dia, idx) => (
 <th key={`${dia}-${idx}`} scope="col" className="p-2 text-xs font-semibold text-muted-foreground border-b text-center">
 {dia}
 </th>
 ))}
 </tr>
 </thead>
 <tbody>
 {horarios.map((horario) => (
 <tr key={horario} className="odd:bg-background even:bg-muted/20">
 <th scope="row" className="p-2 text-xs font-semibold text-muted-foreground border-b whitespace-nowrap text-left">
 {horario}
 </th>
 {dias.map((_, diaIdx) => {
 const agendamentos = agendamentosPorDia[diaIdx] || [];
 const agendamento = agendamentos.find((a) => a.horario === horario);
 return (
 <td key={`${diaIdx}-${horario}`} className="p-1 border-b">
 <SchedulerCell
 agendamento={agendamento}
 dia={dias[diaIdx]}
 horario={horario}
 onClick={() => onCellClick(diaIdx, horario)}
 onRemove={onRemove}
 />
 </td>
 );
 })}
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 );
}
