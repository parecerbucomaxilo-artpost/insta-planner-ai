import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Instagram } from "lucide-react";
import logoAsset from "@/assets/logo-planner.png.asset.json";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function safeNext(value: unknown) {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    return url.hostname === "www.facebook.com" && url.pathname.includes("/dialog/oauth") ? url.toString() : "";
  } catch {
    return "";
  }
}

export const Route = createFileRoute("/meta-connect")({
  ssr: false,
  validateSearch: (search) => ({
    next: safeNext(search.next),
    account: typeof search.account === "string" ? search.account.replace(/^@+/, "") : "",
  }),
  component: MetaConnectPage,
});

function MetaConnectPage() {
  const { next, account } = Route.useSearch();
  const label = account ? `@${account}` : "Instagram Business";

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
          {next ? (
            <>
              <div className="rounded-lg border bg-muted/40 p-3 text-muted-foreground leading-relaxed">
                Se aparecer a conta Francisco e você quiser a Liga, saia do Facebook no navegador e entre com o Facebook administrador da Liga antes de autorizar.
              </div>
              <Button asChild className="w-full" size="lg">
                <a href={next} target="_top" rel="noreferrer">
                  <Instagram className="h-4 w-4" /> Continuar no Facebook <ExternalLink className="h-4 w-4" />
                </a>
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