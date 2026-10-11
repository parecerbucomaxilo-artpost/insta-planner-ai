export interface Agendamento {
 id: string;
 paciente: string;
 procedimento: string;
 telefone: string;
 data: string;
 horario: string;
 status: "pendente" | "confirmado" | "cancelado";
 observacoes?: string;
}
