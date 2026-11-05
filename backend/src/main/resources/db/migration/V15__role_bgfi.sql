-- Rôle BGFI : lecture dashboard/agences, limitée aux agences BGFI.

INSERT INTO roles (code, libelle) VALUES
    ('BGFI', 'BGFI')
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
WHERE r.code = 'BGFI'
ON CONFLICT DO NOTHING;
