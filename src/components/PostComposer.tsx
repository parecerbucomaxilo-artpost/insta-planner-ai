import { useState, useMemo, useEffect, useCallback, type ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Sparkles, X, Loader2, Plus, Wand2, Image as ImgIcon, Instagram, Linkedin, Send, Image as PictureIcon, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { uploadPostImage } from "@/lib/storage-utils";
// import { publishToLinkedIn } from "@/lib/social/linkedin-publish.functions";
// import { useServerFn } from "@tanstack/react-start";
import { getAuthedUserId } from "@/lib/auth-utils";

type Network = "instagram" | "linkedin";
type Tipo = "Post Único" | "Carrossel";
type Status = "Rascunho" | "Agendado" | "Publicado";

export function PostComposer({ onCreated }: { onCreated: () => void }) {
  // const sendLinkedIn = useServerFn(publishToLinkedIn);
  const [networks, setNetworks] = useState<Network[]>(["instagram"]);
  const [tipo, setTipo] = useState<Tipo>("Post Único");
  const [legenda, setLegenda] = useState("");
  const [imagem, setImagem] = useState<string | null>(null);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggleNetwork = (n: Network) => {
    setNetworks((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n],
    );
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileToUpload(file);
      setFileName(file.name);
      
      // Gera URL local temporária para prévia rápida
      const localUrl = URL.createObjectURL(file);
      setImagem(localUrl);

      // Limpeza automática da URL anterior se houver
      return () => URL.revokeObjectURL(localUrl);
    }
  };

  const handleSave = useCallback(async () => {
    if (saving) return;
    if (!legenda.trim()) return toast.error("Escreva uma legenda primeiro.");
    if (!fileToUpload) return toast.error("Selecione uma imagem primeiro.");
    
    setSaving(true);
    const tId = "post-saving-toast";
    toast.loading("Iniciando processo de publicação...", { id: tId });
    
    try {
      const userId = await getAuthedUserId();
      
      // 1. Upload imagem (sem retry automático no storage-utils)
      toast.loading("Enviando imagem...", { id: tId });
      let publicUrl: string;
      try {
        publicUrl = await uploadPostImage(fileToUpload);
      } catch (uploadError: any) {
        throw new Error(`Falha no upload da imagem: ${uploadError.message}`);
      }
      
      // 2. Salva no banco
      toast.loading("Salvando registro do post...", { id: tId });
      const { error: dbError } = await supabase.from("posts").insert({
        user_id: userId,
        legenda: legenda,
        url_imagem: publicUrl,
        tipo_post: tipo,
        status: "Publicado",
        postar_linkedin: networks.includes("linkedin"),
        postar_instagram: networks.includes("instagram"),
        formato_midia: "Imagem"
      } as any);

      if (dbError) throw new Error(`Erro ao salvar no banco: ${dbError.message}`);
      
      // 3. Busca Webhooks
      const { data: perfilData } = await supabase
        .from("perfil_usuario")
        .select("instagram_webhook_url, linkedin_webhook_url, webhook_url")
        .limit(1)
        .maybeSingle();

      // 4. Dispara Webhooks (sem loop de reexecução)
      for (const network of networks) {
        const webhookUrl = network === "instagram" 
          ? (perfilData?.instagram_webhook_url || perfilData?.webhook_url || "https://hook.us2.make.com/vx87y6fldoxlpq2les3vpbfj16qq61iq")
          : (perfilData?.linkedin_webhook_url || "https://hook.us2.make.com/4tics3gdoow4y02vo1rh4wcmeshu4psv");

        toast.loading(`Enviando para ${network}...`, { id: tId });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
          const response = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              texto: legenda,
              imagemUrl: publicUrl,
              plataforma: network.charAt(0).toUpperCase() + network.slice(1),
              timestamp: new Date().toISOString()
            }),
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`O servidor do ${network} respondeu com erro ${response.status}`);
          }
        } catch (webhookErr: any) {
          clearTimeout(timeoutId);
          // Falha crítica interrompe tudo
          const isTimeout = webhookErr.name === 'AbortError';
          const msg = isTimeout 
            ? `Tempo esgotado ao conectar com ${network}.` 
            : `Erro ao publicar no ${network}: ${webhookErr.message}`;
          
          toast.error(msg, { id: tId });
          setSaving(false);
          return; // Para execução imediatamente
        }
      }

      toast.success("Post publicado com sucesso! ✨", { id: tId });
      
      setLegenda("");
      setImagem(null);
      setFileToUpload(null);
      setFileName(null);
      onCreated();

    } catch (e: any) {
      console.error("Erro na publicação:", e);
      toast.error(e.message || "Erro crítico na publicação.", { id: tId });
    } finally {
      setSaving(false);
    }
  }, [legenda, fileToUpload, networks, tipo, saving, onCreated]);

  return (
    <Card className="p-6 space-y-6 max-w-4xl mx-auto border-zinc-200 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-zinc-800 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-500" />
          Criar Novo Post
        </h2>
        <div className="flex gap-2">
          {["instagram", "linkedin"].map((n) => (
            <Button
              key={n}
              variant={networks.includes(n as Network) ? "default" : "outline"}
              size="sm"
              onClick={() => toggleNetwork(n as Network)}
              className="capitalize"
            >
              {n}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de Conteúdo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Post Único">Post Único</SelectItem>
                <SelectItem value="Carrossel">Carrossel</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Legenda</Label>
            <Textarea
              placeholder="O que você quer compartilhar hoje?"
              className="min-h-[150px] resize-none"
              value={legenda}
              onChange={(e) => setLegenda(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Mídia</Label>
            <div className="flex flex-col gap-2">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-300 rounded-lg cursor-pointer hover:bg-zinc-50 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <ImgIcon className="w-8 h-8 text-zinc-400 mb-2" />
                  <p className="text-sm text-zinc-500">Clique para selecionar imagem</p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </label>
              {fileName && (
                <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                  <Check className="w-3 h-3" /> Arquivo carregado com sucesso no aplicativo
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4 border-l pl-6 border-zinc-100">
          <Label>Prévia Visual</Label>
          <div className="aspect-square w-full rounded-xl overflow-hidden border border-zinc-100 bg-zinc-50 flex items-center justify-center relative">
            {imagem ? (
              <img src={imagem} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center p-4">
                <PictureIcon className="w-12 h-12 text-zinc-200 mx-auto mb-2" />
                <p className="text-zinc-400 text-sm">Sua imagem aparecerá aqui</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100">
        <Button variant="outline" onClick={() => onCreated()}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
          Salvar Post
        </Button>
      </div>
    </Card>
  );
}
