import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { imageUrl, caption, bufferToken } = await req.json()

    console.log('Publishing started:', { 
      hasImage: !!imageUrl, 
      hasBuffer: !!bufferToken
    })

    if (!bufferToken) {
      throw new Error('Chave API do Buffer não configurada.')
    }

    let bufferResult = null

    // REQUISIÇÃO PARA WORKERS.DEV (Conforme solicitado)
    console.log('Forwarding to workers.dev...')
    try {
      const platforms = []
      // Se tivermos redes selecionadas explicitamente no app, podemos usar elas, 
      // ou apenas enviar as duas principais se o usuário quiser simplificar.
      // Aqui vamos enviar individualmente para cada plataforma suportada pelo endpoint do usuário.
      
      const requests = ['instagram', 'linkedin'].map(plataforma => {
        return fetch('https://workers.dev', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plataforma,
            texto: caption,
            imagemUrl: imageUrl
          })
        }).catch(err => {
          console.error(`Failed to send to workers.dev for ${plataforma}:`, err)
          return null
        })
      })

      await Promise.all(requests)
      console.log('Forwarded to workers.dev successfully')
    } catch (err) {
      console.warn('Error forwarding to workers.dev (non-blocking):', err)
    }

    // INTEGRAÇÃO BUFFER API (Mantida como principal)
    console.log('Publishing to Buffer...')
    try {

    return new Response(
      JSON.stringify({ 
        success: true, 
        buffer: bufferResult 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Publishing error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
