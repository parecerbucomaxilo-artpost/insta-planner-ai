import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedUserId } from "@/lib/auth-utils";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Instagram, Linkedin, KeyRound, ShieldCheck, Globe } from "lucide-react";
import { toast } from "sonner";

export function IntegrationsSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [id, setId] = useState<string | null>(null);

  const [bufferToken, setBufferToken] = useState("");

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
        setBufferToken(data.buffer_access_token || "");
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const uid = await getAuthedUserId();
      const payload = {
        user_id: uid,
        buffer_access_token: bufferToken.trim(),
      };

      let result;
      if (id) {
        result = await supabase.from("perfil_usuario").update(payload).eq("id", id).select().single();
      } else {
        result = await supabase.from("perfil_usuario").insert(payload).select().single();
      }

      if (result.error) throw result.error;
      
      if (result.data) {
        setId(result.data.id);
        toast.success("Configurações de integração salvas com sucesso!");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar integrações");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-8 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando integrações...
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" /> Integração com Buffer
        </h2>
        <p className="text-sm text-muted-foreground">
          Centralize suas postagens usando o Buffer. Obtenha seu Personal Access Token nas configurações de desenvolvedor do Buffer.
        </p>
      </div>

      <Card className="p-6 space-y-4 border-primary/20 bg-primary/5">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-lg bg-black flex items-center justify-center text-white">
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current">
              <path d="M22 7.5L12 12.5L2 7.5V16.5L12 21.5L22 16.5V7.5ZM12 2.5L22 7.5L12 12.5L2 7.5L12 2.5Z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold">Buffer API</h3>
            <p className="text-xs text-muted-foreground">
              <a 
                href="https://publish.buffer.com/preferences/apps/developer" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Clique aqui para gerar seu Token no Buffer
              </a>
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="buffer-token" className="text-sm font-medium flex items-center gap-1.5">
              <KeyRound className="h-4 w-4" /> Chave API Buffer (Access Token)
            </Label>
            <textarea
              id="buffer-token"
              value={bufferToken}
              onChange={(e) => setBufferToken(e.target.value)}
              placeholder="Cole aqui seu Personal Access Token do Buffer..."
              className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> Sua chave é salva de forma segura e usada apenas para postagens automáticas.
            </p>
          </div>
        </div>
      </Card>

      <Button onClick={handleSave} disabled={saving} size="lg" className="w-full">
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Salvar Configuração
      </Button>
    </div>
  );
}
