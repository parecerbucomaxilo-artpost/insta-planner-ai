import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { SchedulerTable } from "@/components/planner-clinica-escola/SchedulerTable";
import { BookingDialog } from "@/components/planner-clinica-escola/BookingDialog";
import type { Agendamento } from "@/components/planner-clinica-escola/types";

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;
const HORARIOS = ["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"] as const;

interface WeeklySchedulerProps {
 agendamentos: Agendamento[];
 onAdd: (agendamento: Omit<Agendamento, "id">) => void;
 onRemove: (id: string) => void;
}

export function WeeklyScheduler({ agendamentos, onAdd, onRemove }: WeeklySchedulerProps) {
 const [semanaOffset, setSemanaOffset] = useState(0);
 const [dialogOpen, setDialogOpen] = useState(false);
 const [slotSelecionado, setSlotSelecionado] = useState<{ dia: number; horario: string } | null>(null);

 const hoje = new Date();
 const inicioSemana = new Date(hoje);
 inicioSemana.setDate(hoje.getDate() - hoje.getDay() + semanaOffset * 7);

 const getAgendamentosDoDia = (dia: number) => {
 const dataAlvo = new Date(inicioSemana);
 dataAlvo.setDate(inicioSemana.getDate() + dia);
 const dataStr = dataAlvo.toISOString().split("T")[0];
 return agendamentos.filter((a) => a.data === dataStr);
 };

 const handleCellClick = (dia: number, horario: string) => {
 setSlotSelecionado({ dia, horario });
 setDialogOpen(true);
 };

 return (
 <Card className="p-5 space-y-4">
 <div className="flex items-center justify-between">
 <h3 className="font-bold text-lg">Agendamento Semanal</h3>
 <div className="flex items-center gap-2">
 <Button variant="outline" size="icon" onClick={() => setSemanaOffset((s) => s - 1)}>
 <ChevronLeft className="h-4 w-4" />
 </Button>
 <span className="text-sm font-medium min-w-[120px] text-center">
 Semana atual
 </span>
 <Button variant="outline" size="icon" onClick={() => setSemanaOffset((s) => s + 1)}>
 <ChevronRight className="h-4 w-4" />
 </Button>
 </div>
 </div>

 <SchedulerTable
 dias={DIAS}
 horarios={HORARIOS}
 agendamentosPorDia={DIAS.map((_, i) => getAgendamentosDoDia(i))}
 onCellClick={handleCellClick}
 onRemove={onRemove}
 />

 <Button onClick={() => setDialogOpen(true)} className="w-full">
 <Plus className="h-4 w-4 mr-2" />
 Novo Agendamento
 </Button>

 <BookingDialog
 open={dialogOpen}
 onOpenChange={setDialogOpen}
 slotSelecionado={slotSelecionado}
 inicioSemana={inicioSemana}
 onSave={onAdd}
 />
 </Card>
 );
}
