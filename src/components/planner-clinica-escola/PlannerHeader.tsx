import { CalendarCheck, ClipboardList, LineChart, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { uploadedImages } from "@/assets/uploadedImages";

const banner = uploadedImages["IMG_3896.jpeg"] || Object.values(uploadedImages)[0];

const RECURSOS = [
 {
 icone: ClipboardList,
 titulo: "Reserva em poucos cliques",
 texto: "Escolha o dia e o horário na grade e cadastre o paciente na hora.",
 },
 {
 icone: Users,
 titulo: "Atendimento supervisionado",
 texto: "Alunos conduzem cada etapa com acompanhamento de professores especialistas.",
 },
 {
 icone: LineChart,
 titulo: "Acompanhamento da semana",
 texto: "Painel com confirmados, pendências e cancelamentos por dia.",
 },
] as const;

export function PlannerHeader() {
 return (
 <Card className="overflow-hidden border-primary/20">
 {banner && <div
 className="relative h-28 sm:h-36 w-full planner-banner"
 style={{
 backgroundImage: `url(${banner})`,
 backgroundSize: "cover",
 backgroundPosition: "center",
 }}
 role="img"
 aria-label="Imagem de destaque do Planner Clínica Escola"
 >
 <div className="absolute inset-0 bg-background/30" aria-hidden="true" />
 <div className="absolute left-0 top-0 h-full w-1.5 bg-primary/70" aria-hidden="true" />
 </div>}

 <div className="p-5 border-t">
 <div className="min-w-0">
 <h2 className="text-lg font-bold flex items-center gap-2">
 <CalendarCheck className="h-5 w-5 text-primary" aria-hidden="true" />
 Planner Clínica Escola
 </h2>
 <p className="text-sm text-muted-foreground mt-0.5">
 Organize a agenda da clínica escola, registre cada paciente e acompanhe os atendimentos da semana.
 </p>
 </div>

 </div>

 <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-5 pb-5">
 {RECURSOS.map(({ icone: Icone, titulo, texto }) => (
 <li
 key={titulo}
 className="rounded-lg border bg-muted/40 p-3"
 >
 <div className="flex items-center gap-1.5 mb-1">
 <Icone className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
 <span className="text-xs font-semibold">{titulo}</span>
 </div>
 <p className="text-[11px] text-muted-foreground leading-relaxed">{texto}</p>
 </li>
 ))}
 </ul>
 </Card>
 );
}
