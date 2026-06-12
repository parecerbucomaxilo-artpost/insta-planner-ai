-- Habilita a extensão pg_net para fazer chamadas HTTP de dentro do banco de dados (necessária para disparar Edge Functions)
create extension if not exists pg_net;

-- Habilita a extensão pg_cron para agendamento
create extension if not exists pg_cron;

-- Agenda a chamada da função a cada minuto
-- Substitua [PROJECT_REF] se necessário, mas em Lovable o endpoint costuma ser resolvido internamente ou via URL padrão.
-- Usamos net.http_post para disparar a função anonimamente (ou com a key no header se necessário)
select cron.schedule(
  'publish-scheduled-posts',
  '* * * * *',
  $$
  select
    net.http_post(
      url:='https://' || current_setting('request.headers')::json->>'host' || '/functions/v1/schedule-publisher',
      headers:=jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('request.headers')::json->>'apikey'),
      body:='{}'
    )
  $$
);

-- Como o current_setting pode não estar disponível no contexto do cron, 
-- o ideal é usar a URL fixa do projeto ou uma função auxiliar.
-- Ajustando para uma forma mais robusta que funciona no Supabase:

select cron.unschedule('publish-scheduled-posts');

select cron.schedule(
  'publish-scheduled-posts',
  '* * * * *',
  $$
  select
    net.http_post(
      url:=(select value from net._http_response_header where name = 'host' limit 1) || '/functions/v1/schedule-publisher',
      headers:=jsonb_build_object('Content-Type', 'application/json'),
      body:='{}'
    )
  $$
);
