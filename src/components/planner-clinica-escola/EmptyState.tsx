import { CalendarCheck } from "lucide-react";

export function EmptyState() {
 return (
 <div className="flex flex-col items-center justify-center py-12 text-center">
 <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
 <CalendarCheck className="h-8 w-8 text-muted-foreground" />
 </div>
 <h3 className="text-lg font-semibold mb-1">Nenhum agendamento</h3>
 <p className="text-sm text-muted-foreground max-w-sm">
 Comece adicionando um novo agendamento clicando no botão abaixo ou em um horário disponível na grade.
 </p>
 </div>
 );
}
