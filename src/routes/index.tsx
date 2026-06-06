import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { LayoutGrid, Calendar as CalendarIcon, PlusCircle, Settings, Stethoscope, TrendingUp } from "lucide-react";
import { PostComposer } from "@/components/PostComposer";
import { PostsCalendar } from "@/components/PostsCalendar";
import { PostsList } from "@/components/PostsList";
import { ProfileSettings, type Perfil } from "@/components/ProfileSettings";
import { InsightsPanel } from "@/components/InsightsPanel";
import type { PostRow } from "@/lib/posts-types";

export const Route = createFileRoute("/")({
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

function Dashboard() {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [tab, setTab] = useState("criar");

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
    if (data) setPerfil(data as Perfil);
  }, []);

  useEffect(() => { load(); loadPerfil(); }, [load, loadPerfil]);

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
          <div className="ml-auto text-sm text-muted-foreground">
            {posts.length} {posts.length === 1 ? "post" : "posts"}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="criar"><PlusCircle className="h-4 w-4 mr-1.5" /> Criar</TabsTrigger>
            <TabsTrigger value="calendario"><CalendarIcon className="h-4 w-4 mr-1.5" /> Calendário</TabsTrigger>
            <TabsTrigger value="todos"><LayoutGrid className="h-4 w-4 mr-1.5" /> Todos os posts</TabsTrigger>
            <TabsTrigger value="perfil"><Settings className="h-4 w-4 mr-1.5" /> Perfil</TabsTrigger>
          </TabsList>

          <TabsContent value="criar" className="mt-6">
            <PostComposer perfil={perfil} onCreated={() => { load(); setTab("todos"); }} />
          </TabsContent>
          <TabsContent value="calendario" className="mt-6">
            <PostsCalendar posts={posts} />
          </TabsContent>
          <TabsContent value="todos" className="mt-6">
            <PostsList posts={posts} onChange={load} />
          </TabsContent>
          <TabsContent value="perfil" className="mt-6">
            <ProfileSettings onSaved={(p) => setPerfil(p)} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
