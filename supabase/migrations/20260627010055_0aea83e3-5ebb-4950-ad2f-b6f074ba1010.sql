DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'publicar-agendados-linkedin') THEN
    PERFORM cron.unschedule('publicar-agendados-linkedin');
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'publicar-posts-agendados') THEN
    PERFORM cron.unschedule('publicar-posts-agendados');
  END IF;
END $$;

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