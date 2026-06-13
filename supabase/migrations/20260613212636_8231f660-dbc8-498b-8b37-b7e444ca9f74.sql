SELECT cron.schedule(
  'publicar-posts-agendados',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://insta-planner-ai.lovable.app/api/public/posts-agendados',
    headers:='{"Content-Type":"application/json"}'::jsonb,
    body:='{}'::jsonb,
    timeout_milliseconds:=120000
  );
  $$
);