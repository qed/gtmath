-- Enable pg_cron and schedule daily compounding
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Compound HB at midnight UTC daily
SELECT cron.schedule('compound-daily', '0 0 * * *', 'SELECT compound_daily()');
