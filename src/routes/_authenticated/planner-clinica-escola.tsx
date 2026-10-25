import { createFileRoute } from "@tanstack/react-router";
import { PlannerClinicaEscola } from "@/components/planner-clinica-escola";

export const Route = createFileRoute("/_authenticated/planner-clinica-escola")({
 head: () => ({
 meta: [
 { title: "Planner Clínica Escola — Planner Chico" },
 { property: "og:title", content: "Planner Clínica Escola — Planner Chico" },
 { property: "og:description", content: "Calendário de agendamentos e reservas da Clínica Escola." },
 { property: "og:type", content: "website" },
 { name: "twitter:card", content: "summary" },
 { name: "description", content: "Planeje agendamentos da Clínica Escola com calendário semanal, estatísticas e formulários de reserva." },
 ],
 }),
 component: PlannerClinicaEscola,
});
