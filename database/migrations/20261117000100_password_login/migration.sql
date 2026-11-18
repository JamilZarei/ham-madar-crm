CREATE TABLE "password_credential" (
  "user_id" UUID NOT NULL PRIMARY KEY REFERENCES "user_account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "password_hash" TEXT NOT NULL
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hamsir_app') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE "password_credential" TO hamsir_app;
  END IF;
END
$$;
