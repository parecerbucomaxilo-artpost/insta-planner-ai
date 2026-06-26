import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const PayloadSchema = z.object({
  post_id: z.string().uuid(),
  ig_media_id: z.string().optional(),
  status: z.enum(['Publicado', 'Erro']).optional(),
  erro: z.string().optional(),
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  })
}

export const Route = createFileRoute('/api/public/confirmar-publicado')({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
      }),
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET
        const provided =
          request.headers.get('x-webhook-secret') ??
          request.headers.get('x-cron-secret') ??
          new URL(request.url).searchParams.get('secret')

        if (!secret || provided !== secret) {
          return jsonResponse({ error: 'unauthorized' }, 401)
        }

        let raw: unknown
        try {
          raw = await request.json()
        } catch {
          return jsonResponse({ error: 'invalid_json' }, 400)
        }

        const parsed = PayloadSchema.safeParse(raw)
        if (!parsed.success) {
          return jsonResponse({ error: 'invalid_payload', issues: parsed.error.issues }, 400)
        }

        const { post_id, ig_media_id, status, erro } = parsed.data
        const novoStatus = status ?? 'Publicado'

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

        const update: {
          status: string
          updated_at: string
          prompt_ia?: string
        } = {
          status: novoStatus,
          updated_at: new Date().toISOString(),
        }
        if (novoStatus === 'Publicado' && ig_media_id) {
          update.prompt_ia = `confirmado_make [ig_media_id:${ig_media_id}]`
        }
        if (erro) update.prompt_ia = `erro_make: ${erro}`

        const { error } = await supabaseAdmin
          .from('posts')
          .update(update)
          .eq('id', post_id)

        if (error) {
          return jsonResponse({ error: 'db_error', detail: error.message }, 500)
        }

        return jsonResponse({ ok: true, post_id, status: novoStatus })
      },
    },
  },
})
