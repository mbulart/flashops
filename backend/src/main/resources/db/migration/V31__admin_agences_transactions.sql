-- Administrateur (ADMIN) : accès Agences + Transactions (lecture/écriture),
-- sans permissions de suppression ni paramétrages.

INSERT INTO permissions (code, libelle, module) VALUES
    ('transactions.lire', 'Transactions — lecture', 'transactions')
ON CONFLICT (code) DO NOTHING;

-- Ne pas créer / ne pas accorder agences.supprimer ni transactions.supprimer.

-- ADMIN : agences + transactions + dashboard + produits pilotage
INSERT INTO roles_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'ADMIN'
  AND (
    p.code IN (
      'auth.profil.lire',
      'dashboard.voir',
      'agences.lire',
      'agences.ecrire',
      'transactions.lire',
      'referentiels.geo.lire',
      'referentiels.zones.lire'
    )
    OR p.code LIKE 'pilotage.produit.%'
  )
  AND p.code NOT ILIKE '%.supprimer'
  AND p.code NOT ILIKE '%.delete'
ON CONFLICT DO NOTHING;

-- Tout rôle avec dashboard.voir peut aussi lire les transactions (compat menu).
INSERT INTO roles_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, p_tx.id
FROM roles_permissions rp
JOIN permissions p_dash ON p_dash.id = rp.permission_id AND p_dash.code = 'dashboard.voir'
JOIN permissions p_tx ON p_tx.code = 'transactions.lire'
ON CONFLICT DO NOTHING;

-- Forcer rechargement session des comptes ADMIN.
UPDATE utilisateurs u
SET version_session = COALESCE(version_session, 0) + 1,
    modifie_le = NOW()
FROM roles r
WHERE r.id = u.role_id
  AND r.code = 'ADMIN';
