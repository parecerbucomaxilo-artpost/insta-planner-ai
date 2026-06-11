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

  const [instaToken, setInstaToken] = useState("");
  const [instaId, setInstaId] = useState("");
  const [liToken, setLiToken] = useState("");
  const [liUrn, setLiUrn] = useState("");

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
        setInstaToken(data.instagram_access_token || "");
        setInstaId(data.instagram_business_account_id || "");
        setLiToken(data.linkedin_access_token || "");
        setLiUrn(data.linkedin_urn || "");
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
        instagram_access_token: instaToken.trim(),
        instagram_business_account_id: instaId.trim(),
        linkedin_access_token: liToken.trim(),
        linkedin_urn: liUrn.trim(),
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
          <Globe className="h-5 w-5 text-primary" /> Integrações Diretas
        </h2>
        <p className="text-sm text-muted-foreground">
          Configure seus tokens de acesso para postar diretamente nas redes sociais sem intermediários.
        </p>
      </div>

      <Card className="p-5 space-y-4 border-pink-200 bg-pink-50/10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center text-white">
            <Instagram className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold">Instagram Business API</h3>
            <p className="text-xs text-muted-foreground">Requer conta Business vinculada a uma Página do Facebook.</p>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="insta-id" className="text-xs flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5" /> Instagram Business Account ID
            </Label>
            <Input
              id="insta-id"
              value={instaId}
              onChange={(e) => setInstaId(e.target.value)}
              placeholder="Ex: 178414012345678"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="insta-token" className="text-xs flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Access Token (User Token)
            </Label>
            <Input
              id="insta-token"
              type="password"
              value={instaToken}
              onChange={(e) => setInstaToken(e.target.value)}
              placeholder="EAABw..."
            />
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-4 border-blue-200 bg-blue-50/10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-sky-600 to-blue-700 flex items-center justify-center text-white">
            <Linkedin className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold">LinkedIn API</h3>
            <p className="text-xs text-muted-foreground">Tokens da API v2 / Posts API.</p>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="li-urn" className="text-xs flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5" /> Member URN (author)
            </Label>
            <Input
              id="li-urn"
              value={liUrn}
              onChange={(e) => setLiUrn(e.target.value)}
              placeholder="Ex: urn:li:person:AbCd123"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="li-token" className="text-xs flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Access Token (Bearer)
            </Label>
            <Input
              id="li-token"
              type="password"
              value={liToken}
              onChange={(e) => setLiToken(e.target.value)}
              placeholder="AQV..."
            />
          </div>
        </div>
      </Card>

      <Button onClick={handleSave} disabled={saving} size="lg" className="w-full">
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Salvar Integrações
      </Button>
    </div>
  );
}
