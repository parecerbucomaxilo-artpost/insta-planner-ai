import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Share2, Stethoscope, KeyRound, Sparkles } from "lucide-react";
import { SocialConnections } from "@/components/SocialConnections";
import { ProfileSettings } from "@/components/ProfileSettings";
import { AutomationKeys } from "@/components/AutomationKeys";
import { AnthropicKeySettings } from "@/components/AnthropicKeySettings";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Configurações — Planner Chico" },
      { name: "description", content: "Conecte LinkedIn e Instagram, gerencie perfil e chaves de automação." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("redes");

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors />
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/" })}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar
          </Button>
          <div>
            <h1 className="text-lg font-bold leading-tight">Configurações</h1>
            <p className="text-xs text-muted-foreground">Conexões, perfil e automações</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="redes"><Share2 className="h-4 w-4 mr-1.5" /> Redes Sociais</TabsTrigger>
            <TabsTrigger value="perfil"><Stethoscope className="h-4 w-4 mr-1.5" /> Perfil</TabsTrigger>
            <TabsTrigger value="chaves"><KeyRound className="h-4 w-4 mr-1.5" /> Automação</TabsTrigger>
            <TabsTrigger value="ia"><Sparkles className="h-4 w-4 mr-1.5" /> IA</TabsTrigger>
          </TabsList>

          <TabsContent value="redes" className="mt-6">
            <SocialConnections />
          </TabsContent>
          <TabsContent value="perfil" className="mt-6">
            <ProfileSettings />
          </TabsContent>
          <TabsContent value="chaves" className="mt-6">
            <AutomationKeys />
          </TabsContent>
          <TabsContent value="ia" className="mt-6">
            <AnthropicKeySettings />
          </TabsContent>
        </Tabs>

        <p className="text-xs text-muted-foreground mt-6">
          Dica: <Link to="/" className="underline">voltar ao dashboard</Link> para criar posts.
        </p>
      </main>
    </div>
  );
}
