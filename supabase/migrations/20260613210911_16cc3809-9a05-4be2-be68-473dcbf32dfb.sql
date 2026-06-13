
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='gerar-proximo-post') THEN
    PERFORM cron.unschedule('gerar-proximo-post');
  END IF;
END $$;

SELECT cron.schedule(
  'gerar-proximo-post',
  '*/10 * * * *',
  $cron$
  SELECT net.http_post(
    url:='https://insta-planner-ai.lovable.app/api/public/gerar-proximo',
    headers:='{"Content-Type":"application/json"}'::jsonb,
    body:='{}'::jsonb,
    timeout_milliseconds:=120000
  );
  $cron$
);
