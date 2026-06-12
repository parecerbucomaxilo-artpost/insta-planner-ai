import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const WORKER_URL = 'https://workers.dev'

serve(async (req) => {
  // Resposta simples para OPTIONS para evitar problemas de CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Recebe o corpo da requisição do frontend
    // Esperamos as mesmas propriedades que o frontend já envia
    const body = await req.json()
    console.log('Publishing request received:', body)

    // Estrutura EXATA solicitada pelo usuário:
    // { "plataforma": "instagram", "texto": "Legenda de teste", "imagemUrl": "https://unsplash.com" }
    const payload = {
      plataforma: "instagram",
      texto: body.caption || "Legenda de teste",
      imagemUrl: body.imageUrl || "https://unsplash.com"
    }

    console.log('Sending payload to server:', payload)

    // Disparo POST simples para a URL do servidor
    // Removendo cabeçalhos complexos (mantendo apenas o básico)
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
    })

    const responseText = await res.text()
    console.log('Server response status:', res.status)
    console.log('Server response body:', responseText)

    // Retorna a resposta bruta para o frontend exibir
    return new Response(
      JSON.stringify({ 
        success: res.ok, 
        rawResponse: responseText,
        status: res.status
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      },
    )
  } catch (error) {
    console.error('Publishing error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      },
    )
  }
})
