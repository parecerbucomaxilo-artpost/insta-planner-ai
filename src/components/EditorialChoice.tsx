import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { TIPOS_EDITORIAIS, type TipoEditorial } from "@/lib/editorial-choice";

let escolha: TipoEditorial = "Aleatória(s)";
const EVENTO = "planner-editorial-choice";
export function useTipoEditorial() {
  const [tipo, setTipo] = useState<TipoEditorial>(escolha);
  useEffect(() => {
    const update = () => setTipo(escolha);
    window.addEventListener(EVENTO, update);
    return () => window.removeEventListener(EVENTO, update);
  }, []);
  return tipo;
}
export function EditorialChoice() {
  const tipo = useTipoEditorial();
  const [open, setOpen] = useState(false);
  return <div className="relative my-3" onKeyDown={e => { if (e.key === "Escape") setOpen(false); }}>
    <Button variant="outline" aria-expanded={open} aria-controls="tipos-editoriais" onClick={() => setOpen(!open)}>Tipo de postagem: {tipo}<ChevronDown className="ml-2 h-4 w-4" /></Button>
    {open && <div id="tipos-editoriais" className="mt-2 flex flex-wrap gap-2">
      {TIPOS_EDITORIAIS.map(t => <Button key={t} variant={tipo === t ? "secondary" : "outline"} aria-pressed={tipo === t} onClick={() => { escolha = t; window.dispatchEvent(new Event(EVENTO)); setOpen(false); }}>{t}</Button>)}
    </div>}
  </div>;
}