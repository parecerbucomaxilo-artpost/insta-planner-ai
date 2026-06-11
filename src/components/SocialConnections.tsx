import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Linkedin, Instagram, Loader2, CheckCircle2, AlertCircle, ExternalLink, Send } from "lucide-react";
import { toast } from "sonner";
import { getLinkedInStatus, publishToLinkedIn } from "@/lib/social/linkedin-publish.functions";

type LiStatus =
  | { connected: true; name?: string; email?: string; picture?: string; sub?: string }
  | { connected: false; error?: string }
  | null;

export function SocialConnections() {
  const fetchStatus = useServerFn(getLinkedInStatus);
  const sendLinkedIn = useServerFn(publishToLinkedIn);
  const [status, setStatus] = useState<LiStatus>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

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
  }, [fetchStatus]);

  const handleTestPost = async () => {
    setTesting(true);
    const tid = toast.loading("Publicando post de teste no LinkedIn…");
    try {
      const r = await sendLinkedIn({
        data: {
          text: "✅ Teste de integração nativa via Planner Chico. Publicação automática ativa.",
        },
      });
      if (r.ok) {
        toast.success("Post de teste publicado!", { id: tid });
        if (r.shareUrl) window.open(r.shareUrl, "_blank");
      } else {
        toast.error(r.error || "Falha ao publicar", { id: tid });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro", { id: tid });
    } finally {
      setTesting(false);
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
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : status?.connected ? (
                  <Badge className="bg-emerald-600 hover:bg-emerald-600 gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Conectado
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="h-3 w-3" /> Desconectado
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Publicação nativa via API oficial (escopo <code>w_member_social</code>). Posta em nome do seu perfil pessoal.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {status?.connected ? (
            <>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border">
                {status.picture && (
                  <img src={status.picture} alt="" className="h-10 w-10 rounded-full object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{status.name || "Membro LinkedIn"}</p>
                  {status.email && (
                    <p className="text-xs text-muted-foreground truncate">{status.email}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleTestPost} disabled={testing} variant="outline" size="sm">
                  {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Publicar post de teste
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Quando você marcar <strong>LinkedIn</strong> no compositor e definir o status como <strong>Publicado</strong>, o post é enviado automaticamente para sua conta.
              </p>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {status?.error || "A conexão precisa ser reautorizada nas configurações do projeto."}
              </p>
            </div>
          )}
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
                Publicação por webhook (Make/Albato) — configurada na aba <strong>Chaves de Automação</strong>.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm text-amber-900 dark:text-amber-100">
            <p className="font-medium mb-1">Por que não nativo?</p>
            <p className="text-xs leading-relaxed">
              A API oficial do Instagram (<code>instagram_content_publish</code>) exige App próprio no Meta for Developers
              com revisão da Meta, conta Business vinculada a uma Página do Facebook e tokens de longa duração por usuário.
              Você optou por manter o fluxo via webhook (Make/Albato), que já está funcionando e é mais simples.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <a href="https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media_publish" target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" /> Docs oficiais da Meta
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
