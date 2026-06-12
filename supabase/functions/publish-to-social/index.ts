import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const WORKER_URL = 'https://workers.dev'

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    console.log('Publishing request received:', body)

    const payload = {
      plataforma: "instagram",
      texto: body.caption || "Legenda de teste",
      imagemUrl: body.imageUrl || "https://unsplash.com"
    }

    console.log('Step 1: Sending initial post payload:', payload)

    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
    })

    const responseText = await res.text()
    console.log('Step 1 Response status:', res.status)
    
    let finalResponseText = responseText
    let isPublished = res.ok

    // Se o post inicial foi bem sucedido, aguarda 5 segundos e envia a confirmação
    if (res.ok) {
      console.log('Step 1 success. Waiting 5 seconds before Step 2 (publish confirmation)...')
      await delay(5000)

      const confirmPayload = { action: "publish" }
      console.log('Step 2: Sending confirmation payload:', confirmPayload)

      try {
        const confirmRes = await fetch(WORKER_URL, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(confirmPayload),
        })
        
        const confirmText = await confirmRes.text()
        console.log('Step 2 Response status:', confirmRes.status)
        console.log('Step 2 Response body:', confirmText)
        
        // Atualiza a resposta para incluir informações de ambos os passos se necessário
        finalResponseText = `Step 1: ${responseText}\nStep 2: ${confirmText}`
        isPublished = confirmRes.ok
      } catch (confirmError) {
        console.error('Step 2 (confirmation) failed:', confirmError)
        finalResponseText = `Step 1: ${responseText}\nStep 2 Error: ${confirmError instanceof Error ? confirmError.message : String(confirmError)}`
      }
    }

    return new Response(
      JSON.stringify({ 
        success: isPublished, 
        rawResponse: finalResponseText,
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
