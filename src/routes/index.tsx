import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { Instagram, LayoutGrid, Calendar as CalendarIcon, PlusCircle } from "lucide-react";
import { PostComposer } from "@/components/PostComposer";
import { PostsCalendar } from "@/components/PostsCalendar";
import { PostsList } from "@/components/PostsList";
import type { PostRow } from "@/lib/posts-types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Planner IG — Agendamento de Posts" },
      { name: "description", content: "Crie, agende e visualize posts do Instagram com IA Gemini e calendário visual." },
      { property: "og:title", content: "Planner IG — Agendamento de Posts" },
      { property: "og:description", content: "Crie, agende e visualize posts do Instagram com IA Gemini e calendário visual." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [tab, setTab] = useState("criar");

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("posts").select("*").order("created_at", { ascending: false });
    if (!error && data) setPosts(data as unknown as PostRow[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors />
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-[var(--instagram-from)] via-[var(--instagram-via)] to-[var(--instagram-to)] flex items-center justify-center">
            <Instagram className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">Planner IG</h1>
            <p className="text-xs text-muted-foreground">Dashboard de agendamento de posts</p>
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
          </TabsList>

          <TabsContent value="criar" className="mt-6">
            <PostComposer onCreated={() => { load(); setTab("todos"); }} />
          </TabsContent>
          <TabsContent value="calendario" className="mt-6">
            <PostsCalendar posts={posts} />
          </TabsContent>
          <TabsContent value="todos" className="mt-6">
            <PostsList posts={posts} onChange={load} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
