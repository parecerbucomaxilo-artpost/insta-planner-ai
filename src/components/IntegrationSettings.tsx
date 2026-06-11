import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Instagram, Linkedin, Save, Loader2, KeyRound, ShieldCheck, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedUserId } from "@/lib/auth-utils";

export function IntegrationSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [perfilId, setPerfilId] = useState<string | null>(null);

  // Instagram
  const [igToken, setIgToken] = useState("");
  const [igId, setIgId] = useState("");

  // LinkedIn
  const [liToken, setLiToken] = useState("");

  // Buffer
  const [bufferToken, setBufferToken] = useState("");

  useEffect(() => {
    async function loadSettings() {
      try {
        const { data } = await supabase
          .from("perfil_usuario")
          .select("id, instagram_access_token, instagram_business_account_id, linkedin_access_token, buffer_access_token")
          .limit(1)
          .maybeSingle();

        if (data) {
          setPerfilId(data.id);
          setIgToken(data.instagram_access_token || "");
          setIgId(data.instagram_business_account_id || "");
          setLiToken(data.linkedin_access_token || "");
          setBufferToken(data.buffer_access_token || "");
        }
      } catch (err) {
        console.error("Erro ao carregar configurações:", err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const userId = await getAuthedUserId();
      const payload = {
        user_id: userId,
        instagram_access_token: igToken.trim(),
        instagram_business_account_id: igId.trim(),
        linkedin_access_token: liToken.trim(),
        buffer_access_token: bufferToken.trim(),
      };

      if (perfilId) {
        const { error } = await supabase
          .from("perfil_usuario")
          .update(payload)
          .eq("id", perfilId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("perfil_usuario")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        setPerfilId(data.id);
      }

      toast.success("Configurações de integração salvas com sucesso!");
    } catch (err) {
      toast.error("Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" /> Integrações Diretas
        </h2>
        <p className="text-sm text-muted-foreground">
          Configure as chaves de acesso para postagem direta sem depender de ferramentas externas como Make ou Albato.
        </p>
      </div>

      {/* Instagram Graph API */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-pink-500 via-rose-500 to-orange-400 flex items-center justify-center text-white">
              <Instagram className="h-6 w-6" />
            </div>
            <div>
              <CardTitle>Instagram Graph API</CardTitle>
              <CardDescription>Requer uma conta Business vinculada a uma Página do Facebook.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ig-token">User Access Token (Long-Lived)</Label>
            <Input
              id="ig-token"
              type="password"
              value={igToken}
              onChange={(e) => setIgToken(e.target.value)}
              placeholder="EAAB..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ig-id">Instagram Business Account ID</Label>
            <Input
              id="ig-id"
              value={igId}
              onChange={(e) => setIgId(e.target.value)}
              placeholder="1784..."
            />
          </div>
          <div className="flex justify-end">
            <Button asChild variant="link" size="sm" className="h-auto p-0">
              <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer" className="flex items-center gap-1">
                Graph API Explorer <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* LinkedIn API */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-sky-600 to-blue-700 flex items-center justify-center text-white">
              <Linkedin className="h-6 w-6" />
            </div>
            <div>
              <CardTitle>LinkedIn API</CardTitle>
              <CardDescription>Token de acesso para postagem direta (w_member_social).</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="li-token">LinkedIn Access Token</Label>
            <Input
              id="li-token"
              type="password"
              value={liToken}
              onChange={(e) => setLiToken(e.target.value)}
              placeholder="AQU..."
            />
          </div>
          <p className="text-xs text-muted-foreground italic">
            Nota: Se você já conectou via Lovable Cloud, o token é gerenciado automaticamente. Este campo é para tokens manuais/customizados.
          </p>
        </CardContent>
      </Card>
      
      {/* Buffer API */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#2c3e50] flex items-center justify-center text-white">
              <KeyRound className="h-6 w-6" />
            </div>
            <div>
              <CardTitle>Buffer API</CardTitle>
              <CardDescription>Configure sua Personal Access Token do Buffer.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="buffer-token">Chave API Buffer (Personal Access Token)</Label>
            <Input
              id="buffer-token"
              type="password"
              value={bufferToken}
              onChange={(e) => setBufferToken(e.target.value)}
              placeholder="buf-..."
            />
          </div>
          <div className="flex justify-end">
            <Button asChild variant="link" size="sm" className="h-auto p-0">
              <a href="https://publish.buffer.com/profile/settings/apps-and-extras" target="_blank" rel="noreferrer" className="flex items-center gap-1">
                Obter Token no Buffer <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Buffer API */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#2c3e50] flex items-center justify-center text-white">
              <KeyRound className="h-6 w-6" />
            </div>
            <div>
              <CardTitle>Buffer API</CardTitle>
              <CardDescription>Configure sua Personal Access Token do Buffer.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="buffer-token">Chave API Buffer (Personal Access Token)</Label>
            <Input
              id="buffer-token"
              type="password"
              value={bufferToken}
              onChange={(e) => setBufferToken(e.target.value)}
              placeholder="buf-..."
            />
          </div>
          <div className="flex justify-end">
            <Button asChild variant="link" size="sm" className="h-auto p-0">
              <a href="https://publish.buffer.com/profile/settings/apps-and-extras" target="_blank" rel="noreferrer" className="flex items-center gap-1">
                Obter Token no Buffer <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </div>
        </CardContent>

      <Button onClick={handleSave} disabled={saving || loading} className="w-full h-12 text-base font-semibold">
        {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
        Salvar Configurações de Integração
      </Button>
    </div>
  );
}
