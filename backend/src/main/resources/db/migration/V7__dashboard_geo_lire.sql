-- Lecture référentiel geo pour les filtres pilotage (même périmètre que le tableau de bord).
INSERT INTO roles_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, p_geo.id
FROM roles_permissions AS rp
JOIN permissions AS p_dash ON p_dash.id = rp.permission_id AND p_dash.code = 'dashboard.voir'
JOIN permissions AS p_geo ON p_geo.code = 'referentiels.geo.lire'
ON CONFLICT DO NOTHING;
