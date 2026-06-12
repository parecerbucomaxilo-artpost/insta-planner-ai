import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const WORKER_URL = 'https://workers.dev'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { imageUrl, caption, plataformas } = await req.json()

    console.log('Publishing started:', { hasImage: !!imageUrl, hasCaption: !!caption })

    if (!caption) throw new Error('Legenda (texto) é obrigatória.')
    if (!imageUrl) throw new Error('URL da imagem é obrigatória.')

    const targets: Array<'instagram' | 'linkedin'> =
      Array.isArray(plataformas) && plataformas.length > 0
        ? plataformas
        : ['instagram', 'linkedin']

    const results = await Promise.all(
      targets.map(async (plataforma) => {
        try {
          const res = await fetch(WORKER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plataforma, texto: caption, imagemUrl: imageUrl }),
          })
          const text = await res.text()
          console.log(`[${plataforma}] status=${res.status} body=${text.slice(0, 200)}`)
          return { plataforma, ok: res.ok, status: res.status, response: text }
        } catch (err) {
          console.error(`[${plataforma}] fetch error`, err)
          return { plataforma, ok: false, error: err instanceof Error ? err.message : String(err) }
        }
      }),
    )

    const anyOk = results.some((r) => r.ok)

    return new Response(
      JSON.stringify({ success: anyOk, results }),
      { status: anyOk ? 200 : 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Publishing error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
