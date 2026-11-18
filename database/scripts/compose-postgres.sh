#!/bin/sh
set -eu
: "${HAMSIR_APP_PASSWORD:?Provide HAMSIR_APP_PASSWORD in Compose}"
psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres <<'SQL'
\getenv runtime_password HAMSIR_APP_PASSWORD
CREATE ROLE hamsir_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD :'runtime_password';
CREATE DATABASE hamsir_crm_test;
SQL
for database in hamsir_crm_dev hamsir_crm_test; do
  psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$database" <<'SQL'
GRANT USAGE ON SCHEMA public TO hamsir_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hamsir_app;
SQL
done
