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

    // INTEGRAÇÃO BUFFER API
    console.log('Publishing to Buffer...')
    try {
      // 1. Buscar os perfis conectados no Buffer
      const profilesRes = await fetch('https://api.bufferapp.com/1/profiles.json', {
        headers: { 'Authorization': `Bearer ${bufferToken}` }
      })
      const profiles = await profilesRes.json()

      if (!profilesRes.ok || !Array.isArray(profiles) || profiles.length === 0) {
        console.error('Buffer profiles fetch error:', profiles)
        throw new Error('Não foi possível encontrar perfis conectados no Buffer. Verifique se seu token é válido e tem perfis ativos.')
      }

      // 2. Criar a postagem para todos os perfis (ou personalizar conforme necessário)
      const profileIds = profiles.map(p => p.id)
      
      const bufferPublishUrl = 'https://api.bufferapp.com/1/updates/create.json'
      
      // Buffer API espera x-www-form-urlencoded para este endpoint
      const params = new URLSearchParams()
      params.append('text', caption)
      profileIds.forEach(id => params.append('profile_ids[]', id))
      
      if (imageUrl) {
        // Se for imagem, o Buffer requer media[link] ou media[photo] dependendo do tipo
        // Para a maioria das redes sociais via Buffer, media[photo] funciona para imagens diretas
        params.append('media[photo]', imageUrl)
      }
      
      params.append('shorten', 'false')

      const bufferRes = await fetch(bufferPublishUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${bufferToken}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      })
      
      bufferResult = await bufferRes.json()
      
      if (!bufferRes.ok) {
        console.error('Buffer API Error:', bufferResult)
        throw new Error(`Erro na API do Buffer: ${bufferResult.message || JSON.stringify(bufferResult)}`)
      }

      console.log('Buffer success:', bufferResult)

    } catch (err) {
      console.error('Buffer processing error:', err)
      throw err
    }

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
