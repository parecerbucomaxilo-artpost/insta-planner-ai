import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LayoutGrid, Calendar as CalendarIcon, PlusCircle, Settings, Stethoscope, TrendingUp, KeyRound, CalendarDays, LogOut } from "lucide-react";
import { PostComposer } from "@/components/PostComposer";
import { PostsCalendar } from "@/components/PostsCalendar";
import { PostsList } from "@/components/PostsList";
import { ProfileSettings, type Perfil } from "@/components/ProfileSettings";
import { InsightsPanel } from "@/components/InsightsPanel";
import { AutomationKeys } from "@/components/AutomationKeys";
import { AnthropicKeySettings } from "@/components/AnthropicKeySettings";
import { WeeklyCalendar } from "@/components/WeeklyCalendar";
import { claimLegacyData } from "@/lib/claim-legacy.functions";
import type { PostRow } from "@/lib/posts-types";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Planner Chico — Agendamento de Posts" },
      { name: "description", content: "Planner Chico: crie, agende e visualize posts com IA Gemini, focado em Odontologia (CTBMF e Hospitalar)." },
      { property: "og:title", content: "Planner Chico — Agendamento de Posts" },
      { property: "og:description", content: "Planner Chico: crie, agende e visualize posts com IA Gemini, focado em Odontologia (CTBMF e Hospitalar)." },
    ],
  }),
  component: Dashboard,
});

const PERFIL_CACHE_KEY = "planner_perfil_cache_v1";

function readPerfilCache(): Perfil | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PERFIL_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Perfil) : null;
  } catch {
    return null;
  }
}

function Dashboard() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostRow[]>([]);
  // Hidrata do cache só depois do mount para evitar hydration mismatch (SSR não tem localStorage)
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  useEffect(() => { const c = readPerfilCache(); if (c) setPerfil(c); }, []);
  const [tab, setTab] = useState("criar");
  const [autoGenWeekly, setAutoGenWeekly] = useState(false);
  const claim = useServerFn(claimLegacyData);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("posts").select("*").order("created_at", { ascending: false });
    if (!error && data) setPosts(data as unknown as PostRow[]);
  }, []);

  const loadPerfil = useCallback(async () => {
    const { data } = await supabase
      .from("perfil_usuario")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (data) {
      setPerfil(data as Perfil);
      try { window.localStorage.setItem(PERFIL_CACHE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
    }
  }, []);

  // Primeiro usuário a entrar herda os dados legados (one-shot, idempotente).
  useEffect(() => {
    claim().then(() => { load(); loadPerfil(); }).catch(() => { load(); loadPerfil(); });
  }, [claim, load, loadPerfil]);

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    try { window.localStorage.removeItem(PERFIL_CACHE_KEY); } catch { /* ignore */ }
    navigate({ to: "/auth", replace: true });
  }, [navigate]);

  // Notificação interna para posts que atingiram 500+ views (e ainda não foram avisados)
  const notifiedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const viral = posts.filter(
      (p) => (p.visualizacoes ?? 0) >= 500 && !p.aviso_500_atingido && !notifiedRef.current.has(p.id),
    );
    if (viral.length === 0) return;
    (async () => {
      for (const p of viral) {
        notifiedRef.current.add(p.id);
        const titulo = (p.legenda_instagram || p.legenda || "Post sem título").split("\n")[0].slice(0, 60);
        toast.success(`🔥 Parabéns! O post "${titulo}" atingiu 500 visualizações!`, {
          duration: 8000,
        });
        await supabase.from("posts").update({ aviso_500_atingido: true }).eq("id", p.id);
      }
    })();
  }, [posts]);

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors />
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full overflow-hidden ring-2 ring-primary/30 bg-gradient-to-br from-sky-500 to-cyan-400 flex items-center justify-center flex-shrink-0">
            {perfil?.instagram_foto_url || perfil?.url_logo ? (
              <img
                src={perfil.instagram_foto_url ?? perfil.url_logo ?? ""}
                alt="Foto do perfil"
                className="h-full w-full object-cover"
              />
            ) : (
              <Stethoscope className="h-5 w-5 text-white" />
            )}
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">Planner Chico</h1>
            <p className="text-xs text-muted-foreground">Agendamento de posts · Odontologia CTBMF & Hospitalar</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {posts.length} {posts.length === 1 ? "post" : "posts"}
            </span>
            <Button variant="ghost" size="sm" onClick={handleSignOut} aria-label="Sair">
              <LogOut className="h-4 w-4 mr-1.5" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="criar"><PlusCircle className="h-4 w-4 mr-1.5" /> Criar</TabsTrigger>
            <TabsTrigger value="semana"><CalendarDays className="h-4 w-4 mr-1.5" /> Cronograma 7 Dias</TabsTrigger>
            <TabsTrigger value="calendario"><CalendarIcon className="h-4 w-4 mr-1.5" /> Calendário</TabsTrigger>
            <TabsTrigger value="todos"><LayoutGrid className="h-4 w-4 mr-1.5" /> Todos os posts</TabsTrigger>
            <TabsTrigger value="insights"><TrendingUp className="h-4 w-4 mr-1.5" /> Insights de Performance</TabsTrigger>
            <TabsTrigger value="perfil"><Settings className="h-4 w-4 mr-1.5" /> Perfil</TabsTrigger>
            <TabsTrigger value="chaves"><KeyRound className="h-4 w-4 mr-1.5" /> Chaves de Automação</TabsTrigger>
            <TabsTrigger value="ia"><KeyRound className="h-4 w-4 mr-1.5" /> IA / Anthropic</TabsTrigger>
          </TabsList>

          <TabsContent value="criar" className="mt-6">
            <PostComposer 
              perfil={perfil} 
              onCreated={() => { load(); setTab("todos"); }} 
              onTriggerWeekly={() => { setAutoGenWeekly(true); setTab("semana"); }}
            />
          </TabsContent>
          <TabsContent value="semana" className="mt-6">
            <WeeklyCalendar perfil={perfil} onCreated={load} autoGenerate={autoGenWeekly} />
          </TabsContent>
          <TabsContent value="calendario" className="mt-6">
            <PostsCalendar posts={posts} />
          </TabsContent>
          <TabsContent value="todos" className="mt-6">
            <PostsList posts={posts} onChange={load} />
          </TabsContent>
          <TabsContent value="insights" className="mt-6">
            <InsightsPanel posts={posts} />
          </TabsContent>
          <TabsContent value="perfil" className="mt-6">
            <ProfileSettings onSaved={(p) => {
              setPerfil(p);
              try { window.localStorage.setItem(PERFIL_CACHE_KEY, JSON.stringify(p)); } catch { /* ignore */ }
            }} />
          </TabsContent>
          <TabsContent value="chaves" className="mt-6">
            <AutomationKeys />
          </TabsContent>
          <TabsContent value="ia" className="mt-6">
            <AnthropicKeySettings />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
