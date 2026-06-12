import { useState, useCallback, type ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Sparkles, Loader2, Image as ImageIcon, Send, Check } from "lucide-react";
import { toast } from "sonner";
import { uploadPostImage } from "@/lib/storage-utils";
import { getAuthedUserId } from "@/lib/auth-utils";

type Network = "instagram" | "linkedin";
type Tipo = "Post Único" | "Carrossel";

export function PostComposer({ onCreated }: { onCreated: () => void }) {
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
      const localUrl = URL.createObjectURL(file);
      setImagem(localUrl);
      return () => URL.revokeObjectURL(localUrl);
    }
  };

  const handleSave = useCallback(async () => {
    if (saving) return;
    if (!legenda.trim()) return toast.error("Escreva uma legenda primeiro.");
    if (!fileToUpload) return toast.error("Selecione uma imagem primeiro.");
    
    setSaving(true);
    const tId = "post-saving-toast";
    toast.loading("Publicando post...", { id: tId });
    
    try {
      const userId = await getAuthedUserId();
      
      // 1. Upload imagem
      const publicUrl = await uploadPostImage(fileToUpload);
      
      // 2. Salva no banco (O Webhook do Supabase cuidará do resto)
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

      if (dbError) throw new Error(`Erro ao salvar: ${dbError.message}`);

      toast.success("Post salvo com sucesso! O sistema processará a publicação.", { id: tId });
      
      setLegenda("");
      setImagem(null);
      setFileToUpload(null);
      setFileName(null);
      onCreated();

    } catch (e: any) {
      console.error("Erro na publicação:", e);
      toast.error(e.message || "Falha na publicação. Tente novamente.", { id: tId });
    } finally {
      setSaving(false);
    }
  }, [legenda, fileToUpload, networks, tipo, saving, onCreated]);

  return (
    <Card className="p-6 space-y-6 max-w-4xl mx-auto border-zinc-200 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-zinc-800 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-500" />
          Novo Post
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
            <Label>Tipo</Label>
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
              placeholder="Digite sua legenda..."
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
                  <ImageIcon className="w-8 h-8 text-zinc-400 mb-2" />
                  <p className="text-sm text-zinc-500">Selecionar imagem</p>
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
                  <Check className="w-3 h-3" /> {fileName}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4 border-l pl-6 border-zinc-100">
          <Label>Prévia</Label>
          <div className="aspect-square w-full rounded-xl overflow-hidden border border-zinc-100 bg-zinc-50 flex items-center justify-center relative">
            {imagem ? (
              <img src={imagem} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center p-4">
                <ImageIcon className="w-12 h-12 text-zinc-200 mx-auto mb-2" />
                <p className="text-zinc-400 text-sm">Preview da imagem</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100">
        <Button variant="outline" onClick={() => onCreated()}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
          Publicar Agora
        </Button>
      </div>
    </Card>
  );
}
