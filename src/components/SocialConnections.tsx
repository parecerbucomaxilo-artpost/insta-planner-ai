import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Linkedin, Instagram, Loader2, CheckCircle2, AlertCircle, ExternalLink, Send, Save, Link as LinkIcon, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedUserId } from "@/lib/auth-utils";
import { ensurePerfil } from "@/lib/perfil.functions";
import { ensurePublicationDestinationProfile, saveManualInstagramToken } from "@/lib/publication-destination.functions";
import { createInstagramOAuthStartUrl, createMetaOAuthStartUrl } from "@/lib/meta-oauth.functions";
// import { getLinkedInStatus, publishToLinkedIn } from "@/lib/social/linkedin-publish.functions";

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
  const ensureLigaDestination = useServerFn(ensurePublicationDestinationProfile);
  const startMetaOAuth = useServerFn(createMetaOAuthStartUrl);
  const startInstagramOAuth = useServerFn(createInstagramOAuthStartUrl);
  const [status, setStatus] = useState<LiStatus>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  const [liWebhook, setLiWebhook] = useState("");
  const [igLoading, setIgLoading] = useState(true);
  const [liSaving, setLiSaving] = useState(false);
  const [liTesting, setLiTesting] = useState(false);
  const [perfilId, setPerfilId] = useState<string | null>(null);
  const [ligaMetaConnectPath, setLigaMetaConnectPath] = useState("");
  const [ligaMetaOauthUrl, setLigaMetaOauthUrl] = useState("");
  const [ligaMetaLoginUrl, setLigaMetaLoginUrl] = useState("");
  const [ligaMetaCopied, setLigaMetaCopied] = useState(false);
  const [ligaManualToken, setLigaManualToken] = useState("");
  const [ligaManualIgId, setLigaManualIgId] = useState("");
  const [ligaManualSaving, setLigaManualSaving] = useState(false);
  const saveLigaManualToken = useServerFn(saveManualInstagramToken);

  const handleSaveLigaManualToken = async () => {
    const token = ligaManualToken.trim();
    const igId = ligaManualIgId.trim();
    if (!token || !igId) return toast.error("Cole o Access Token e o IG Business ID da Liga.");
    setLigaManualSaving(true);
    try {
      await saveLigaManualToken({ data: { conta: "lactbmf.anhanguerasbo", accessToken: token, igBusinessId: igId } });
      toast.success("Token Instagram da Liga salvo ✅ A Liga já pode publicar direto.");
      setLigaManualToken("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar token manual.");
    } finally {
      setLigaManualSaving(false);
    }
  };

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
          return;
        }
        const { data } = await supabase
          .from("perfil_usuario")
          .select("id, linkedin_webhook_url")
          .eq("user_id", uid)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (data) {
          setPerfilId(data.id);
          setLiWebhook(data.linkedin_webhook_url || "https://hook.us2.make.com/4tics3gdoow4y02vo1rh4wcmeshu4psv");
        }
      } finally {
        setIgLoading(false);
      }
    })();
  }, []);

  const handleConnectLigaMeta = async () => {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session?.user?.id) {
      toast.error("Faça login antes de conectar o Instagram da Liga.");
      window.location.href = `/auth?redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }

    try {
      const destino = await ensureLigaDestination({ data: { conta: "lactbmf.anhanguerasbo" } });
      const [igResult, fbResult] = await Promise.allSettled([
        startInstagramOAuth({ data: { perfilId: destino.id, targetAccount: "lactbmf.anhanguerasbo" } }),
        startMetaOAuth({ data: { perfilId: destino.id, targetAccount: "lactbmf.anhanguerasbo" } }),
      ]);
      const igUrl = igResult.status === "fulfilled" ? igResult.value.url : "";
      const fbLoginUrl = fbResult.status === "fulfilled" ? (fbResult.value.loginUrl || fbResult.value.privateAuthUrl || fbResult.value.url) : "";
      if (!igUrl && !fbLoginUrl) throw new Error("Não foi possível gerar link Meta/Instagram da Liga.");

      setLigaMetaOauthUrl(igUrl || fbLoginUrl);
      setLigaMetaLoginUrl(fbLoginUrl);
      setLigaMetaConnectPath(
        `/meta-connect?account=lactbmf.anhanguerasbo` +
          (igUrl ? `&next=${encodeURIComponent(igUrl)}` : "") +
          (fbLoginUrl ? `&login=${encodeURIComponent(fbLoginUrl)}` : ""),
      );
      toast.info("Preparei 2 caminhos: Instagram direto e Facebook/Meta em nova sessão. Abra pelo botão abaixo.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao conectar Instagram da Liga");
    }
  };

  const handleCopyLigaMetaUrl = async () => {
    const urlToCopy = ligaMetaLoginUrl || ligaMetaOauthUrl;
    if (!urlToCopy) return toast.error("Prepare a conexão Meta da Liga primeiro.");
    try {
      await navigator.clipboard.writeText(urlToCopy);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = urlToCopy;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setLigaMetaCopied(true);
    window.setTimeout(() => setLigaMetaCopied(false), 1800);
    toast.success("Link Meta da Liga copiado. Cole na barra do navegador fora do preview.");
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
                <Badge variant="secondary" className="gap-1">Meta direta</Badge>
              </CardTitle>
              <CardDescription>
                Publicação direta pela conexão oficial Meta/Instagram, sem Make.
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

          <div className="pt-4 mt-2 border-t space-y-2">
            <Label className="flex items-center gap-1.5 text-sm font-semibold">
              <Instagram className="h-3.5 w-3.5" /> Instagram da Liga — @lactbmf.anhanguerasbo
            </Label>
            <div className="p-3 rounded-lg border bg-muted/40 space-y-2">
              <p className="text-xs text-muted-foreground">
                A Liga publica somente pela Meta direta ou pelo modo manual do Planner Simplificado; nada da Liga cai na conta Chico.
              </p>
              <Button onClick={handleConnectLigaMeta} variant="secondary" size="sm">
                <Instagram className="h-4 w-4" /> Preparar conexão Instagram da Liga
              </Button>
              {ligaMetaConnectPath && (
                <Button asChild variant="outline" size="sm">
                  <a href={ligaMetaConnectPath} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" /> Abrir conexão Instagram da Liga
                  </a>
                </Button>
              )}
              {ligaMetaOauthUrl && (
                <Button type="button" variant="outline" size="sm" onClick={handleCopyLigaMetaUrl}>
                  {ligaMetaCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {ligaMetaCopied ? "Link copiado" : "Copiar link Meta"}
                </Button>
              )}
            </div>

            <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 space-y-2 mt-2">
              <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-100">
                🔑 Fallback manual — cole o token da Liga
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Só funciona se o Facebook usado administrar a página conectada à Liga. Se essa conta não aparecer na Meta, use o modo manual do Planner Simplificado ou gere um token no Graph API Explorer com permissões <code>instagram_basic</code> + <code>instagram_content_publish</code> + <code>pages_show_list</code>.
              </p>
              <Input
                value={ligaManualToken}
                onChange={(e) => setLigaManualToken(e.target.value)}
                placeholder="EAAG… (Access Token longo da Liga)"
                className="font-mono text-xs"
              />
              <Input
                value={ligaManualIgId}
                onChange={(e) => setLigaManualIgId(e.target.value)}
                placeholder="17841… (Instagram Business Account ID)"
                className="font-mono text-xs"
              />
              <Button onClick={handleSaveLigaManualToken} disabled={ligaManualSaving} size="sm">
                {ligaManualSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar token manual da Liga
              </Button>
            </div>

          </div>
        </CardContent>
      </Card>
    </div>
  );
}
