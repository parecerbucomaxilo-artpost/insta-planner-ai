import { useEffect, useState, type ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, User2, AtSign, X } from "lucide-react";
import { toast } from "sonner";

export type Perfil = {
  id: string;
  nome_profissional: string;
  arroba_usuario: string;
  url_logo: string | null;
};

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function ProfileSettings({ onSaved }: { onSaved?: (p: Perfil) => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [arroba, setArroba] = useState("");
  const [logo, setLogo] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("perfil_usuario")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data) {
        setId(data.id);
        setNome(data.nome_profissional ?? "");
        setArroba(data.arroba_usuario ?? "");
        setLogo(data.url_logo ?? null);
      }
      setLoading(false);
    })();
  }, []);

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      toast.error("Arquivo grande demais (máx 2MB)");
      e.target.value = "";
      return;
    }
    setLogo(await fileToDataUrl(f));
    e.target.value = "";
  };

  const handleSave = async () => {
    if (!nome.trim()) return toast.error("Informe o nome profissional");
    const arrobaClean = arroba.trim().replace(/^@+/, "");
    setSaving(true);
    const payload = {
      nome_profissional: nome.trim(),
      arroba_usuario: arrobaClean,
      url_logo: logo,
    };
    let result;
    if (id) {
      result = await supabase.from("perfil_usuario").update(payload).eq("id", id).select().single();
    } else {
      result = await supabase.from("perfil_usuario").insert(payload).select().single();
    }
    setSaving(false);
    if (result.error) return toast.error(result.error.message);
    if (result.data) {
      setId(result.data.id);
      toast.success("Perfil salvo!");
      onSaved?.(result.data as Perfil);
    }
  };

  if (loading) {
    return (
      <Card className="p-8 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando perfil...
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="p-6 space-y-6">
        <div>
          <h2 className="text-xl font-bold">Configurações do Perfil</h2>
          <p className="text-sm text-muted-foreground">
            Estes dados aparecem automaticamente nos posts em "Estilo X" e podem ser usados como marca d'água.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-1.5"><User2 className="h-3.5 w-3.5" /> Nome Profissional</Label>
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Dr. João Silva"
          />
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-1.5"><AtSign className="h-3.5 w-3.5" /> @ Arroba</Label>
          <Input
            value={arroba}
            onChange={(e) => setArroba(e.target.value)}
            placeholder="dr.bucomaxilo"
          />
          <p className="text-[11px] text-muted-foreground">O @ é adicionado automaticamente.</p>
        </div>

        <div className="space-y-2">
          <Label>Logo ou Foto de Perfil</Label>
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-full border-2 overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
              {logo ? (
                <img src={logo} alt="logo" className="h-full w-full object-cover" />
              ) : (
                <User2 className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 flex flex-col gap-2">
              <label className="flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed rounded-md cursor-pointer hover:bg-accent text-sm">
                <Upload className="h-4 w-4" />
                {logo ? "Trocar imagem" : "Enviar imagem"}
                <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              </label>
              {logo && (
                <Button variant="ghost" size="sm" onClick={() => setLogo(null)} className="text-destructive">
                  <X className="h-3.5 w-3.5 mr-1" /> Remover
                </Button>
              )}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">PNG/JPG até 2MB. Quadrada funciona melhor.</p>
        </div>

        <Button onClick={handleSave} disabled={saving} size="lg" className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Salvar Perfil
        </Button>
      </Card>
    </div>
  );
}
