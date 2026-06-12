import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MAKE_HOOK_URL = "https://hook.us2.make.com/vx87y6fldoxlpq2les3vpbfj16qq61iq"

serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Busca posts agendados para agora ou passado que ainda estão com status 'scheduled'
    const { data: posts, error: fetchError } = await supabaseClient
      .from('posts')
      .select('*')
      .eq('status', 'scheduled')
      .lte('data_agendamento', new Date().toISOString())

    if (fetchError) throw fetchError

    if (!posts || posts.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhum post para publicar no momento.' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const results = []

    for (const post of posts) {
      console.log(`Processando post agendado: ${post.id}`)
      
      const platforms = []
      if (post.postar_instagram) platforms.push('instagram')
      if (post.postar_linkedin) platforms.push('linkedin')

      // Se não houver plataforma marcada, ignoramos ou poderíamos ter uma padrão
      if (platforms.length === 0) {
        console.log(`Post ${post.id} não possui plataformas de destino selecionadas.`)
        continue
      }

      for (const platform of platforms) {
        // Conforme solicitado: texto do post, url da imagem/mídia e a rede social de destino
        const payload = {
          texto: platform === 'instagram' ? (post.legenda_instagram || post.legenda) : (post.legenda_linkedin || post.legenda),
          url_midia: post.url_imagem,
          rede_social: platform
        }

        console.log(`Enviando para o Make (${platform}):`, payload)

        try {
          const makeRes = await fetch(MAKE_HOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
          
          const responseText = await makeRes.text()
          results.push({ post_id: post.id, platform, status: makeRes.status, response: responseText })
        } catch (e) {
          console.error(`Erro ao enviar post ${post.id} para ${platform}:`, e)
          results.push({ post_id: post.id, platform, error: String(e) })
        }
      }

      // Atualiza o status do post para 'published' para evitar re-processamento
      const { error: updateError } = await supabaseClient
        .from('posts')
        .update({ status: 'published' })
        .eq('id', post.id)
      
      if (updateError) {
        console.error(`Erro ao atualizar status do post ${post.id}:`, updateError)
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Erro na execução da função schedule-publisher:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
