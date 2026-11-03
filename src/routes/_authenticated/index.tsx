import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
 LayoutGrid,
 Calendar as CalendarIcon,
 PlusCircle,
 Settings,
 TrendingUp,
 KeyRound,
 CalendarDays,
 LogOut,
 Sparkles,
 Stethoscope,
 CalendarCheck,
 PencilRuler,
 ClipboardList,
 Check,
} from "lucide-react";
import { PostComposer } from "@/components/PostComposer";
import { PlannerSimplificado } from "@/components/PlannerSimplificado";
import { PlannerAgendamentoTratamento } from "@/components/PlannerAgendamentoTratamento";
import { PlannerClinicaEscola } from "@/components/planner-clinica-escola";
import { PostsCalendar } from "@/components/PostsCalendar";
import { PostsList } from "@/components/PostsList";
import { ProfileSettings, type Perfil } from "@/components/ProfileSettings";
import { InsightsPanel } from "@/components/InsightsPanel";
import { AutomationKeys } from "@/components/AutomationKeys";
import { AnthropicKeySettings } from "@/components/AnthropicKeySettings";
import { WeeklyCalendar } from "@/components/WeeklyCalendar";
import { NotificationsBell } from "@/components/NotificationsBell";
import logoAsset from "@/assets/logo-planner.png.asset.json";
import type { PostRow } from "@/lib/posts-types";
import { signPostMediaUrls } from "@/lib/storage-url";
import { POST_REVIEW_CHANGED } from "@/lib/post-review";
import { ApproveAllReview } from "@/components/ApproveAllReview";
import { LinkedInConnectionNotice } from "@/components/LinkedInConnectionNotice";

export const Route = createFileRoute("/_authenticated/")({
 head: () => ({
 meta: [
 { title: "Planner Chico — Agendamento de Posts" },
 { name: "description", content: "Planner Chico: crie, agende e publique posts para Odontologia (CTBMF e Hospitalar), Cirurgia Bucal, Biópsias e Clínica Escola." },
 { property: "og:title", content: "Planner Chico — Agendamento de Posts" },
 { property: "og:description", content: "Planner Chico: crie, agende e publique posts para Odontologia (CTBMF e Hospitalar), Cirurgia Bucal, Biópsias e Clínica Escola." },
 { property: "og:type", content: "website" },
 { name: "twitter:card", content: "summary" },
 ],
 }),
 component: Dashboard,
});

const PERFIL_CACHE_KEY = "planner_perfil_cache_v1";

function readPerfilCache(): Perfil | null {
 if (typeof window === "undefined") return null;
 try {
 const raw = window.localStorage.getItem(PERFIL_CACHE_KEY);
 return raw? (JSON.parse(raw) as Perfil): null;
 } catch {
 return null;
 }
}

