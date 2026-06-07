import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, KeyRound, Link as LinkIcon, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;

function CopyField({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copiado!`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex gap-2">
        <textarea
          readOnly
          value={value}
          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
          className="flex-1 font-mono text-xs bg-muted p-3 rounded-md border resize-none break-all"
          rows={3}
        />
        <Button onClick={onCopy} variant="outline" size="icon" className="shrink-0">
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

export function AutomationKeys() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Chaves de Automação — Make.com / n8n / Zapier
          </CardTitle>
          <CardDescription>
            Copie estas credenciais e cole na configuração do seu robô de automação para que ele
            consiga ler e gravar dados no banco deste aplicativo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <CopyField
            label="Supabase URL"
            value={SUPABASE_URL}
            icon={<LinkIcon className="h-4 w-4 text-sky-600" />}
          />
          <CopyField
            label="Anon / Publishable Key (pública, segura para Make.com)"
            value={SUPABASE_ANON_KEY}
            icon={<KeyRound className="h-4 w-4 text-amber-600" />}
          />
          <CopyField
            label="Project Ref / ID"
            value={SUPABASE_PROJECT_ID}
            icon={<KeyRound className="h-4 w-4 text-purple-600" />}
          />

          <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-4 flex gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm space-y-2">
              <p className="font-medium text-amber-900 dark:text-amber-200">
                Service Role Key não é exibida aqui
              </p>
              <p className="text-amber-800 dark:text-amber-300">
                A <strong>Service Role Key</strong> ignora regras de segurança (RLS) e dá acesso
                total ao banco. Por segurança, ela <strong>nunca</strong> deve estar no frontend.
                Pegue-a em <em>View Backend → Project Settings → API Keys</em> e guarde apenas
                dentro do Make.com (nunca no navegador).
              </p>
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 p-4 text-sm space-y-2">
            <p className="font-medium">Como usar no Make.com</p>
            <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
              <li>No módulo Supabase do Make, cole a <strong>URL</strong> acima no campo Base URL.</li>
              <li>Cole a <strong>Anon Key</strong> no campo API Key (para operações respeitando RLS).</li>
              <li>Para escrever em qualquer tabela sem barreiras, use a Service Role Key como Bearer Token.</li>
              <li>Nome da tabela principal de posts: <code className="bg-background px-1 rounded">posts</code>.</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
