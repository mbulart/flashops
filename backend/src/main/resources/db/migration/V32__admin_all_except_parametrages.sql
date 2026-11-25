-- ADMIN = tout sauf paramétrages (et permissions de suppression).
-- Aligné V16 : sans utilisateurs/rôles/permissions/réglages/audit/référentiels admin.

INSERT INTO roles_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'ADMIN'
  AND p.code NOT IN (
    'auth.utilisateurs.lire',
    'auth.utilisateurs.ecrire',
    'auth.roles.lire',
    'auth.roles.ecrire',
    'auth.permissions.lire',
    'auth.parametres.lire',
    'auth.parametres.ecrire',
    'audit.actions.lire',
    'referentiels.geo.synchroniser',
    'referentiels.zones.ecrire',
    'onboarding.admin',
    'workflow.admin'
  )
  AND p.code NOT ILIKE '%.supprimer'
  AND p.code NOT ILIKE '%.delete'
ON CONFLICT DO NOTHING;

-- Sécurité : retirer toute perm paramétrages / suppression éventuellement réintroduite.
DELETE FROM roles_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.code = 'ADMIN'
  AND (
    p.code IN (
      'auth.utilisateurs.lire',
      'auth.utilisateurs.ecrire',
      'auth.roles.lire',
      'auth.roles.ecrire',
      'auth.permissions.lire',
      'auth.parametres.lire',
      'auth.parametres.ecrire',
      'audit.actions.lire',
      'referentiels.geo.synchroniser',
      'referentiels.zones.ecrire',
      'onboarding.admin',
      'workflow.admin'
    )
    OR p.code ILIKE '%.supprimer'
    OR p.code ILIKE '%.delete'
  );

UPDATE utilisateurs u
SET version_session = COALESCE(version_session, 0) + 1,
    modifie_le = NOW()
FROM roles r
WHERE r.id = u.role_id
  AND r.code = 'ADMIN';
