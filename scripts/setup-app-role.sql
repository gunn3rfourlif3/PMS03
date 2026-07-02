-- Least-privileged application role. Run ONCE as the owner/superuser (pms):
--   Get-Content scripts/setup-app-role.sql | docker compose exec -T postgres psql -U pms -d pms
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pms_app') THEN
    CREATE ROLE pms_app LOGIN PASSWORD 'pms_app'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO pms_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pms_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pms_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO pms_app;

-- Future migration objects (created by pms) are auto-granted to pms_app:
ALTER DEFAULT PRIVILEGES FOR ROLE pms IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pms_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pms IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO pms_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pms IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO pms_app;

SELECT 'pms_app ready; superuser=' || rolsuper || ' bypassrls=' || rolbypassrls
FROM pg_roles WHERE rolname = 'pms_app';
