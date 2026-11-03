import { Linkedin, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLinkedInStatus } from "@/hooks/use-linkedin-status";

export function LinkedInConnectionNotice() {
  const status = useLinkedInStatus();
  return (
    <div role="status" className="flex items-center gap-3 border border-border bg-muted p-3">
      <Linkedin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <p className="flex-1 text-sm text-muted-foreground">{status.message}</p>
      <Button variant="ghost" size="icon" aria-label="Verificar conexão do LinkedIn" title="Verificar conexão do LinkedIn" onClick={() => void status.refresh()}>
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}