-- Rôle VAS : dashboard / agences en lecture, sans transferts (monnaie + service).

INSERT INTO roles (code, libelle) VALUES
    ('VAS', 'VAS')
ON CONFLICT (code) DO NOTHING;

INSERT INTO roles_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'auth.profil.lire',
    'dashboard.voir',
    'agences.lire',
    'referentiels.geo.lire',
    'referentiels.zones.lire'
)
WHERE r.code = 'VAS'
ON CONFLICT DO NOTHING;
