ALTER TABLE "users" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

INSERT INTO "permissions" ("id", "code", "description")
VALUES (gen_random_uuid(), 'user:manage', 'Create users and manage their roles and status')
ON CONFLICT ("code") DO UPDATE SET "description" = EXCLUDED."description";

INSERT INTO "roles" ("id", "code", "name")
VALUES (gen_random_uuid(), 'EDITOR', 'Biên tập viên')
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name";

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT roles."id", permissions."id"
FROM "roles", "permissions"
WHERE roles."code" = 'ADMIN' AND permissions."code" = 'user:manage'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT roles."id", permissions."id"
FROM "roles" CROSS JOIN "permissions"
WHERE roles."code" = 'EDITOR'
  AND permissions."code" IN ('catalog:read', 'catalog:write', 'artifact:read', 'artifact:write')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
