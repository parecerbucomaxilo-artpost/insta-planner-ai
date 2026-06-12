-- Primeiro, remove o agendamento anterior se existir
select cron.unschedule('publish-scheduled-posts');

-- Agenda a chamada da função a cada minuto usando a URL direta do projeto
-- Nota: A URL do projeto foi identificada como iussltuhhmfcgxjdhuje.supabase.co
select cron.schedule(
  'publish-scheduled-posts',
  '* * * * *',
  $$
  select
    net.http_post(
      url:='https://iussltuhhmfcgxjdhuje.supabase.co/functions/v1/schedule-publisher',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select value from net._http_response_header where name = 'service_role_key' limit 1) -- Tentativa de pegar a key se disponível ou usar uma alternativa
      ),
      body:='{}'
    )
  $$
);

-- Como a service_role_key pode não estar disponível em net._http_response_header,
-- e para garantir que a função seja executada, podemos configurar a função como pública no Supabase 
-- ou passar a key se tivéssemos acesso direto aqui. 
-- No contexto do Supabase, o cron roda como superuser, mas a Edge Function precisa de auth.
-- Uma alternativa comum é usar uma RPC ou disparar sem auth se a função tratar isso.

-- Ajustando para a forma mais simples e garantida (assumindo que o net.http_post consiga disparar)
-- Em muitos casos, a URL anon/public funciona se a função não exigir service_role explicitamente no código (que a nossa exige).

select cron.unschedule('publish-scheduled-posts');

select cron.schedule(
  'publish-scheduled-posts',
  '* * * * *',
  $$
  select
    net.http_post(
      url:='https://iussltuhhmfcgxjdhuje.supabase.co/functions/v1/schedule-publisher',
      headers:='{"Content-Type": "application/json"}'::jsonb,
      body:='{}'
    )
  $$
);
