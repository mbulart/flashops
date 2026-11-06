-- Super admin : accès complet. ADMIN : ops (dashboard, agences), sans paramétrages.

INSERT INTO roles (code, libelle) VALUES
    ('SUPER_ADMIN', 'Super administrateur')
ON CONFLICT (code) DO UPDATE SET libelle = EXCLUDED.libelle;

INSERT INTO roles_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'SUPER_ADMIN'
ON CONFLICT DO NOTHING;

DELETE FROM roles_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.code = 'ADMIN'
  AND p.code IN (
    'auth.utilisateurs.lire',
    'auth.utilisateurs.ecrire',
    'auth.roles.lire',
    'auth.roles.ecrire',
    'auth.permissions.lire',
    'auth.parametres.lire',
    'auth.parametres.ecrire',
    'audit.actions.lire',
    'referentiels.geo.synchroniser',
    'referentiels.zones.ecrire'
  );
