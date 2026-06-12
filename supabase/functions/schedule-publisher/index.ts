import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MAKE_HOOK_URL = "https://hook.us2.make.com/vx87y6fldoxlpq2les3vpbfj16qq61iq"

serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Busca posts agendados para agora ou passado que ainda estão pendentes
    const { data: posts, error: fetchError } = await supabaseClient
      .from('posts')
      .select('*')
      .eq('status', 'scheduled')
      .lte('data_agendamento', new Date().toISOString())

    if (fetchError) throw fetchError

    if (!posts || posts.length === 0) {
      return new Response(JSON.stringify({ message: 'No posts to publish' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const results = []

    for (const post of posts) {
      console.log(`Processing post ${post.id}`)
      
      const platforms = []
      if (post.postar_instagram) platforms.push('instagram')
      if (post.postar_linkedin) platforms.push('linkedin')

      for (const platform of platforms) {
        const payload = {
          texto: platform === 'instagram' ? post.legenda_instagram : post.legenda_linkedin,
          url_imagem: post.url_imagem,
          rede_social: platform,
          post_id: post.id
        }

        console.log(`Sending to Make for ${platform}:`, payload)

        try {
          const makeRes = await fetch(MAKE_HOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
          
          results.push({ post_id: post.id, platform, status: makeRes.status })
        } catch (e) {
          console.error(`Error sending post ${post.id} to ${platform}:`, e)
          results.push({ post_id: post.id, platform, error: String(e) })
        }
      }

      // Atualiza o status do post para publicado
      await supabaseClient
        .from('posts')
        .update({ status: 'published' })
        .eq('id', post.id)
    }

    return new Response(JSON.stringify({ results }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in schedule-publisher:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
