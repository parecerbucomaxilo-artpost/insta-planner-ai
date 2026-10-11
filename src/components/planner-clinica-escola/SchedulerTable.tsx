import { SchedulerCell } from "@/components/planner-clinica-escola/SchedulerCell";
import type { Agendamento } from "@/integrations/supabase/types"n
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
 <div className="overflow-x-auto">
 <table className="w-full border-collapse">
 <thead>
 <tr>
 <th className="p-2 text-xs font-medium text-muted-foreground border">Horário</th>
 {dias.map((dia) => (
 <th key={dia} className="p-2 text-xs font-medium text-muted-foreground border">
 {dia}
 </th>
 ))}
 </tr>
 </thead>
 <tbody>
 {horarios.map((horario) => (
 <tr key={horario}>
 <td className="p-2 text-xs font-medium text-muted-foreground border whitespace-nowrap">
 {horario}
 </td>
 {dias.map((_, diaIdx) => {
 const agendamentos = agendamentosPorDia[diaIdx] || [];
 const agendamento = agendamentos.find((a) => a.horario === horario);
 return (
 <td key={`${diaIdx}-${horario}`} className="p-1 border">
 <SchedulerCell
 agendamento={agendamento}
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
