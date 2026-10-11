import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookingForm } from "@/components/planner-clinica-escola/BookingForm";
import type { Agendamento } from "@/integrations/supabase/types"n
interface BookingDialogProps {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 slotSelecionado: { dia: number; horario: string } | null;
 inicioSemana: Date;
 onSave: (agendamento: Omit<Agendamento, "id">) => void;
}

export function BookingDialog({
 open,
 onOpenChange,
 slotSelecionado,
 inicioSemana,
 onSave,
}: BookingDialogProps) {
 const [formData, setFormData] = useState({
 paciente: "",
 procedimento: "",
 telefone: "",
 data: "",
 horario: "",
 status: "pendente" as Agendamento["status"],
 });

 useEffect(() => {
 if (slotSelecionado) {
 const data = new Date(inicioSemana);
 data.setDate(inicioSemana.getDate() + slotSelecionado.dia);
 setFormData((prev) => ({ ...prev,
 data: data.toISOString().split("T")[0],
 horario: slotSelecionado.horario,
 }));
 }
 }, [slotSelecionado, inicioSemana]);

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 onSave(formData);
 setFormData({
 paciente: "",
 procedimento: "",
 telefone: "",
 data: "",
 horario: "",
 status: "pendente",
 });
 onOpenChange(false);
 };

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="max-w-md">
 <DialogHeader>
 <DialogTitle>Novo Agendamento</DialogTitle>
 </DialogHeader>
 <BookingForm formData={formData} onChange={setFormData} onSubmit={handleSubmit} />
 </DialogContent>
 </Dialog>
 );
}
