import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import logoAsset from "@/assets/logo-planner.png.asset.json";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

function normalizeRedirect(value: unknown) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search) => ({
    redirect: normalizeRedirect(search.redirect),
  }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect } = Route.useSearch();
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}${redirect}`,
      });
      if (result.error) throw result.error;
      if (!result.redirected) window.location.assign(redirect);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao iniciar login");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-white ring-1 ring-primary/20 overflow-hidden flex items-center justify-center">
            <img src={logoAsset.url} alt="Planner Chico" className="h-full w-full object-contain" />
          </div>
          <div>
            <CardTitle>Entrar no Planner Chico</CardTitle>
            <CardDescription>Faça login para conectar o Instagram oficial com segurança.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={handleGoogleLogin} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Entrar com Google
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
