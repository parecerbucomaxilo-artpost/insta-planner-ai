import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Agendamento } from "@/integrations/supabase/types"n
interface BookingFormProps {
 formData: Omit<Agendamento, "id">;
 onChange: (data: Omit<Agendamento, "id">) => void;
 onSubmit: (e: React.FormEvent) => void;
}

export function BookingForm({ formData, onChange, onSubmit }: BookingFormProps) {
 const handleChange = (field: keyof Omit<Agendamento, "id">, value: string) => {
 onChange({ ...formData, [field]: value });
 };

 return (
 <form onSubmit={onSubmit} className="space-y-4">
 <div className="space-y-2">
 <Label htmlFor="paciente">Paciente</Label>
 <Input
 id="paciente"
 value={formData.paciente}
 onChange={(e) => handleChange("paciente", e.target.value)}
 placeholder="Nome do paciente"
 required
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="procedimento">Procedimento</Label>
 <Input
 id="procedimento"
 value={formData.procedimento}
 onChange={(e) => handleChange("procedimento", e.target.value)}
 placeholder="Ex: Biópsia, Extração de siso"
 required
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="telefone">Telefone</Label>
 <Input
 id="telefone"
 value={formData.telefone}
 onChange={(e) => handleChange("telefone", e.target.value)}
 placeholder="(19) 99999-9999"
 required
 />
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="data">Data</Label>
 <Input
 id="data"
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
 type="time"
 value={formData.horario}
 onChange={(e) => handleChange("horario", e.target.value)}
 required
 />
 </div>
 </div>

 <div className="space-y-2">
 <Label>Status</Label>
 <Select
 value={formData.status}
 onValueChange={(v) => handleChange("status", v)}
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="pendente">Pendente</SelectItem>
 <SelectItem value="confirmado">Confirmado</SelectItem>
 <SelectItem value="cancelado">Cancelado</SelectItem>
 </SelectContent>
 </Select>
 </div>

 <div className="flex justify-end gap-2 pt-4">
 <Button type="submit">Salvar Agendamento</Button>
 </div>
 </form>
 );
}
