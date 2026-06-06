import { useEffect, useState, type ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, User2, AtSign, X, Instagram, Linkedin, Twitter } from "lucide-react";
import { toast } from "sonner";

export type Perfil = {
  id: string;
  nome_profissional: string;
  arroba_usuario: string;
  url_logo: string | null;
  instagram_arroba: string;
  instagram_foto_url: string | null;
  linkedin_nome: string;
  linkedin_foto_url: string | null;
  x_arroba: string;
  x_foto_url: string | null;
};

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

type NetSectionProps = {
  title: string;
  Icon: typeof Instagram;
  gradient: string;
  nameLabel: string;
  namePlaceholder: string;
  nameValue: string;
  onNameChange: (v: string) => void;
  nameIsHandle?: boolean;
  photo: string | null;
  onPhoto: (v: string | null) => void;
  description?: string;
};

function NetworkSection({
  title, Icon, gradient, nameLabel, namePlaceholder, nameValue, onNameChange,
  nameIsHandle, photo, onPhoto, description,
}: NetSectionProps) {
  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      toast.error("Arquivo grande demais (máx 2MB)");
      e.target.value = "";
      return;
    }
    onPhoto(await fileToDataUrl(f));
    e.target.value = "";
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center text-white`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold leading-tight">{title}</h3>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-1.5 text-sm">
          {nameIsHandle ? <AtSign className="h-3.5 w-3.5" /> : <User2 className="h-3.5 w-3.5" />}
          {nameLabel}
        </Label>
        <Input value={nameValue} onChange={(e) => onNameChange(e.target.value)} placeholder={namePlaceholder} />
        {nameIsHandle && <p className="text-[11px] text-muted-foreground">O @ é adicionado automaticamente.</p>}
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Foto / Logo</Label>
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full border-2 overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
            {photo ? (
              <img src={photo} alt="" className="h-full w-full object-cover" />
            ) : (
              <Icon className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 flex flex-col gap-2">
            <label className="flex items-center justify-center gap-2 px-3 py-1.5 border-2 border-dashed rounded-md cursor-pointer hover:bg-accent text-xs">
              <Upload className="h-3.5 w-3.5" />
              {photo ? "Trocar imagem" : "Enviar imagem"}
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            </label>
            {photo && (
              <Button variant="ghost" size="sm" onClick={() => onPhoto(null)} className="text-destructive h-7">
                <X className="h-3.5 w-3.5 mr-1" /> Remover
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function ProfileSettings({ onSaved }: { onSaved?: (p: Perfil) => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [id, setId] = useState<string | null>(null);

  const [igArroba, setIgArroba] = useState("");
  const [igFoto, setIgFoto] = useState<string | null>(null);
  const [liNome, setLiNome] = useState("");
  const [liFoto, setLiFoto] = useState<string | null>(null);
  const [xArroba, setXArroba] = useState("");
  const [xFoto, setXFoto] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("perfil_usuario")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data) {
        const d = data as unknown as Perfil & { arroba_usuario?: string; nome_profissional?: string; url_logo?: string | null };
        setId(d.id);
        setIgArroba(d.instagram_arroba ?? d.arroba_usuario ?? "");
        setIgFoto(d.instagram_foto_url ?? d.url_logo ?? null);
        setLiNome(d.linkedin_nome ?? d.nome_profissional ?? "");
        setLiFoto(d.linkedin_foto_url ?? d.url_logo ?? null);
        setXArroba(d.x_arroba ?? d.arroba_usuario ?? "");
        setXFoto(d.x_foto_url ?? d.url_logo ?? null);
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    const ig = igArroba.trim().replace(/^@+/, "");
    const xa = xArroba.trim().replace(/^@+/, "");
    if (!liNome.trim() && !ig && !xa) {
      return toast.error("Preencha ao menos uma rede");
    }
    setSaving(true);
    const payload = {
      // legados — mantidos sincronizados para retrocompatibilidade
      nome_profissional: liNome.trim() || ig || xa,
      arroba_usuario: ig || xa,
      url_logo: igFoto ?? liFoto ?? xFoto,
      // novos por rede
      instagram_arroba: ig,
      instagram_foto_url: igFoto,
      linkedin_nome: liNome.trim(),
      linkedin_foto_url: liFoto,
      x_arroba: xa,
      x_foto_url: xFoto,
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
      onSaved?.(result.data as unknown as Perfil);
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
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold">Configurações do Perfil</h2>
        <p className="text-sm text-muted-foreground">
          Configure foto e identidade para cada rede social. Esses dados alimentam as prévias e a marca d'água.
        </p>
      </div>

      <NetworkSection
        title="Instagram"
        Icon={Instagram}
        gradient="from-pink-500 via-rose-500 to-orange-400"
        nameLabel="@ do Instagram"
        namePlaceholder="dr.bucomaxilo"
        nameValue={igArroba}
        onNameChange={setIgArroba}
        nameIsHandle
        photo={igFoto}
        onPhoto={setIgFoto}
        description="Foto de perfil pública e @ usado na bio."
      />

      <NetworkSection
        title="LinkedIn"
        Icon={Linkedin}
        gradient="from-sky-600 to-blue-700"
        nameLabel="Nome Profissional Oficial"
        namePlaceholder="Dr. João Silva, CD, MSc"
        nameValue={liNome}
        onNameChange={setLiNome}
        photo={liFoto}
        onPhoto={setLiFoto}
        description="Use foto formal/corporativa e seu nome completo com títulos."
      />

      <NetworkSection
        title="X (Twitter)"
        Icon={Twitter}
        gradient="from-neutral-700 to-black"
        nameLabel="@ do X"
        namePlaceholder="dr_bucomax"
        nameValue={xArroba}
        onNameChange={setXArroba}
        nameIsHandle
        photo={xFoto}
        onPhoto={setXFoto}
        description="Avatar e @ exibidos no template do tweet."
      />

      <Button onClick={handleSave} disabled={saving} size="lg" className="w-full">
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Salvar Perfil
      </Button>
    </div>
  );
}
