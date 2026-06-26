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
              <ol className="rounded-lg border bg-muted/40 p-3 text-muted-foreground leading-relaxed list-decimal pl-5 space-y-1">
                <li>Clique em <strong>Sair do Facebook</strong> (abre em nova aba) e saia de qualquer conta logada.</li>
                <li>Volte aqui e clique em <strong>Continuar no Facebook</strong> para entrar com a conta admin de {label}.</li>
              </ol>
              <Button asChild variant="outline" className="w-full" size="lg">
                <a href="https://www.facebook.com/" target="_blank" rel="noreferrer">
                  Sair do Facebook <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
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