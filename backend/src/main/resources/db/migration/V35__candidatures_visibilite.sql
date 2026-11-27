-- Menu Candidatures : ADMIN, SUPER_ADMIN, et le rôle de a.mbelu@flash.one.
-- Le traitement reste limité dans l'API à ce compte et aux SUPER_ADMIN.

DELETE FROM roles_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND p.code = 'onboarding.candidatures.lire'
  AND r.code NOT IN ('ADMIN', 'SUPER_ADMIN')
  AND r.id IS DISTINCT FROM (
    SELECT u.role_id
    FROM utilisateurs u
    WHERE lower(u.courriel) = lower('a.mbelu@flash.one')
    LIMIT 1
  );

INSERT INTO roles_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'onboarding.candidatures.lire'
WHERE r.code IN ('ADMIN', 'SUPER_ADMIN')
   OR r.id = (
     SELECT u.role_id
     FROM utilisateurs u
     WHERE lower(u.courriel) = lower('a.mbelu@flash.one')
     LIMIT 1
   )
ON CONFLICT DO NOTHING;

DELETE FROM utilisateurs_permissions up
USING utilisateurs u, permissions p
WHERE up.utilisateur_id = u.id
  AND up.permission_id = p.id
  AND p.code = 'onboarding.candidatures.lire'
  AND lower(u.courriel) IS DISTINCT FROM lower('a.mbelu@flash.one');