function Dashboard() {
 const navigate = useNavigate();
 const [posts, setPosts] = useState<PostRow[]>([]);
 const [perfil, setPerfil] = useState<Perfil | null>(null);
 useEffect(() => { const c = readPerfilCache(); if (c) setPerfil(c); }, []);
 const [tab, setTab] = useState("criar");
 const [autoGenWeekly, setAutoGenWeekly] = useState(false);
 const pendingPosts = posts.filter((post) => post.status === "PendenteAprovacao");
 const [pendingOnly, setPendingOnly] = useState(false);
 const [reviewAll, setReviewAll] = useState(false);
 const reviewIds = useMemo(() => pendingPosts.map((p) => p.id), [reviewAll]); // eslint-disable-line react-hooks/exhaustive-deps
 const [signedOut, setSignedOut] = useState(false);

 const load = useCallback(async () => {
 console.log("[Reset] Carregando posts.");
 const { data, error } = await supabase
.from("posts")
.select("*")
.order("created_at", { ascending: false })
.limit(1000);

 if (error) {
 console.error("[Reset] Erro ao carregar posts:", error);
 if (error.message.includes("timeout")) {
 toast.error("Tempo de conexão esgotado. Tentando novamente.");
 } else {
 toast.error("Erro de banco: " + error.message);
 }
 } else if (data) {
 console.log("[Reset] Posts carregados:", data.length);
 const postsWithMedia = await Promise.all(
 (data as unknown as PostRow[]).map((post) => signPostMediaUrls(post)),
 );
 setPosts(postsWithMedia as PostRow[]);
 }
 }, []);

 const loadPerfil = useCallback(async () => {
 const { data: sess } = await supabase.auth.getSession();
 const uid = sess.session?.user?.id;
 if (!uid) return;
 const { data } = await supabase
.from("perfil_usuario")
.select("*")
.eq("user_id", uid)
.order("created_at", { ascending: true })
.limit(1)
.maybeSingle();
 if (data) {
 setPerfil(data as Perfil);
 try { window.localStorage.setItem(PERFIL_CACHE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
 }
 }, []);

 useEffect(() => {
 load();
 loadPerfil();
 void supabase.auth.getSession().then(({ data }) => setSignedOut(!data.session));
 }, [load, loadPerfil]);
 useEffect(() => {
 const refresh = () => { void load(); };
 window.addEventListener(POST_REVIEW_CHANGED, refresh);
 return () => window.removeEventListener(POST_REVIEW_CHANGED, refresh);
 }, [load]);

 const handleSignOut = useCallback(async () => {
 await supabase.auth.signOut();
 try { window.localStorage.removeItem(PERFIL_CACHE_KEY); } catch { /* ignore */ }
 navigate({ to: "/auth", search: { redirect: "/" }, replace: true });
 }, [navigate]);

 const notifiedRef = useRef<Set<string>>(new Set());
 useEffect(() => {
 const viral = posts.filter(
 (p) => (p.visualizacoes?? 0) >= 500 &&!p.aviso_500_atingido &&!notifiedRef.current.has(p.id),
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
 <div className="min-h-screen bg-background" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
 <Toaster richColors />
 <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-10" style={{ paddingTop: "env(safe-area-inset-top)" }}>
 <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
 <div className="flex min-w-0 items-center gap-3">
 <div className="h-10 w-10 shrink-0 rounded-xl overflow-hidden ring-2 ring-primary/30 bg-white flex items-center justify-center">
 {perfil?.instagram_foto_url || perfil?.url_logo? (
 <img
 src={perfil.instagram_foto_url?? perfil.url_logo?? ""}
 alt="Foto do perfil"
 className="h-full w-full object-cover"
 loading="lazy"
 />
 ): (
 <img src={logoAsset.url} alt="Planner Chico" className="h-full w-full object-contain" />
 )}
 </div>
 <div className="min-w-0">
 <h1 className="truncate text-base sm:text-lg font-bold leading-tight">Planner Chico</h1>
 <p className="hidden sm:block text-xs text-muted-foreground truncate">
 Planner de conteúdo para Odontologia: Cirurgia Bucal, Biópsias e Clínica Escola
 </p>
 </div>
 </div>
 <div className="flex items-center gap-1 sm:gap-3">
 <span className="hidden md:inline text-sm text-muted-foreground">
 {posts.length} {posts.length === 1? "publicação": "publicações"}
 </span>
 <NotificationsBell />
 <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/settings" })} aria-label="Configurações" className="h-10 w-10 sm:w-auto px-2 sm:px-3">
 <Settings className="h-4 w-4 sm:mr-1.5" aria-hidden="true" /> <span className="hidden sm:inline">Configurações</span>
 </Button>
 <Button variant="ghost" size="sm" onClick={handleSignOut} aria-label="Sair da conta" className="h-10 w-10 sm:w-auto px-2 sm:px-3">
 <LogOut className="h-4 w-4 sm:mr-1.5" aria-hidden="true" /> <span className="hidden sm:inline">Sair</span>
 </Button>
 </div>
 </div>
 </header>

 {/* Anúncios dos planners */}
 <section className="border-b" aria-labelledby="planner-anuncios-titulo">
 <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-7">
 <h2 id="planner-anuncios-titulo" className="sr-only">Anúncios dos planners</h2>
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
 <article className="planner-card">
 <div className="flex items-center gap-2 mb-1.5">
 <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
 <h3 className="text-sm font-bold">Planners simplificados</h3>
 </div>
 <p className="text-xs text-muted-foreground leading-relaxed">
 Um clique para gerar o post: tema pronto, texto e imagem em minutos.
 </p>
 </article>
 <article className="planner-card">
 <div className="flex items-center gap-2 mb-1.5">
 <Stethoscope className="h-4 w-4 text-primary" aria-hidden="true" />
 <h3 className="text-sm font-bold">Cirurgia e biópsias</h3>
 </div>
 <p className="text-xs text-muted-foreground leading-relaxed">
 Convites com linguagem acessível e foco em converter paciente em agendamento.
 </p>
 </article>
 <article className="planner-card">
 <div className="flex items-center gap-2 mb-1.5">
 <CalendarCheck className="h-4 w-4 text-primary" aria-hidden="true" />
 <h3 className="text-sm font-bold">Clínica Escola</h3>
 </div>
 <p className="text-xs text-muted-foreground leading-relaxed">
 Grade semanal de reserva, com status e estatísticas de cada atendimento.
 </p>
 </article>
 <article className="planner-card">
 <div className="flex items-center gap-2 mb-1.5">
 <PencilRuler className="h-4 w-4 text-primary" aria-hidden="true" />
 <h3 className="text-sm font-bold">Criação sem custo</h3>
 </div>
 <p className="text-xs text-muted-foreground leading-relaxed">
 Ferramentas locais de texto e imagem, com revisão manual antes de publicar.
 </p>
 </article>
 </div>
 </div>
 </section>

 <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
 <div className="mb-4"><LinkedInConnectionNotice /></div>
 {signedOut && <div role="status" className="mb-4 flex flex-wrap items-center gap-3 border border-border bg-muted p-3">
 <p className="text-sm">Entre na sua conta para visualizar e aprovar os posts salvos.</p>
 <Button variant="outline" onClick={() => navigate({ to: "/auth", search: { redirect: "/" } })}>Entrar na conta</Button>
 </div>}
 <div className="mb-4 flex flex-wrap gap-2">
 <Button onClick={() => { void load(); setPendingOnly(true); setTab("todos"); }}>
 <Check className="h-4 w-4" aria-hidden="true" /> Aprovar posts ({pendingPosts.length})
 </Button>
 <Button variant="secondary" disabled={pendingPosts.length === 0} onClick={() => setReviewAll(true)}>
 <Check className="h-4 w-4" aria-hidden="true" /> Aprovar tudo (revisar {pendingPosts.length})
 </Button>
 <ApproveAllReview ids={reviewIds} open={reviewAll} onOpenChange={setReviewAll} onDone={() => void load()} />
 <Button variant="outline" onClick={() => { void load(); setPendingOnly(false); setTab("todos"); }}>
 <LayoutGrid className="h-4 w-4" aria-hidden="true" /> Todas as publicações
 </Button>
 </div>
 <Tabs value={tab} onValueChange={setTab}>
 <div
 className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
 role="tablist"
 aria-label="Seções do planner"
 >
 <TabsList className="w-max">
 <TabsTrigger value="criar"><PlusCircle className="h-4 w-4 mr-1.5" aria-hidden="true" /> Criar</TabsTrigger>
 <TabsTrigger value="simplificado"><Sparkles className="h-4 w-4 mr-1.5" aria-hidden="true" /> Planner Simplificado Liga</TabsTrigger>
 <TabsTrigger value="simplificado-chico"><Sparkles className="h-4 w-4 mr-1.5" aria-hidden="true" /> Planner Simplificado Chico</TabsTrigger>
 <TabsTrigger value="agendamento-liga"><Stethoscope className="h-4 w-4 mr-1.5" aria-hidden="true" /> Cirurgia e Biópsias</TabsTrigger>
 <TabsTrigger value="clinica-escola"><CalendarCheck className="h-4 w-4 mr-1.5" aria-hidden="true" /> Planner Clínica Escola</TabsTrigger>
 <TabsTrigger value="semana"><CalendarDays className="h-4 w-4 mr-1.5" aria-hidden="true" /> Cronograma de 7 dias</TabsTrigger>
 <TabsTrigger value="calendario" onClick={() => { void load(); }}><CalendarIcon className="h-4 w-4 mr-1.5" aria-hidden="true" /> Calendário</TabsTrigger>
 <TabsTrigger value="todos" onClick={() => { setPendingOnly(false); void load(); }}><LayoutGrid className="h-4 w-4 mr-1.5" aria-hidden="true" /> Todas as publicações</TabsTrigger>
 <TabsTrigger value="insights"><TrendingUp className="h-4 w-4 mr-1.5" aria-hidden="true" /> Desempenho</TabsTrigger>
 <TabsTrigger value="perfil"><Settings className="h-4 w-4 mr-1.5" aria-hidden="true" /> Perfil</TabsTrigger>
 <TabsTrigger value="chaves"><KeyRound className="h-4 w-4 mr-1.5" aria-hidden="true" /> Integrações</TabsTrigger>
 <TabsTrigger value="ia"><ClipboardList className="h-4 w-4 mr-1.5" aria-hidden="true" /> Inteligência artificial</TabsTrigger>
 </TabsList>
 </div>

 <TabsContent value="criar" className="mt-6">
 <PostComposer onCreated={() => { load(); setTab("todos"); }} />
 </TabsContent>
 <TabsContent value="simplificado" className="mt-6">
 <PlannerSimplificado
 contaFixa="lactbmf.anhanguerasbo"
 storageKey="planner_simplificado_liga_v1"
 audiencia="estudantes-graduacao"
 />
 </TabsContent>
 <TabsContent value="simplificado-chico" className="mt-6">
 <PlannerSimplificado
 contaFixa="drfranciscomenezes"
 storageKey="planner_simplificado_chico_v1"
 audiencia="chico-drfm"
 />
 </TabsContent>
 <TabsContent value="agendamento-liga" className="mt-6">
 <PlannerAgendamentoTratamento />
 </TabsContent>
 <TabsContent value="clinica-escola" className="mt-6">
 <PlannerClinicaEscola />
 </TabsContent>
 <TabsContent value="semana" className="mt-6">
 <WeeklyCalendar perfil={perfil} onCreated={load} autoGenerate={autoGenWeekly} />
 </TabsContent>
 <TabsContent value="calendario" className="mt-6">
 <PostsCalendar posts={posts} onChange={load} />
 </TabsContent>
 <TabsContent value="todos" className="mt-6">
 <h2 className="mb-4 text-lg font-semibold">{pendingOnly ? "Posts aguardando aprovação" : "Todas as publicações"}</h2>
 <PostsList posts={pendingOnly ? pendingPosts : posts} onChange={load} />
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
