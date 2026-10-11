import { CalendarCheck, Stethoscope } from "lucide-react";
import { Card } from "@/components/ui/card";

export function PlannerHeader() {
 return (
 <Card className="p-5 flex items-center gap-4">
 <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
 <Stethoscope className="h-6 w-6 text-primary" />
 </div>
 <div>
 <h2 className="text-lg font-bold flex items-center gap-2">
 <CalendarCheck className="h-5 w-5 text-primary" />
 Planner Clínica Escola
 </h2>
 <p className="text-sm text-muted-foreground">
 Planeje agendamentos, acompanhe estatísticas e gerencie a semana da clínica escola.
 </p>
 </div>
 </Card>
 );
}
