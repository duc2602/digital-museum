ALTER TABLE "system_settings"
  DROP CONSTRAINT "system_settings_pkey",
  ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'global',
  ADD COLUMN "is_secret" BOOLEAN NOT NULL DEFAULT false,
  ADD CONSTRAINT "system_settings_pkey" PRIMARY KEY ("scope", "key");

CREATE TABLE "users" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_email_lower_key" ON "users"(lower("email"));

CREATE TABLE "roles" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

CREATE TABLE "permissions" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

CREATE TABLE "user_roles" (
  "user_id" UUID NOT NULL,
  "role_id" UUID NOT NULL,
  "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id", "role_id")
);
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

CREATE TABLE "role_permissions" (
  "role_id" UUID NOT NULL,
  "permission_id" UUID NOT NULL,
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id")
);
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

CREATE TABLE "user_sessions" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_sessions_token_hash_key" ON "user_sessions"("token_hash");
CREATE INDEX "user_sessions_user_id_revoked_at_expires_at_idx"
  ON "user_sessions"("user_id", "revoked_at", "expires_at");

CREATE TABLE "catalogs" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "catalogs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "catalogs_code_key" ON "catalogs"("code");

CREATE TABLE "terms" (
  "id" UUID NOT NULL,
  "catalog_id" UUID NOT NULL,
  "parent_id" UUID,
  "code" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "terms_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "terms_parent_not_self_check" CHECK ("parent_id" IS NULL OR "parent_id" <> "id")
);
CREATE UNIQUE INDEX "terms_catalog_id_code_key" ON "terms"("catalog_id", "code");
CREATE INDEX "terms_catalog_id_status_code_idx" ON "terms"("catalog_id", "status", "code");
CREATE INDEX "terms_parent_id_idx" ON "terms"("parent_id");

CREATE TABLE "term_translations" (
  "term_id" UUID NOT NULL,
  "locale" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  CONSTRAINT "term_translations_pkey" PRIMARY KEY ("term_id", "locale"),
  CONSTRAINT "term_translations_locale_check" CHECK ("locale" IN ('vi'))
);

CREATE TABLE "artifacts" (
  "id" UUID NOT NULL,
  "accession_number" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "artifacts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "artifacts_accession_number_key" ON "artifacts"("accession_number");
CREATE INDEX "artifacts_status_updated_at_id_idx" ON "artifacts"("status", "updated_at", "id");

CREATE TABLE "artifact_translations" (
  "artifact_id" UUID NOT NULL,
  "locale" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description_format" TEXT NOT NULL DEFAULT 'prosemirror_json',
  "description_rich" JSONB NOT NULL,
  "description_text" TEXT NOT NULL DEFAULT '',
  CONSTRAINT "artifact_translations_pkey" PRIMARY KEY ("artifact_id", "locale"),
  CONSTRAINT "artifact_translations_locale_check" CHECK ("locale" IN ('vi')),
  CONSTRAINT "artifact_translations_description_format_check"
    CHECK ("description_format" = 'prosemirror_json')
);
CREATE INDEX "artifact_translations_locale_idx" ON "artifact_translations"("locale");

CREATE TABLE "artifact_terms" (
  "artifact_id" UUID NOT NULL,
  "term_id" UUID NOT NULL,
  "assigned_by" UUID NOT NULL,
  CONSTRAINT "artifact_terms_pkey" PRIMARY KEY ("artifact_id", "term_id")
);
CREATE INDEX "artifact_terms_term_id_idx" ON "artifact_terms"("term_id");

CREATE TABLE "audit_events" (
  "id" UUID NOT NULL,
  "actor_type" TEXT NOT NULL DEFAULT 'USER',
  "actor_id" UUID,
  "action" TEXT NOT NULL,
  "resource_type" TEXT NOT NULL,
  "resource_id" UUID NOT NULL,
  "correlation_id" TEXT,
  "redacted_changes" JSONB,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_events_actor_check" CHECK (
    "actor_type" IN ('USER', 'SYSTEM', 'WORKER')
    AND (("actor_type" = 'USER' AND "actor_id" IS NOT NULL)
      OR ("actor_type" IN ('SYSTEM', 'WORKER') AND "actor_id" IS NULL))
  )
);
CREATE INDEX "audit_events_resource_type_resource_id_occurred_at_idx"
  ON "audit_events"("resource_type", "resource_id", "occurred_at");
CREATE INDEX "audit_events_actor_id_occurred_at_idx" ON "audit_events"("actor_id", "occurred_at");
CREATE INDEX "audit_events_correlation_id_idx" ON "audit_events"("correlation_id");

ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey"
  FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey"
  FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey"
  FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "terms" ADD CONSTRAINT "terms_catalog_id_fkey"
  FOREIGN KEY ("catalog_id") REFERENCES "catalogs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "terms" ADD CONSTRAINT "terms_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "terms" ADD CONSTRAINT "terms_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "term_translations" ADD CONSTRAINT "term_translations_term_id_fkey"
  FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "artifact_translations" ADD CONSTRAINT "artifact_translations_artifact_id_fkey"
  FOREIGN KEY ("artifact_id") REFERENCES "artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "artifact_terms" ADD CONSTRAINT "artifact_terms_artifact_id_fkey"
  FOREIGN KEY ("artifact_id") REFERENCES "artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "artifact_terms" ADD CONSTRAINT "artifact_terms_term_id_fkey"
  FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "artifact_terms" ADD CONSTRAINT "artifact_terms_assigned_by_fkey"
  FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_audit_event_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER audit_events_append_only
  BEFORE UPDATE OR DELETE ON "audit_events"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();
