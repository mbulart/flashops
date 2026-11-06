-- Permissions dynamiques par produit (pilotage.produit.<slug>) + grants utilisateur.

CREATE TABLE IF NOT EXISTS utilisateurs_permissions (
    utilisateur_id INT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    permission_id  INT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (utilisateur_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_utilisateurs_permissions_permission
    ON utilisateurs_permissions (permission_id);

-- Une permission par module produit distinct (fallback sur le nom produit).
INSERT INTO permissions (code, libelle, module)
SELECT
    left('pilotage.produit.' || lower(regexp_replace(slug, '[^A-Za-z0-9]+', '_', 'g')), 80),
    left('Produit — ' || slug, 200),
    'pilotage'
FROM (
    SELECT DISTINCT
        upper(btrim(coalesce(nullif(btrim(module), ''), nullif(btrim(produit), ''), ''))) AS slug
    FROM pilotage.dim_produit
    WHERE produit_id <> 0
) AS s
WHERE slug <> ''
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, libelle, module) VALUES
    ('pilotage.produit.flash_transfer', 'Produit — Flash Transfer', 'pilotage')
ON CONFLICT (code) DO NOTHING;

-- Super admin : toutes les permissions produit.
INSERT INTO roles_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'SUPER_ADMIN'
  AND p.code LIKE 'pilotage.produit.%'
ON CONFLICT DO NOTHING;

-- Benie Nzeko : Flash Transfer (en plus de VAS monnaie/service).
INSERT INTO utilisateurs_permissions (utilisateur_id, permission_id)
SELECT u.id, p.id
FROM utilisateurs u
CROSS JOIN permissions p
WHERE lower(u.courriel) = 'bnzeko@flash.one'
  AND p.code = 'pilotage.produit.flash_transfer'
ON CONFLICT DO NOTHING;
