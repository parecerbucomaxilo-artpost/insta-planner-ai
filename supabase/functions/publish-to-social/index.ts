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
    const { imageUrl, caption, instagramToken, instagramUserId, linkedInToken, linkedInUrn } = await req.json()

    console.log('Publishing started:', { 
      hasImage: !!imageUrl, 
      hasInsta: !!(instagramToken && instagramUserId), 
      hasLinkedIn: !!(linkedInToken && linkedInUrn) 
    })

    let instaResult = null
    let linkedInResult = null

    // 1. INTEGRAÇÃO INSTAGRAM GRAPH API
    if (instagramToken && instagramUserId) {
      console.log('Publishing to Instagram...')
      // Etapa A: Criar o container do post (Upload da Imagem)
      const instaContainerUrl = `https://graph.facebook.com/v19.0/${instagramUserId}/media`
      const containerRes = await fetch(instaContainerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          caption: caption,
          access_token: instagramToken
        })
      })
      const containerData = await containerRes.json()

      if (!containerRes.ok) {
        console.error('Instagram Container Error:', containerData)
        throw new Error(`Erro no Container do Instagram: ${JSON.stringify(containerData)}`)
      }

      // Etapa B: Publicar o container criado
      const instaPublishUrl = `https://graph.facebook.com/v19.0/${instagramUserId}/media_publish`
      const publishRes = await fetch(instaPublishUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerData.id,
          access_token: instagramToken
        })
      })
      instaResult = await publishRes.json()
      
      if (!publishRes.ok) {
        console.error('Instagram Publish Error:', instaResult)
      } else {
        console.log('Instagram Publish Success')
      }
    }

    // 2. INTEGRAÇÃO LINKEDIN API (Posts API)
    if (linkedInToken && linkedInUrn) {
      console.log('Publishing to LinkedIn...')
      const linkedInUrl = 'https://api.linkedin.com/v2/posts'
      
      const linkedInBody = {
        author: linkedInUrn,
        commentary: caption,
        visibility: 'PUBLIC',
        distribution: {
          feedDistribution: 'MAIN_FEED',
          targetEntities: [],
          thirdPartyDistributionChannels: []
        },
        content: {
          media: {
            title: 'Post Image',
            id: imageUrl
          }
        }
      }

      const linkedInRes = await fetch(linkedInUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${linkedInToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
          'Content-Type': 'application/json',
          'LinkedIn-Version': '202401'
        },
        body: JSON.stringify(linkedInBody)
      })
      
      linkedInResult = await linkedInRes.json()
      
      if (!linkedInRes.ok) {
        console.error('LinkedIn Error:', linkedInResult)
      } else {
        console.log('LinkedIn Success')
      }
    }

    return new Response(
      JSON.stringify({ success: true, instagram: instaResult, linkedIn: linkedInResult }),
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
