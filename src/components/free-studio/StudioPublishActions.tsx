import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Send, Save, CalendarClock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { uploadPostImage } from "@/lib/storage-utils";
import { salvarPostInedito } from "@/lib/post-guard";
import { approvePost } from "@/lib/ai-post.functions";
import { getPublicationDestination } from "@/lib/publication-destination.functions";
import { getLinkedInStatus } from "@/lib/social/linkedin-status.functions";
import { PERFIS } from "@/lib/studio-profiles";
import { POST_REVIEW_CHANGED } from "@/lib/post-review";
import { executarPublicacaoStudio, type StudioContent, type StudioAction, type StudioDestination, type PublishResult } from "@/lib/studio-publication";

export function StudioPublishActions({ content }: { content: StudioContent }) {
  const navigate = useNavigate();
  const publish = useServerFn(approvePost);
  const meta = useServerFn(getPublicationDestination);
  const linkedin = useServerFn(getLinkedInStatus);
  const [open, setOpen] = useState(false);
  const [acao, setAcao] = useState<StudioAction>("publicar");
  const [destino, setDestino] = useState<StudioDestination>({ canal: content.rede, conta: "", conectado: false });
  const [contas, setContas] = useState<string[]>([]);
  const [quando, setQuando] = useState("");
  const [texto, setTexto] = useState(content.texto);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState("");
  const [link, setLink] = useState("");
  const [visto, setVisto] = useState(false);
  const [loaded, setLoaded] = useState<string[]>([]);
  const saved = useRef<string | undefined>(undefined);
  const lock = useRef(false);
  const fingerprint = JSON.stringify([content, texto, destino.canal, destino.conta]);
  useEffect(() => { saved.current = undefined; setResultado(""); setLink(""); }, [fingerprint]);
  useEffect(() => { setTexto(content.texto); setVisto(false); setLoaded([]); }, [content.texto, content.imagens]);

  const abrir = async (a: StudioAction) => {
    setAcao(a); setOpen(true); setErro(""); setVisto(false); setResultado("");
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw new Error("Entre na sua conta para salvar, agendar ou publicar. Conteúdo mantido no Estúdio.");
      const { data: rows, error: e } = await supabase.from("perfil_usuario").select("instagram_arroba,arroba_usuario").eq("user_id", data.user.id);
      if (e) throw e;
      setContas([...new Set((rows ?? []).map(r => (r.instagram_arroba || r.arroba_usuario).replace(/^@+/, "").toLowerCase()).filter(Boolean))]);
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível carregar suas contas."); }
  };

  const executar = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setErro("");
    try {
      const c = { ...content, texto };
      const out = await executarPublicacaoStudio({
        autenticar: async () => {
          const { data, error } = await supabase.auth.getUser();
          if (error || !data.user) throw new Error("Sessão inválida. Entre novamente; nada foi enviado.");
          return data.user.id;
        },
        verificar: async d => {
          if (d.canal === "instagram") {
            if (!contas.includes(d.conta)) throw new Error("Escolha uma conta que pertence à sua sessão.");
            const r = await meta({ data: { conta: d.conta } });
            return { ...d, conectado: r.hasMeta };
          }
          if (d.canal === "linkedin") {
            const r = await linkedin();
            if (!r.connected) throw new Error(r.message);
            return { ...d, conectado: true };
          }
          return { ...d, conectado: false };
        },
        upload: async (src, i, uid) => {
          if (!src.startsWith("data:image/") && !src.startsWith("blob:")) throw new Error("Mídia não é uma imagem local selecionada do Estúdio.");
          const res = await fetch(src);
          if (!res.ok) throw new Error("Não foi possível ler a imagem selecionada.");
          const blob = await res.blob();
          return uploadPostImage(new File([blob], `studio-${crypto.randomUUID()}-${i + 1}.jpg`, { type: blob.type }), uid);
        },
        salvar: (uid, row) => salvarPostInedito(supabase, uid, row),
        agendar: async (id, uid, date) => {
          const { data, error } = await supabase.from("posts").update({ status: "Agendado", data_agendamento: date }).eq("id", id).eq("user_id", uid).in("status", ["Rascunho", "Erro"]).select("id").single();
          if (error || !data) throw new Error("Não foi possível agendar o rascunho. Nenhum envio confirmado.");
        },
        publicar: id => publish({ data: { id, acao: "publicar" } }) as Promise<PublishResult>,
      }, c, { ...destino, conectado: destino.canal !== "google" && (destino.canal === "linkedin" || !!destino.conta) }, acao, quando ? new Date(quando).toISOString() : undefined, saved.current);
      saved.current = out.id;
      const at = new Date().toLocaleString("pt-BR");
      if (out.estado === "publicado") {
        const r = out.retorno;
        setResultado(`Publicação confirmada · ${destino.canal} · ${destino.canal === "instagram" ? "@" + destino.conta : "membro da conexão LinkedIn"} · ${at} · identificador: ${r?.instagram?.externalId || r?.linkedin?.ugcId || "não retornado"} · post ${out.id}`);
        setLink(r?.linkedin?.shareUrl ?? "");
      } else setResultado(`${out.estado === "agendado" ? "Agendado para " + new Date(quando).toLocaleString("pt-BR") + " — envio ainda não ocorreu" : "Rascunho salvo"} · ${destino.canal} · post ${out.id}`);
      window.dispatchEvent(new Event(POST_REVIEW_CHANGED));
    } catch (e) {
      if (e && typeof e === "object" && "salvoId" in e && typeof e.salvoId === "string") saved.current = e.salvoId;
      setErro(e instanceof Error ? e.message : "Falha. Conteúdo preservado para nova tentativa.");
    } finally { setBusy(false); lock.current = false; }
  };

  return <div className="space-y-2 border-t pt-3">
    <div className="flex flex-wrap gap-2">
      <Button disabled={busy || (!content.texto.trim() && !content.imagens.length)} onClick={() => void abrir("publicar")}><Send className="mr-1.5 h-4 w-4" />Publicar</Button>
      <Button variant="outline" onClick={() => void abrir("rascunho")} disabled={busy || (!content.texto.trim() && !content.imagens.length)}><Save className="mr-1.5 h-4 w-4" />Salvar rascunho</Button>
      <Button variant="outline" onClick={() => void abrir("agendar")} disabled={busy || (!content.texto.trim() && !content.imagens.length)}><CalendarClock className="mr-1.5 h-4 w-4" />Agendar</Button>
    </div>
    <Dialog open={open} onOpenChange={o => { if (!busy) setOpen(o); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{acao === "publicar" ? "Publicar — confirmar envio" : acao === "agendar" ? "Agendar publicação" : "Salvar rascunho"}</DialogTitle><DialogDescription>Perfil editorial: {PERFIS[content.perfil].nome}. A conta de destino é escolhida separadamente. Publicar envia conteúdo visível externamente; agendar autoriza envio futuro. Nenhuma geração envia automaticamente.</DialogDescription></DialogHeader>
        <Label htmlFor="studio-canal">Canal</Label>
        <select id="studio-canal" className="h-10 rounded-md border bg-background px-2" disabled={busy || !!resultado} value={destino.canal} onChange={e => setDestino({ canal: e.target.value as StudioDestination["canal"], conta: "", conectado: false })}>
          <option value="instagram">Instagram</option><option value="linkedin">LinkedIn — membro da conexão existente</option><option value="google">Google Business — somente rascunho no Estúdio</option>
        </select>
        {destino.canal === "instagram" && <><Label htmlFor="studio-conta">Conta social de destino</Label><select id="studio-conta" className="h-10 rounded-md border bg-background px-2" value={destino.conta} disabled={busy || !!resultado} onChange={e => setDestino(d => ({ ...d, conta: e.target.value }))}><option value="">Selecione uma conta sua</option>{contas.map(c => <option key={c} value={c}>@{c}</option>)}</select></>}
        {destino.canal === "linkedin" && <p className="text-sm text-muted-foreground">Destino: membro autorizado na conexão LinkedIn existente, não o perfil editorial. Esta integração não permite escolher outra conta aqui.</p>}
        {destino.canal === "google" && <p className="text-sm text-destructive">A automação atual usa assinatura/CTA fixos do Chico e não confirma a publicação final. Somente rascunho; envio bloqueado no Estúdio.</p>}
        <Label htmlFor="studio-envio-texto">Texto que será enviado</Label><Textarea id="studio-envio-texto" rows={5} value={texto} disabled={busy || !!resultado} onChange={e => setTexto(e.target.value)} />
        <p className="text-sm">{content.formato} · {content.imagens.length} imagem(ns) selecionada(s) · Tema: {content.tema}</p>
        <div className="flex gap-2 overflow-x-auto">{content.imagens.map((src, i) => <img key={src} src={src} alt={`Mídia de envio ${i + 1}`} className="h-40 w-auto shrink-0 rounded border" onLoad={() => setLoaded(s => s.includes(src) ? s : [...s, src])} onError={() => setErro(`Imagem ${i + 1} não carregou; envio bloqueado.`)} />)}</div>
        {acao === "agendar" && <><Label htmlFor="studio-quando">Data e hora local</Label><Input id="studio-quando" type="datetime-local" value={quando} disabled={busy || !!resultado} onChange={e => setQuando(e.target.value)} /></>}
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={visto} disabled={busy} onChange={e => setVisto(e.target.checked)} />Revisei o texto, a mídia e o destino; confirmo esta ação.</label>
        {erro && <p role="alert" className="text-sm text-destructive">{erro} O conteúdo permanece no Estúdio.</p>}
        {resultado && <p role="status" className="break-words text-sm">{resultado}</p>}
        {link && <a className="text-sm underline" href={link} target="_blank" rel="noreferrer">Abrir publicação no LinkedIn</a>}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void executar()} disabled={busy || !visto || !!resultado || (acao !== "rascunho" && (destino.canal === "google" || content.imagens.some(src => !loaded.includes(src))))}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{acao === "publicar" ? "Publicar agora" : acao === "agendar" ? "Confirmar agendamento" : "Confirmar rascunho"}</Button>
          <Button variant="outline" disabled={busy} onClick={() => navigate({ to: "/settings" })}>Conexões existentes</Button>
          <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>;
}