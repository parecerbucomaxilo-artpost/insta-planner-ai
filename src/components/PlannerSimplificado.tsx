import { useState, useEffect, useCallback, type ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Instagram, Loader2, Trash2, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { uploadPostImage } from "@/lib/storage-utils";
import { getAuthedUserId } from "@/lib/auth-utils";
import { signPostMediaUrls } from "@/lib/storage-url";
import type { PostRow } from "@/lib/posts-types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const ACCOUNT_KEY = "planner_simplificado_conta_v1";

export function PlannerSimplificado() {
  const [conta, setConta] = useState<string>("");
  const [contaInput, setContaInput] = useState<string>("");
  const [legenda, setLegenda] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [data, setData] = useState<string>("");
  const [hora, setHora] = useState<string>("09:00");
  const [saving, setSaving] = useState(false);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const c = window.localStorage.getItem(ACCOUNT_KEY) || "";
      setConta(c);
      setContaInput(c);
    } catch { /* ignore */ }
  }, []);

  const normalize = (v: string) => v.trim().replace(/^@+/, "").toLowerCase();

  const salvarConta = () => {
    const n = normalize(contaInput);
    if (!n) return toast.error("Informe o @ da conta.");
    setConta(n);
    try { window.localStorage.setItem(ACCOUNT_KEY, n); } catch { /* ignore */ }
    toast.success(`Conta @${n} selecionada.`);
  };

  const carregar = useCallback(async () => {
    if (!conta) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("instagram_conta", conta)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      toast.error("Erro ao carregar posts.");
    } else if (data) {
      const signed = await Promise.all((data as unknown as PostRow[]).map(signPostMediaUrls));
      setPosts(signed as PostRow[]);
    }
    setLoading(false);
  }, [conta]);

  useEffect(() => { carregar(); }, [carregar]);

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setPreview(URL.createObjectURL(f)); }
  };

  const salvar = async () => {
    if (!conta) return toast.error("Selecione uma conta do Instagram primeiro.");
    if (!legenda.trim()) return toast.error("Escreva uma legenda.");
    if (!file) return toast.error("Selecione uma imagem.");
    setSaving(true);
    try {
      const uid = await getAuthedUserId();
      if (!uid) throw new Error("Você precisa estar logado.");
      const url = await uploadPostImage(file, uid);

      let agendamento: string | null = null;
      if (data) {
        const [hh, mm] = hora.split(":").map(Number);
        const d = new Date(data);
        d.setHours(hh || 9, mm || 0, 0, 0);
        if (d.getTime() < Date.now()) throw new Error("A data/hora deve estar no futuro.");
        agendamento = d.toISOString();
      }

      const { error } = await supabase.from("posts").insert({
        user_id: uid,
        tipo_post: "Post Único",
        legenda,
        url_imagem: url,
        postar_instagram: true,
        postar_linkedin: false,
        status: agendamento ? "Agendado" : "Rascunho",
        data_agendamento: agendamento,
        estilo_layout: "Padrão",
        instagram_conta: conta,
      } as any);
      if (error) throw error;

      toast.success(agendamento ? "Post agendado!" : "Rascunho salvo!");
      setLegenda(""); setFile(null); setPreview(null); setData(""); setHora("09:00");
      carregar();
    } catch (e: any) {
      toast.error(e.message || "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const excluir = async (id: string) => {
    if (!confirm("Excluir este post?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Excluído."); carregar(); }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card className="p-5 space-y-3">
        <Label className="flex items-center gap-2 text-sm font-semibold">
          <Instagram className="w-4 h-4" /> Conta do Instagram
        </Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">@</span>
            <Input
              value={contaInput}
              onChange={(e) => setContaInput(e.target.value)}
              placeholder="minha_nova_conta"
              className="pl-7"
            />
          </div>
          <Button onClick={salvarConta}>Usar esta conta</Button>
        </div>
        {conta && (
          <p className="text-xs text-zinc-500">
            Filtro ativo: <Badge variant="secondary">@{conta}</Badge>
          </p>
        )}
      </Card>

      {conta && (
        <>
          <Card className="p-5 space-y-4">
            <h3 className="text-base font-semibold">Novo post para @{conta}</h3>
            <div className="space-y-2">
              <Label>Imagem</Label>
              <Input type="file" accept="image/*" onChange={onFile} />
              {preview && <img src={preview} alt="Prévia" className="rounded-md max-h-64 object-cover" />}
            </div>
            <div className="space-y-2">
              <Label>Legenda</Label>
              <Textarea rows={5} value={legenda} onChange={(e) => setLegenda(e.target.value)} placeholder="Escreva a legenda..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Hora</Label>
                <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
              </div>
            </div>
            <Button onClick={salvar} disabled={saving} className="w-full">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CalendarClock className="w-4 h-4 mr-2" />}
              {data ? "Agendar post" : "Salvar rascunho"}
            </Button>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold">Publicações de @{conta}</h3>
              <span className="text-xs text-zinc-500">{posts.length} {posts.length === 1 ? "post" : "posts"}</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-8 text-zinc-400">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : posts.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-6">Nenhum post ainda.</p>
            ) : (
              <ul className="space-y-3">
                {posts.map((p) => (
                  <li key={p.id} className="flex gap-3 border rounded-md p-3">
                    {p.url_imagem && (
                      <img src={p.url_imagem} alt="" className="w-16 h-16 rounded object-cover shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm line-clamp-2">{p.legenda || "(sem legenda)"}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500">
                        <Badge variant="outline">{p.status}</Badge>
                        {p.data_agendamento && (
                          <span>{format(new Date(p.data_agendamento), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => excluir(p.id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
