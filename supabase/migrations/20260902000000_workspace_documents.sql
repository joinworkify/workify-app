-- Mirrors workify-web/utils/db/migrations/0008_org_billing_schema.sql's workify_workspace_documents
-- table + 0016_workspace_documents_manual_unique.sql's partial unique index, verbatim. That
-- migration already ran against the shared prod project from workify-web's side, so this is a
-- no-op there (IF NOT EXISTS) -- it exists here purely so workify-app's local dev stack has the
-- table manuals-library needs, matching prod.
CREATE TABLE IF NOT EXISTS "workify_workspace_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "workify_organizations"("id") ON DELETE CASCADE,
  "uploaded_by" uuid NOT NULL REFERENCES auth.users(id),
  "manual_id" text,
  "filename" text NOT NULL,
  "page_count" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  CONSTRAINT "workify_workspace_documents_status_check" CHECK ("status" IN ('active', 'deleted')),
  CONSTRAINT "workify_workspace_documents_page_count_check" CHECK ("page_count" >= 0)
);

CREATE INDEX IF NOT EXISTS "workify_workspace_documents_org_active_idx"
  ON "workify_workspace_documents" ("organization_id") WHERE "status" = 'active';

ALTER TABLE "workify_workspace_documents" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "workify_workspace_documents" FROM anon, authenticated;
GRANT ALL ON "workify_workspace_documents" TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS "workify_workspace_documents_org_manual_active_key"
  ON "workify_workspace_documents" ("organization_id", "manual_id")
  WHERE "status" = 'active' AND "manual_id" IS NOT NULL;
