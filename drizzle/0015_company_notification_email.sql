-- IF NOT EXISTS porque la columna llegó a producción vía `drizzle-kit push`
-- antes de existir esta migración: allí el ALTER es un no-op y en una base
-- limpia crea la columna. Sin él, el arranque del contenedor fallaría.
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "notification_email" text;