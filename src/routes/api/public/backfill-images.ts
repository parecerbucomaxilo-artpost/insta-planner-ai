import { createFileRoute } from "@tanstack/react-router";
import { backfillMissingImages } from "@/lib/backfill-images.functions";

export const Route = createFileRoute("/api/public/backfill-images")({
  server: {
    handlers: {
      POST: async () => {
        const r = await backfillMissingImages();
        return new Response(JSON.stringify(r), { headers: { "Content-Type": "application/json" } });
      },
      GET: async () => {
        const r = await backfillMissingImages();
        return new Response(JSON.stringify(r), { headers: { "Content-Type": "application/json" } });
      },
    },
  },
});
