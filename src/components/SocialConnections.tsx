import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Linkedin, Instagram, Loader2, CheckCircle2, AlertCircle, ExternalLink, Send, Save, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedUserId } from "@/lib/auth-utils";
import { ensurePerfil } from "@/lib/perfil.functions";
import { ensurePublicationDestinationProfile, getPublicationDestination, savePublicationDestination } from "@/lib/publication-destination.functions";
import { createMetaOAuthStartUrl } from "@/lib/meta-oauth.functions";
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
  const ensurePerfilFn = useServerFn(ensurePerfil);
  const fetchLigaDestination = useServerFn(getPublicationDestination);
  const saveLigaDestination = useServerFn(savePublicationDestination);
  const ensureLigaDestination = useServerFn(ensurePublicationDestinationProfile);
  const startMetaOAuth = useServerFn(createMetaOAuthStartUrl);
  const [status, setStatus] = useState<LiStatus>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  const [igWebhook, setIgWebhook] = useState("");
  const [liWebhook, setLiWebhook] = useState("");
  const [igLigaWebhook, setIgLigaWebhook] = useState("");
  const [igLigaSaving, setIgLigaSaving] = useState(false);
  const [igLigaTesting, setIgLigaTesting] = useState(false);
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
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess?.session?.user?.id;
        if (!uid) {
          setIgWebhook(DEFAULT_MAKE_WEBHOOK);
          return;
        }
        const { data } = await supabase
          .from("perfil_usuario")
          .select("id, instagram_webhook_url, linkedin_webhook_url, webhook_url")
          .eq("user_id", uid)
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
    (async () => {
      try {
        const destino = await fetchLigaDestination({ data: { conta: "lactbmf.anhanguerasbo" } });
        setIgLigaWebhook(destino.webhookUrl || "");
      } catch {}
    })();
  }, []);

  const handleSaveIgLigaWebhook = async () => {
    const url = igLigaWebhook.trim();
    if (!url) {
      toast.error("Cole a URL do webhook da Liga antes de salvar.");
      return;
    }
    if (url && !/^https?:\/\//i.test(url)) {
      toast.error("Informe uma URL válida começando com https://");
      return;
    }
    setIgLigaSaving(true);
    try {
      const destino = await saveLigaDestination({ data: { conta: "lactbmf.anhanguerasbo", webhookUrl: url } });
      setIgLigaWebhook(destino.webhookUrl);
      toast.success("Webhook IG (Liga) salvo ✅");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setIgLigaSaving(false);
    }
  };

  const handleTestIgLigaWebhook = async () => {
    const url = igLigaWebhook.trim();
    if (!url) return toast.error("Insira a URL do webhook da Liga primeiro.");
    setIgLigaTesting(true);
    const tid = toast.loading("Disparando teste para Liga (Make)…");
    try {
      const testImageUrl = "https://images.unsplash.com/photo-1606811971618-4486d14f3f99?w=1080&h=1080&fit=crop&fm=jpg&q=85";
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "teste-liga",
          post_id: "teste-liga",
          texto: "✅ Teste Liga LACTBMF — webhook conectado.",
          caption: "✅ Teste Liga LACTBMF — webhook conectado.",
          plataforma: "Instagram",
          conta: "lactbmf.anhanguerasbo",
          instagram_conta: "lactbmf.anhanguerasbo",
          url_imagem: testImageUrl,
          imagem_url: testImageUrl,
          image_url: testImageUrl,
          media_url: testImageUrl,
          photo_url: testImageUrl,
          photoUrl: testImageUrl,
          photoURL: testImageUrl,
          "Photo URL": testImageUrl,
          url: testImageUrl,
          link: testImageUrl,
          images: [testImageUrl],
          photos: [testImageUrl],
          photo_urls: [testImageUrl],
          legenda: "✅ Teste Liga LACTBMF — webhook conectado.",
          tipo: "feed",
          tipo_make: "feed",
          tipo_make_singular: "feed",
          tipo_midia: "photo",
          media_kind: "photo",
          tipo_conteudo: "photo",
          tipo_arquivo: "photo",
          tipo_imagem: "imagem",
          type: "feed",
          post_type: "feed",
          media_type: "feed",
          rota: "Post único",
          make_route: "Post único",
        }),
      });
      if (!r.ok) throw new Error(`Make respondeu ${r.status}`);
      toast.success("Webhook IG (Liga) OK!", { id: tid });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no teste", { id: tid });
    } finally {
      setIgLigaTesting(false);
    }
  };

  const handleConnectLigaMeta = async () => {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session?.user?.id) {
      toast.error("Faça login antes de conectar o Instagram da Liga.");
      window.location.href = `/auth?redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }

    try {
      const destino = await ensureLigaDestination({ data: { conta: "lactbmf.anhanguerasbo" } });
      const r = await startMetaOAuth({ data: { perfilId: destino.id, targetAccount: "lactbmf.anhanguerasbo" } });
      const win = window.open(r.url, "_blank", "noopener,noreferrer");
      if (!win) {
        try { window.top!.location.href = r.url; } catch { window.location.href = r.url; }
      }
      toast.info("Conecte usando o Facebook que administra a página da Liga.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao conectar Instagram da Liga");
    }
  };

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
          plataforma: "Instagram",
          imagem_url: "https://images.unsplash.com/photo-1606811971618-4486d14f3f99?w=1080&h=1080&fit=crop&fm=jpg&q=85",
          legenda: "✅ Teste Instagram — webhook conectado.",
          tipo: "imagem"
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
          {/* OAuth direto Meta */}
          <div className="p-4 rounded-lg border-2 border-primary/30 bg-primary/5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-sm">🚀 Conexão Oficial via Meta</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Conecte sua conta Instagram Business com 1 clique. O app publica direto, sem webhook.
                </p>
              </div>
              <Button
                size="sm"
                disabled={igLoading}
                onClick={async () => {
                  const { data: sess } = await supabase.auth.getSession();
                  if (!sess.session?.user?.id) {
                    toast.error("Faça login antes de conectar o Instagram oficial.");
                    window.location.href = `/auth?redirect=${encodeURIComponent(window.location.pathname)}`;
                    return;
                  }
                  let pid = perfilId;
                  if (!pid) {
                    try {
                      const r = await ensurePerfilFn();
                      pid = r.id;
                      setPerfilId(pid);
                    } catch (e) {
                      const msg = e instanceof Error ? e.message : String(e);
                      if (/unauthorized/i.test(msg)) {
                        toast.error("Sua sessão expirou. Redirecionando…");
                        setTimeout(() => { window.location.href = `/auth?redirect=${encodeURIComponent(window.location.pathname)}`; }, 800);
                        return;
                      }
                      return toast.error(`Falha ao preparar perfil: ${msg}`);
                    }
                  }
                  if (!pid) return toast.error("Não foi possível identificar o perfil");
                  let oauthUrl: string;
                  try {
                    const r = await startMetaOAuth({ data: { perfilId: pid } });
                    oauthUrl = r.url;
                  } catch (e) {
                    return toast.error(`Falha ao iniciar OAuth: ${e instanceof Error ? e.message : String(e)}`);
                  }
                  // Abre em nova aba para evitar bloqueio de iframe do Facebook (X-Frame-Options)
                  const win = window.open(oauthUrl, "_blank", "noopener,noreferrer");
                  if (!win) {
                    // Fallback: força navegação no topo da janela
                    try { window.top!.location.href = oauthUrl; } catch { window.location.href = oauthUrl; }
                  }
                }}
              >
                <Instagram className="h-4 w-4 mr-1.5" /> Conectar Instagram
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ig-webhook" className="flex items-center gap-1.5 text-sm">
              <LinkIcon className="h-3.5 w-3.5" /> Alternativa: Webhook do Make
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
              Use só se preferir o Make em vez da conexão oficial acima.
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

          <div className="pt-4 mt-2 border-t space-y-2">
            <Label htmlFor="ig-liga-webhook" className="flex items-center gap-1.5 text-sm font-semibold">
              <LinkIcon className="h-3.5 w-3.5" /> Webhook IG (Liga) — @lactbmf.anhanguerasbo
            </Label>
            <div className="p-3 rounded-lg border bg-muted/40 space-y-2">
              <p className="text-xs text-muted-foreground">
                Preferencial: conecte a conta oficial da Liga via Meta. O app só aceita a conta <strong>@lactbmf.anhanguerasbo</strong> nesse fluxo.
              </p>
              <Button onClick={handleConnectLigaMeta} variant="secondary" size="sm">
                <Instagram className="h-4 w-4" /> Conectar Meta da Liga
              </Button>
            </div>
            <Input
              id="ig-liga-webhook"
              value={igLigaWebhook}
              onChange={(e) => setIgLigaWebhook(e.target.value)}
              placeholder="https://hook.us2.make.com/… (cenário da Liga)"
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Cole aqui a URL do webhook do Make criado para a conta da Liga. Usado apenas pelos posts da aba <strong>Planner Simplificado Liga</strong>.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSaveIgLigaWebhook} disabled={igLigaSaving} size="sm">
                {igLigaSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar
              </Button>
              <Button onClick={handleTestIgLigaWebhook} disabled={igLigaTesting} variant="outline" size="sm">
                {igLigaTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Testar disparo
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
