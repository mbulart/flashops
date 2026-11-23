-- Produit VAS Bleusat (même catégorie TV que Canal+ / StarTimes / EasyTV).

INSERT INTO pilotage.dim_produit (famille, module, produit, ecran, domaine, partenaire)
SELECT 'vas', 'BLUESAT', 'BLUESAT', 'ReportingBluesat', 'service', ''
WHERE NOT EXISTS (
  SELECT 1
  FROM pilotage.dim_produit
  WHERE module = 'BLUESAT'
    AND produit = 'BLUESAT'
    AND ecran = 'ReportingBluesat'
    AND coalesce(partenaire, '') = ''
);

INSERT INTO permissions (code, libelle, module)
VALUES ('pilotage.produit.bluesat', 'Produit — Bleusat', 'pilotage')
ON CONFLICT (code) DO NOTHING;

INSERT INTO roles_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'SUPER_ADMIN'
  AND p.code = 'pilotage.produit.bluesat'
ON CONFLICT DO NOTHING;

-- Référentiel candidature SAG : garder Bleusat aligné avec le produit pilotage.
INSERT INTO onboarding.services (code, libelle, famille, ordre)
VALUES ('BLUESAT', 'Bleusat', 'Abonnements télévisuels', 20)
ON CONFLICT (code) DO UPDATE
SET libelle = EXCLUDED.libelle,
    famille = EXCLUDED.famille,
    ordre = EXCLUDED.ordre,
    actif = TRUE;
