import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Agendamento } from "@/integrations/supabase/types";

type Campos = Omit<Agendamento, "id">;

interface BookingFormProps {
 formData: Campos;
 onChange: (data: Campos) => void;
 onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export function BookingForm({ formData, onChange, onSubmit }: BookingFormProps) {
 const handleChange = <K extends keyof Campos>(field: K, value: Campos[K]) => {
 onChange({ ...formData, [field]: value });
 };

 return (
 <form onSubmit={onSubmit} className="space-y-4">
 <fieldset className="space-y-4">
 <legend className="sr-only">Dados do agendamento</legend>

 <div className="space-y-2">
 <Label htmlFor="paciente">Paciente</Label>
 <Input
 id="paciente"
 name="paciente"
 value={formData.paciente}
 onChange={(e) => handleChange("paciente", e.target.value)}
 placeholder="Nome completo do paciente"
 autoComplete="name"
 required
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="procedimento">Procedimento</Label>
 <Input
 id="procedimento"
 name="procedimento"
 value={formData.procedimento}
 onChange={(e) => handleChange("procedimento", e.target.value)}
 placeholder="Ex.: biópsia ou extração de siso"
 required
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="telefone">Telefone</Label>
 <Input
 id="telefone"
 name="telefone"
 type="tel"
 inputMode="tel"
 value={formData.telefone}
 onChange={(e) => handleChange("telefone", e.target.value)}
 placeholder="(19) 99999-9999"
 autoComplete="tel"
 required
 />
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="data">Data</Label>
 <Input
 id="data"
 name="data"
 type="date"
 value={formData.data}
 onChange={(e) => handleChange("data", e.target.value)}
 required
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="horario">Horário</Label>
 <Input
 id="horario"
 name="horario"
 type="time"
 value={formData.horario}
 onChange={(e) => handleChange("horario", e.target.value)}
 required
 />
 </div>
 </div>

 <div className="space-y-2">
 <Label htmlFor="status">Situação</Label>
 <Select
 value={formData.status}
 onValueChange={(v) => handleChange("status", v)}
 >
 <SelectTrigger id="status" aria-label="Selecionar a situação do agendamento">
 <SelectValue placeholder="Selecione" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="pendente">Pendente</SelectItem>
 <SelectItem value="confirmado">Confirmado</SelectItem>
 <SelectItem value="cancelado">Cancelado</SelectItem>
 </SelectContent>
 </Select>
 <p className="text-[11px] text-muted-foreground">
 Pendente: aguardando retorno do paciente. Confirmado: horário garantido.
 </p>
 </div>

 <div className="space-y-2">
 <Label htmlFor="observacoes">Observações</Label>
 <Textarea
 id="observacoes"
 name="observacoes"
 value={formData.observacoes?? ""}
 onChange={(e) => handleChange("observacoes", e.target.value)}
 placeholder="Anamnese, encaminhamento ou combinados com o paciente."
 rows={3}
 className="text-sm"
 />
 </div>
 </fieldset>

 <div className="flex justify-end gap-2 pt-2">
 <Button type="submit">Salvar agendamento</Button>
 </div>
 </form>
 );
}
