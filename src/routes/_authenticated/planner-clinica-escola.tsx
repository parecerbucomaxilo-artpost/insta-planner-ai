import { createFileRoute } from "@tanstack/react-router";
import { PlannerClinicaEscola } from "@/components/planner-clinica-escola";

export const Route = createFileRoute("/_authenticated/planner-clinica-escola")({
 head: () => ({
 meta: [
 { title: "Planner Clínica Escola — Planner Chico" },
 { name: "description", content: "Planeje agendamentos da Clínica Escola com calendário semanal, estatísticas e formulários de reserva." },
 ],
 }),
 component: PlannerClinicaEscola,
});
