import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: () => {
    // Autenticação temporariamente desativada a pedido do usuário
    return { user: { id: "temp-user" } };
  },
  component: () => <Outlet />,
});
