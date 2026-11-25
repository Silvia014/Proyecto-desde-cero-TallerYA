-- Run on Supabase, where pg_cron is available. Local Compose uses api.jobs.
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule('tallerya-expire-bookings', '* * * * *', $job$
  DO $worker$
  DECLARE clock bigint := floor(extract(epoch FROM now()))::bigint;
  BEGIN
    PERFORM pg_advisory_xact_lock(741092801, 1);
    UPDATE tallerya.bookings SET status='expired'
    WHERE (status='payment' AND deadline<=clock)
       OR (status='hold' AND workshop IN (
          SELECT id FROM tallerya.workshops WHERE starts<clock+86400
       ));
    DELETE FROM tallerya.events WHERE happened<clock-90*86400;
  END
  $worker$;
$job$);
