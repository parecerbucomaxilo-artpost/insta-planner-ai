import { useEffect, useState, type ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Upload, User2, AtSign, X, Instagram, Linkedin, Stethoscope, Sparkles, Plus, BadgeCheck } from "lucide-react";
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
  cro_uf: string;
  subespecialidades: string[];
  tom_voz: "Científico" | "Humanizado" | "Editorial";
};

const SUGGESTED_SUBS = [
  "Ortognática",
  "DTM / ATM",
  "Implantes Zigomáticos",
  "Trauma Facial",
  "Patologia Bucal",
  "Oncologia CP",
  "Reconstrução Maxilofacial",
  "Implantes Convencionais",
  "Dentes Inclusos",
  "Cirurgia Hospitalar",
];

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

  const [nome, setNome] = useState("");
  const [croUf, setCroUf] = useState("");
  const [subs, setSubs] = useState<string[]>([]);
  const [novaSub, setNovaSub] = useState("");
  const [tomVoz, setTomVoz] = useState<"Científico" | "Humanizado" | "Editorial">("Científico");

  const [igArroba, setIgArroba] = useState("");
  const [igFoto, setIgFoto] = useState<string | null>(null);
  const [liNome, setLiNome] = useState("");
  const [liFoto, setLiFoto] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("perfil_usuario")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data) {
        const d = data as unknown as Partial<Perfil>;
        setId(d.id ?? null);
        setNome(d.nome_profissional ?? "");
        setCroUf(d.cro_uf ?? "");
        setSubs(Array.isArray(d.subespecialidades) ? d.subespecialidades : []);
        setTomVoz((d.tom_voz as Perfil["tom_voz"]) || "Científico");
        setIgArroba(d.instagram_arroba ?? d.arroba_usuario ?? "");
        setIgFoto(d.instagram_foto_url ?? d.url_logo ?? null);
        setLiNome(d.linkedin_nome ?? d.nome_profissional ?? "");
        setLiFoto(d.linkedin_foto_url ?? d.url_logo ?? null);
      }
      setLoading(false);
    })();
  }, []);

  const toggleSub = (s: string) =>
    setSubs((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const addSub = () => {
    const v = novaSub.trim();
    if (!v) return;
    if (subs.includes(v)) return;
    setSubs((p) => [...p, v]);
    setNovaSub("");
  };

  const handleSave = async () => {
    const ig = igArroba.trim().replace(/^@+/, "");
    if (!nome.trim() && !liNome.trim() && !ig) {
      return toast.error("Preencha ao menos o nome profissional ou uma rede");
    }
    setSaving(true);
    const payload = {
      nome_profissional: nome.trim() || liNome.trim() || ig,
      arroba_usuario: ig,
      url_logo: igFoto ?? liFoto,
      instagram_arroba: ig,
      instagram_foto_url: igFoto,
      linkedin_nome: liNome.trim(),
      linkedin_foto_url: liFoto,
      cro_uf: croUf.trim(),
      subespecialidades: subs,
      tom_voz: tomVoz,
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
      toast.success("Perfil do especialista salvo. A IA usará esses dados nas próximas gerações.");
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
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-primary" /> Perfil do Especialista
        </h2>
        <p className="text-sm text-muted-foreground">
          Memória da IA. Esses dados são lidos antes de cada geração — o Claude adapta o texto e a marca d'água assina sua imagem.
        </p>
      </div>

      {/* MEMÓRIA DA IA */}
      <Card className="p-5 space-y-5 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <Label className="text-sm font-semibold">Identidade Profissional</Label>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="nome-prof" className="text-xs flex items-center gap-1.5">
              <User2 className="h-3.5 w-3.5" /> Nome do Profissional
            </Label>
            <Input
              id="nome-prof"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Dr. João Silva"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cro" className="text-xs flex items-center gap-1.5">
              <BadgeCheck className="h-3.5 w-3.5" /> CRO/UF
            </Label>
            <Input
              id="cro"
              value={croUf}
              onChange={(e) => setCroUf(e.target.value)}
              placeholder="12345/SP"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Subespecialidades principais</Label>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_SUBS.map((s) => {
              const on = subs.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSub(s)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                    on
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border hover:border-primary/40"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
          {subs.filter((s) => !SUGGESTED_SUBS.includes(s)).length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {subs
                .filter((s) => !SUGGESTED_SUBS.includes(s))
                .map((s) => (
                  <Badge key={s} variant="secondary" className="gap-1">
                    {s}
                    <button type="button" onClick={() => toggleSub(s)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <Input
              value={novaSub}
              onChange={(e) => setNovaSub(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSub())}
              placeholder="Adicionar outra subespecialidade…"
              className="h-9 text-sm"
            />
            <Button type="button" variant="outline" onClick={addSub} className="h-9">
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Tom de voz preferido</Label>
          <RadioGroup
            value={tomVoz}
            onValueChange={(v) => setTomVoz(v as typeof tomVoz)}
            className="grid grid-cols-3 gap-2"
          >
            {([
              { v: "Científico", d: "Baseado em evidência, técnico" },
              { v: "Humanizado", d: "Acolhedor, próximo do paciente" },
              { v: "Editorial", d: "Sofisticado, revista de luxo" },
            ] as const).map((opt) => {
              const on = tomVoz === opt.v;
              return (
                <label
                  key={opt.v}
                  className={`flex flex-col gap-1 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    on ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value={opt.v} id={`tom-${opt.v}`} />
                    <span className="text-sm font-medium">{opt.v}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground leading-snug pl-6">{opt.d}</span>
                </label>
              );
            })}
          </RadioGroup>
        </div>
      </Card>

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

      <Button onClick={handleSave} disabled={saving} size="lg" className="w-full">
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Salvar Perfil do Especialista
      </Button>
    </div>
  );
}
