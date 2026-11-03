import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkLinkedInConnection } from "./linkedin-status";

export const getLinkedInStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => checkLinkedInConnection(process.env['LOVABLE_API_KEY'], process.env['LINKEDIN_API_KEY']));