export { PlannerHeader } from "@/components/planner-clinica-escola/PlannerHeader";
export { PlannerStats } from "@/components/planner-clinica-escola/PlannerStats";
export { WeeklyScheduler } from "@/components/planner-clinica-escola/WeeklyScheduler";
export { SchedulerTable } from "@/components/planner-clinica-escola/SchedulerTable";
export { SchedulerCell } from "@/components/planner-clinica-escola/SchedulerCell";
export { BookingDialog } from "@/components/planner-clinica-escola/BookingDialog";
export { BookingForm } from "@/components/planner-clinica-escola/BookingForm";
export { StatusBadge } from "@/components/planner-clinica-escola/StatusBadge";
export { EmptyState } from "@/components/planner-clinica-escola/EmptyState";
export type { Agendamento } from "@/integrations/supabase/types";

import { useState, useCallback } from "react";
import { PlannerHeader } from "@/components/planner-clinica-escola/PlannerHeader";
import { PlannerStats } from "@/components/planner-clinica-escola/PlannerStats";
import { WeeklyScheduler } from "@/components/planner-clinica-escola/WeeklyScheduler";
import { EmptyState } from "@/components/planner-clinica-escola/EmptyState";
import type { Agendamento } from "@/integrations/supabase/types";

const STORAGE_KEY = "planner_clinica_escola_agendamentos_v1";

function loadAgendamentos(): Agendamento[] {
 if (typeof window === "undefined") return [];
 try {
 const raw = window.localStorage.getItem(STORAGE_KEY);
 return raw? (JSON.parse(raw) as Agendamento[]): [];
 } catch {
 return [];
 }
}

function saveAgendamentos(agendamentos: Agendamento[]) {
 if (typeof window === "undefined") return;
 try {
 window.localStorage.setItem(STORAGE_KEY, JSON.stringify(agendamentos));
 } catch {
 /* ignore */
 }
}

export function PlannerClinicaEscola() {
 const [agendamentos, setAgendamentos] = useState<Agendamento[]>(loadAgendamentos);

 const handleAdd = useCallback((novo: Omit<Agendamento, "id">) => {
 const agendamento: Agendamento = { ...novo,
 id: crypto.randomUUID(),
 };
 setAgendamentos((prev) => {
 const next = [ ...prev, agendamento];
 saveAgendamentos(next);
 return next;
 });
 }, []);

 const handleRemove = useCallback((id: string) => {
 setAgendamentos((prev) => {
 const next = prev.filter((a) => a.id!== id);
 saveAgendamentos(next);
 return next;
 });
 }, []);

 const hoje = new Date().toISOString().split("T")[0];
 const agendamentosHoje = agendamentos.filter((a) => a.data === hoje).length;
 const pacientesAtivos = new Set(agendamentos.map((a) => a.paciente)).size;
 const taxaOcupacao = agendamentos.length > 0
? Math.round((agendamentos.filter((a) => a.status === "confirmado").length / agendamentos.length) * 100)
: 0;

 return (
 <div className="max-w-6xl mx-auto space-y-6">
 <PlannerHeader />
 <PlannerStats
 totalAgendamentos={agendamentos.length}
 agendamentosHoje={agendamentosHoje}
 pacientesAtivos={pacientesAtivos}
 taxaOcupacao={taxaOcupacao}
 />
 {agendamentos.length === 0? (
 <EmptyState />
 ): (
 <WeeklyScheduler
 agendamentos={agendamentos}
 onAdd={handleAdd}
 onRemove={handleRemove}
 />
 )}
 </div>
 );
}
