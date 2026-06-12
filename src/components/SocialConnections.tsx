import { useEffect, useState } from "react";
// import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Linkedin, Instagram, Loader2, CheckCircle2, AlertCircle, ExternalLink, Send, Save, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedUserId } from "@/lib/auth-utils";
// import { getLinkedInStatus, publishToLinkedIn } from "@/lib/social/linkedin-publish.functions";

const DEFAULT_MAKE_WEBHOOK = "https://hook.us2.make.com/vxh3w2d4e014i1rkig6xxp2dm6fkxprn";

type LiStatus =
  | { connected: true; name?: string; email?: string; picture?: string; sub?: string }
  | { connected: false; error?: string }
  | null;

export function SocialConnections() {
  // const fetchStatus = useServerFn(getLinkedInStatus);
  // const sendLinkedIn = useServerFn(publishToLinkedIn);
  const fetchStatus = async () => ({ connected: false });
  const sendLinkedIn = async () => ({ ok: false, error: "Reset" });
  const [status, setStatus] = useState<LiStatus>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  const [igWebhook, setIgWebhook] = useState("");
  const [liWebhook, setLiWebhook] = useState("");
  const [igLoading, setIgLoading] = useState(true);
  const [igSaving, setIgSaving] = useState(false);
  const [liSaving, setLiSaving] = useState(false);
  const [igTesting, setIgTesting] = useState(false);
  const [liTesting, setLiTesting] = useState(false);
  const [perfilId, setPerfilId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await fetchStatus();
        setStatus(s);
      } catch (e) {
        setStatus({ connected: false, error: e instanceof Error ? e.message : "Erro" });
      } finally {
        setLoading(false);
      }
    })();
    (async () => {
      try {
        const { data } = await supabase
          .from("perfil_usuario")
          .select("id, instagram_webhook_url, linkedin_webhook_url, webhook_url")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (data) {
          setPerfilId(data.id);
          setIgWebhook(data.instagram_webhook_url || data.webhook_url || DEFAULT_MAKE_WEBHOOK);
          setLiWebhook(data.linkedin_webhook_url || "https://hook.us2.make.com/4tics3gdoow4y02vo1rh4wcmeshu4psv");
        } else {
          setIgWebhook(DEFAULT_MAKE_WEBHOOK);
        }
      } finally {
        setIgLoading(false);
      }
    })();
  }, [fetchStatus]);

  const handleSaveIgWebhook = async () => {
    const url = igWebhook.trim();
    if (url && !/^https?:\/\//i.test(url)) {
      toast.error("Informe uma URL válida começando com https://");
      return;
    }
    setIgSaving(true);
    try {
      const uid = await getAuthedUserId();
      const payload = { user_id: uid, instagram_webhook_url: url, webhook_url: url };
      const res = perfilId
        ? await supabase.from("perfil_usuario").update(payload).eq("id", perfilId).select("id").maybeSingle()
        : await supabase.from("perfil_usuario").insert(payload).select("id").maybeSingle();
      if (res.error) throw res.error;
      if (res.data?.id) setPerfilId(res.data.id);
      toast.success("Webhook do Instagram salvo ✅");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setIgSaving(false);
    }
  };

  const handleSaveLiWebhook = async () => {
    const url = liWebhook.trim();
    if (url && !/^https?:\/\//i.test(url)) {
      toast.error("Informe uma URL válida começando com https://");
      return;
    }
    setLiSaving(true);
    try {
      const uid = await getAuthedUserId();
      const payload = { user_id: uid, linkedin_webhook_url: url };
      const res = perfilId
        ? await supabase.from("perfil_usuario").update(payload).eq("id", perfilId).select("id").maybeSingle()
        : await supabase.from("perfil_usuario").insert(payload).select("id").maybeSingle();
      if (res.error) throw res.error;
      if (res.data?.id) setPerfilId(res.data.id);
      toast.success("Webhook do LinkedIn salvo ✅");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setLiSaving(false);
    }
  };

  const handleTestIgWebhook = async () => {
    const url = igWebhook.trim();
    if (!url) return toast.error("Insira a URL do webhook do Instagram primeiro.");
    setIgTesting(true);
    const tid = toast.loading("Disparando teste para Instagram (Make)…");
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          texto: "✅ Teste Instagram — webhook conectado.",
          plataforma: "Instagram"
        }),
      });
      if (!r.ok) throw new Error(`Make respondeu ${r.status}`);
      toast.success("Webhook Instagram OK!", { id: tid });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no teste", { id: tid });
    } finally {
      setIgTesting(false);
    }
  };

  const handleTestLiWebhook = async () => {
    const url = liWebhook.trim();
    if (!url) return toast.error("Insira a URL do webhook do LinkedIn primeiro.");
    setLiTesting(true);
    const tid = toast.loading("Disparando teste para LinkedIn (Make)…");
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          texto: "✅ Teste LinkedIn — webhook conectado.",
          plataforma: "LinkedIn"
        }),
      });
      if (!r.ok) throw new Error(`Make respondeu ${r.status}`);
      toast.success("Webhook LinkedIn OK!", { id: tid });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no teste", { id: tid });
    } finally {
      setLiTesting(false);
    }
  };


  const handleTestPost = async () => {
    handleTestIgWebhook();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold">Conexões de Redes Sociais</h2>
        <p className="text-sm text-muted-foreground">
          Conecte suas contas para publicar nativamente direto deste app, sem depender de automações externas.
        </p>
      </div>

      {/* LinkedIn */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-sky-600 to-blue-700 flex items-center justify-center text-white">
              <Linkedin className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                LinkedIn
                <Badge variant="secondary" className="gap-1">via automação</Badge>
              </CardTitle>
              <CardDescription>
                Publicação por webhook do Make. O Make recebe o texto e publica no seu perfil do LinkedIn.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="li-webhook" className="flex items-center gap-1.5 text-sm">
                <LinkIcon className="h-3.5 w-3.5" /> URL do Webhook do LinkedIn (Make)
              </Label>
              <Input
                id="li-webhook"
                value={liWebhook}
                onChange={(e) => setLiWebhook(e.target.value)}
                placeholder="https://hook.us2.make.com/…"
                className="font-mono text-xs"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSaveLiWebhook} disabled={liSaving || igLoading} size="sm">
                {liSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar LinkedIn Webhook
              </Button>
              <Button onClick={handleTestLiWebhook} disabled={liTesting || igLoading} variant="outline" size="sm">
                {liTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Testar disparo LinkedIn
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Instagram */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-pink-500 via-rose-500 to-orange-400 flex items-center justify-center text-white">
              <Instagram className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                Instagram Business
                <Badge variant="secondary" className="gap-1">via automação</Badge>
              </CardTitle>
              <CardDescription>
                Publicação por webhook do Make. O Make recebe o texto e publica no seu Instagram Business.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ig-webhook" className="flex items-center gap-1.5 text-sm">
              <LinkIcon className="h-3.5 w-3.5" /> URL do Webhook do Instagram (Make)
            </Label>
            {igLoading ? (
              <div className="h-9 rounded-md bg-muted animate-pulse" />
            ) : (
              <Input
                id="ig-webhook"
                value={igWebhook}
                onChange={(e) => setIgWebhook(e.target.value)}
                placeholder="https://hook.us2.make.com/…"
                className="font-mono text-xs"
              />
            )}
            <p className="text-[11px] text-muted-foreground">
              Cole aqui a URL do cenário no Make. O app envia <code>{"{ texto }"}</code> via POST quando você clicar em <strong>Publicar agora</strong>.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSaveIgWebhook} disabled={igSaving || igLoading} size="sm">
              {igSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
            <Button onClick={handleTestIgWebhook} disabled={igTesting || igLoading} variant="outline" size="sm">
              {igTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Testar disparo
            </Button>
            <Button asChild variant="ghost" size="sm">
              <a href="https://www.make.com/en/help/tools/webhooks" target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" /> Docs do Make
              </a>
            </Button>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-900 dark:text-amber-100 leading-relaxed">
            <strong>Por que não API nativa?</strong> A Meta exige App próprio aprovado e conta Business vinculada a uma Página do Facebook. O webhook é o caminho mais rápido e estável.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
