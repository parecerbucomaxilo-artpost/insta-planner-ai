import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy, ExternalLink, Instagram, LogIn } from "lucide-react";
import logoAsset from "@/assets/logo-planner.png.asset.json";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function safeNext(value: unknown) {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    const isFacebookOAuth = url.hostname === "www.facebook.com" && url.pathname.includes("/dialog/oauth");
    const isInstagramOAuth = url.hostname === "www.instagram.com" && url.pathname === "/oauth/authorize";
    return isFacebookOAuth || isInstagramOAuth ? url.toString() : "";
  } catch {
    return "";
  }
}

function safeFacebookLogin(value: unknown) {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    return url.hostname === "www.facebook.com" && url.pathname === "/login.php" ? url.toString() : "";
  } catch {
    return "";
  }
}

export const Route = createFileRoute("/meta-connect")({
  ssr: false,
  validateSearch: (search) => ({
    next: safeNext(search.next),
    login: safeFacebookLogin(search.login),
    privateNext: safeNext(search.privateNext),
    account: typeof search.account === "string" ? search.account.replace(/^@+/, "") : "",
  }),
  component: MetaConnectPage,
});

function MetaConnectPage() {
  const { next, login, privateNext, account } = Route.useSearch();
  const label = account ? `@${account}` : "Instagram Business";
  const isLiga = account === "lactbmf.anhanguerasbo";
  const actionUrl = isLiga ? login || privateNext || next : next;
  const isInstagramDirect = actionUrl.includes("instagram.com/oauth/authorize");
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    if (!actionUrl) return;
    try {
      await navigator.clipboard.writeText(actionUrl);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = actionUrl;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-card ring-1 ring-primary/20 overflow-hidden flex items-center justify-center">
            <img src={logoAsset.url} alt="Planner Chico" className="h-full w-full object-contain" />
          </div>
          <div>
            <CardTitle>Conectar Meta {label}</CardTitle>
            <CardDescription>
              Esta etapa abre fora do preview para evitar bloqueio do Facebook.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {actionUrl ? (
            <>
              <div className="rounded-lg border bg-muted/40 p-3 text-muted-foreground leading-relaxed space-y-2">
                {isLiga ? (
                  <>
                    <p>Nova tentativa: este botão usa o Facebook/Meta da Página da Liga e valida que o Instagram conectado é exatamente @{account}.</p>
                    <p>
                      Entre com o Facebook que administra a Página vinculada à Liga. Se aparecer a conta do Prof. Francisco, abra este link em janela anônima.
                    </p>
                  </>
                ) : (
                  <p>
                    O Facebook bloqueia abertura dentro do preview. Use o botão abaixo em uma aba normal; se bloquear novamente, copie o link e cole direto na barra do navegador.
                  </p>
                )}
              </div>
              <Button asChild className="w-full" size="lg">
                <a href={actionUrl} target="_blank" rel="noopener noreferrer">
                  {isLiga ? <LogIn className="h-4 w-4" /> : <Instagram className="h-4 w-4" />}
                  {isLiga && isInstagramDirect ? "Entrar com Instagram da Liga" : isLiga ? "Entrar com Facebook/Meta da Liga" : "Continuar no Facebook"}
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
              <Button type="button" variant="outline" className="w-full" size="lg" onClick={copyLink}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Link copiado" : "Copiar link para abrir manualmente"}
              </Button>
            </>
          ) : (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive">
              Link de conexão inválido. Volte ao Planner e clique em Conectar Meta novamente.
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}