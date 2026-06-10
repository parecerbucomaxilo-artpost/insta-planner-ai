import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, KeyRound, Link as LinkIcon, ShieldAlert, Save, Loader2, Globe } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedUserId } from "@/lib/auth-utils";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;

function CopyField({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copiado!`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex gap-2">
        <textarea
          readOnly
          value={value}
          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
          className="flex-1 font-mono text-xs bg-muted p-3 rounded-md border resize-none break-all"
          rows={3}
        />
        <Button onClick={onCopy} variant="outline" size="icon" className="shrink-0">
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

export function AutomationKeys() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [perfilId, setPerfilId] = useState<string | null>(null);

  useEffect(() => {
    async function loadWebhook() {
      try {
        const { data, error } = await supabase
          .from("perfil_usuario")
          .select("id, webhook_url")
          .limit(1)
          .maybeSingle();
        
        if (error) throw error;
        if (data) {
          setPerfilId(data.id);
          setWebhookUrl(data.webhook_url || "");
        }
      } catch (err) {
        console.error("Erro ao carregar webhook:", err);
      } finally {
        setLoading(false);
      }
    }
    loadWebhook();
  }, []);

  const handleSaveWebhook = async () => {
    setSaving(true);
    try {
      const userId = await getAuthedUserId();
      
      if (perfilId) {
        const { error } = await supabase
          .from("perfil_usuario")
          .update({ webhook_url: webhookUrl })
          .eq("id", perfilId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("perfil_usuario")
          .insert({ user_id: userId, webhook_url: webhookUrl })
          .select("id")
          .single();
        if (error) throw error;
        setPerfilId(data.id);
      }
      
      toast.success("URL do Webhook salva com sucesso!");
    } catch (err) {
      console.error("Erro ao salvar webhook:", err);
      toast.error("Erro ao salvar a URL do webhook.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <Globe className="h-5 w-5" />
            Webhook do Integrador (Make.com / n8n)
          </CardTitle>
          <CardDescription>
            Cole aqui a URL do Webhook que você criou no Make.com ou n8n. 
            O app enviará os dados do post para esta URL sempre que você clicar em "Publicar".
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">URL do Webhook</label>
            <div className="flex gap-2">
              <Input
                placeholder="https://hook.make.com/..."
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                disabled={loading}
              />
              <Button onClick={handleSaveWebhook} disabled={saving || loading}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Dica: No Make.com, use o módulo "Webhooks -> Custom Webhook" para gerar essa URL.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Chaves de Automação do Banco de Dados
          </CardTitle>
          <CardDescription>
            Use estas credenciais no módulo <strong>Supabase</strong> do seu integrador para que ele consiga ler os posts agendados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <CopyField
            label="Supabase URL"
            value={SUPABASE_URL}
            icon={<LinkIcon className="h-4 w-4 text-sky-600" />}
          />
          <CopyField
            label="Anon / Publishable Key (pública, segura para Make.com)"
            value={SUPABASE_ANON_KEY}
            icon={<KeyRound className="h-4 w-4 text-amber-600" />}
          />
          <CopyField
            label="Project Ref / ID"
            value={SUPABASE_PROJECT_ID}
            icon={<KeyRound className="h-4 w-4 text-purple-600" />}
          />

          <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-4 flex gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm space-y-2">
              <p className="font-medium text-amber-900 dark:text-amber-200">
                Service Role Key (Acesso Total)
              </p>
              <p className="text-amber-800 dark:text-amber-300">
                A <strong>Service Role Key</strong> dá acesso total ao banco. Ela <strong>nunca</strong> deve ser exibida no frontend por segurança.
                Você a encontra no painel do Lovable em <em>Project Settings → API Keys</em>. 
                Use-a apenas dentro do Make.com se precisar gravar dados sem restrições.
              </p>
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 p-4 text-sm space-y-2">
            <p className="font-medium">Como configurar no Make.com</p>
            <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
              <li>No Make, adicione o módulo <strong>Supabase</strong>.</li>
              <li>Crie uma nova conexão e use a <strong>URL</strong> e a <strong>Anon Key</strong> acima.</li>
              <li>Para disparos automáticos, use o <strong>Webhook</strong> que você configurou no topo desta página.</li>
              <li>Tabela principal: <code className="bg-background px-1 rounded">posts</code>.</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
