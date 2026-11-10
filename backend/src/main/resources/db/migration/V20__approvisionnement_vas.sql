-- Approvisionnement VAS : demandes de recharge Mobile Money + historique des consommations.

INSERT INTO permissions (code, libelle, module) VALUES
    ('approvisionnement.vas.lire', 'Approvisionnement VAS — lecture', 'approvisionnement'),
    ('approvisionnement.vas.ecrire', 'Approvisionnement VAS — écriture', 'approvisionnement')
ON CONFLICT (code) DO NOTHING;

-- SUPER_ADMIN : toutes les permissions d'approvisionnement.
INSERT INTO roles_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'SUPER_ADMIN'
  AND p.code LIKE 'approvisionnement.vas.%'
ON CONFLICT DO NOTHING;

-- Rôle VAS : lecture + écriture.
INSERT INTO roles_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'VAS'
  AND p.code IN ('approvisionnement.vas.lire', 'approvisionnement.vas.ecrire')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS demandes_approvisionnement_vas (
    id              BIGSERIAL PRIMARY KEY,
    date_reference  DATE NOT NULL,
    statut          VARCHAR(30) NOT NULL DEFAULT 'brouillon',
    commentaire     TEXT,
    cree_par        INT REFERENCES utilisateurs(id) ON DELETE SET NULL,
    cree_le         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    modifie_le      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT demandes_approvisionnement_vas_statut_chk
      CHECK (statut IN ('brouillon', 'soumise', 'validee', 'payee', 'annulee'))
);

CREATE INDEX IF NOT EXISTS idx_demandes_appro_vas_date
    ON demandes_approvisionnement_vas (date_reference DESC);

CREATE INDEX IF NOT EXISTS idx_demandes_appro_vas_cree_le
    ON demandes_approvisionnement_vas (cree_le DESC);

CREATE TABLE IF NOT EXISTS lignes_demande_approvisionnement_vas (
    id                  BIGSERIAL PRIMARY KEY,
    demande_id          BIGINT NOT NULL REFERENCES demandes_approvisionnement_vas(id) ON DELETE CASCADE,
    produit_id          INT NOT NULL,
    operateur           VARCHAR(120) NOT NULL,
    produit_libelle     VARCHAR(200) NOT NULL,
    devise              VARCHAR(10) NOT NULL,
    date_reference      DATE NOT NULL,
    j1_debut            DATE NOT NULL,
    j1_fin              DATE NOT NULL,
    j2_debut            DATE NOT NULL,
    j2_fin              DATE NOT NULL,
    depots_j1           NUMERIC(18, 2) NOT NULL DEFAULT 0,
    retraits_j1         NUMERIC(18, 2) NOT NULL DEFAULT 0,
    consommation_j1     NUMERIC(18, 2) NOT NULL DEFAULT 0,
    depots_j2           NUMERIC(18, 2) NOT NULL DEFAULT 0,
    retraits_j2         NUMERIC(18, 2) NOT NULL DEFAULT 0,
    consommation_j2     NUMERIC(18, 2) NOT NULL DEFAULT 0,
    moyenne             NUMERIC(18, 2) NOT NULL DEFAULT 0,
    solde_08h           NUMERIC(18, 2),
    montant_propose     NUMERIC(18, 2),
    montant_valide      NUMERIC(18, 2),
    montant_paye        NUMERIC(18, 2),
    CONSTRAINT lignes_demande_appro_vas_devise_chk CHECK (devise IN ('USD', 'CDF')),
    CONSTRAINT lignes_demande_appro_vas_uniq UNIQUE (demande_id, produit_id, devise)
);

CREATE INDEX IF NOT EXISTS idx_lignes_demande_appro_vas_demande
    ON lignes_demande_approvisionnement_vas (demande_id);

COMMENT ON TABLE demandes_approvisionnement_vas IS
  'Demandes de recharge Approvisionnement VAS (Mobile Money).';
COMMENT ON TABLE lignes_demande_approvisionnement_vas IS
  'Lignes historisées : consommations J-1/J-2/moyenne figées à l’enregistrement.';
