-- Backfill organizations and memberships for users missing them, and set profiles.primary_organization_id
-- Idempotent: safe to run multiple times.

BEGIN;

-- 1) Create one organization per user who has no memberships at all
WITH candidates AS (
  SELECT p.id AS user_id
  FROM profiles p
  LEFT JOIN organization_members om ON om.user_id = p.id
  WHERE om.user_id IS NULL
),
-- Deterministic org names to allow mapping after INSERT
-- Includes a slice of the user_id to ensure uniqueness and easy join
names AS (
  SELECT c.user_id,
         ('Organization ' || substr(c.user_id::text, 1, 8))::text AS name
  FROM candidates c
),
created AS (
  INSERT INTO organizations (name)
  SELECT n.name
  FROM names n
  ON CONFLICT (slug) DO NOTHING -- in case slug trigger generates an existing slug, skip
  RETURNING id, name
)
INSERT INTO organization_members (organization_id, user_id, role)
SELECT cr.id, n.user_id, 'owner'
FROM names n
JOIN created cr ON cr.name = n.name
ON CONFLICT DO NOTHING;

-- 2) Ensure each user has a primary_organization_id
-- Prefer an organization where the user is an owner; otherwise, pick the earliest membership
WITH choice AS (
  SELECT p.id AS user_id,
         (
           SELECT om.organization_id
           FROM organization_members om
           WHERE om.user_id = p.id
           ORDER BY (CASE WHEN om.role = 'owner' THEN 0 ELSE 1 END), om.created_at ASC
           LIMIT 1
         ) AS chosen_org
  FROM profiles p
)
UPDATE profiles p
SET primary_organization_id = c.chosen_org
FROM choice c
WHERE p.id = c.user_id
  AND p.primary_organization_id IS NULL
  AND c.chosen_org IS NOT NULL;

COMMIT;
