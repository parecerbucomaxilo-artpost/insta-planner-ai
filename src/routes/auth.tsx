import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Loader2, Stethoscope } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Planner Chico" },
      { name: "description", content: "Acesse o Planner Chico para gerenciar suas postagens." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // Se já estiver logado, manda para o app
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active && data.user) navigate({ to: "/", replace: true });
    });
    return () => { active = false; };
  }, [navigate]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Conta criada! Você já pode entrar.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        navigate({ to: "/", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro de autenticação");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    try {
      const res = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (res.error) {
        toast.error(res.error.message ?? "Falha no login com Google");
        setBusy(false);
        return;
      }
      if (res.redirected) return; // navegador será redirecionado
      navigate({ to: "/", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no Google");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Toaster richColors />
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-sky-500 to-cyan-400 flex items-center justify-center">
            <Stethoscope className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold">Planner Chico</h1>
          <p className="text-sm text-muted-foreground">Entre para gerenciar suas postagens</p>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleGoogle}
          disabled={busy}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Continuar com Google
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">ou com e-mail</span>
          </div>
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "login" | "signup")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Entrar</TabsTrigger>
            <TabsTrigger value="signup">Criar conta</TabsTrigger>
          </TabsList>
          <TabsContent value="login" className="mt-4">
            <form onSubmit={handleEmail} className="space-y-3">
              <div>
                <Label htmlFor="email-l">E-mail</Label>
                <Input id="email-l" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              <div>
                <Label htmlFor="pass-l">Senha</Label>
                <Input id="pass-l" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
              </div>
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Entrar
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="signup" className="mt-4">
            <form onSubmit={handleEmail} className="space-y-3">
              <div>
                <Label htmlFor="email-s">E-mail</Label>
                <Input id="email-s" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              <div>
                <Label htmlFor="pass-s">Senha</Label>
                <Input id="pass-s" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" minLength={8} />
                <p className="text-xs text-muted-foreground mt-1">Mínimo de 8 caracteres.</p>
              </div>
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Criar conta
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <p className="text-xs text-center text-muted-foreground">
          <Link to="/" className="underline">Voltar</Link>
        </p>
      </Card>
    </div>
  );
}
