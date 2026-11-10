-- Approvisionnement VAS V2 : workflow, historique, paiements, soldes, délai, permissions.

-- Délai de traitement (heures) à côté du taux de change.
ALTER TABLE parametres_application
  ADD COLUMN IF NOT EXISTS delai_traitement_heures numeric(8, 2) NOT NULL DEFAULT 2;

COMMENT ON COLUMN parametres_application.delai_traitement_heures IS
  'Délai de traitement estimé des demandes Approvisionnement VAS (heures).';

-- Permissions granulaires.
INSERT INTO permissions (code, libelle, module) VALUES
    ('approvisionnement.vas.creer', 'Approvisionnement VAS — créer', 'approvisionnement'),
    ('approvisionnement.vas.modifier', 'Approvisionnement VAS — modifier', 'approvisionnement'),
    ('approvisionnement.vas.soumettre', 'Approvisionnement VAS — soumettre', 'approvisionnement'),
    ('approvisionnement.vas.valider', 'Approvisionnement VAS — valider', 'approvisionnement'),
    ('approvisionnement.vas.rejeter', 'Approvisionnement VAS — rejeter', 'approvisionnement'),
    ('approvisionnement.vas.payer', 'Approvisionnement VAS — payer', 'approvisionnement'),
    ('approvisionnement.vas.paiements.lire', 'Approvisionnement VAS — voir paiements', 'approvisionnement'),
    ('approvisionnement.vas.soldes.lire', 'Approvisionnement VAS — voir soldes', 'approvisionnement'),
    ('approvisionnement.vas.seuils.ecrire', 'Approvisionnement VAS — paramétrer seuils', 'approvisionnement'),
    ('approvisionnement.vas.exporter', 'Approvisionnement VAS — exporter', 'approvisionnement')
ON CONFLICT (code) DO NOTHING;

INSERT INTO roles_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'SUPER_ADMIN'
  AND p.code LIKE 'approvisionnement.vas.%'
ON CONFLICT DO NOTHING;

INSERT INTO roles_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'VAS'
  AND p.code LIKE 'approvisionnement.vas.%'
ON CONFLICT DO NOTHING;

-- Statuts étendus.
ALTER TABLE demandes_approvisionnement_vas
  DROP CONSTRAINT IF EXISTS demandes_approvisionnement_vas_statut_chk;

ALTER TABLE demandes_approvisionnement_vas
  ADD CONSTRAINT demandes_approvisionnement_vas_statut_chk
  CHECK (statut IN (
    'brouillon',
    'soumise',
    'en_attente_validation',
    'validee',
    'en_attente_paiement',
    'partiellement_payee',
    'payee',
    'rejetee',
    'annulee'
  ));

ALTER TABLE demandes_approvisionnement_vas
  ADD COLUMN IF NOT EXISTS modifie_par INT REFERENCES utilisateurs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS soumise_par INT REFERENCES utilisateurs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS soumise_le TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS validee_par INT REFERENCES utilisateurs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS validee_le TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejetee_par INT REFERENCES utilisateurs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejetee_le TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS motif_rejet TEXT;

ALTER TABLE lignes_demande_approvisionnement_vas
  ADD COLUMN IF NOT EXISTS libelle_solde VARCHAR(120) NOT NULL DEFAULT 'Solde à 08h';

CREATE TABLE IF NOT EXISTS historique_statuts_approvisionnement (
    id              BIGSERIAL PRIMARY KEY,
    demande_id      BIGINT NOT NULL REFERENCES demandes_approvisionnement_vas(id) ON DELETE CASCADE,
    ancien_statut   VARCHAR(30),
    nouveau_statut  VARCHAR(30) NOT NULL,
    utilisateur_id  INT REFERENCES utilisateurs(id) ON DELETE SET NULL,
    commentaire     TEXT,
    cree_le         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hist_statuts_appro_demande
    ON historique_statuts_approvisionnement (demande_id, cree_le DESC);

CREATE TABLE IF NOT EXISTS paiements_recharge (
    id                  BIGSERIAL PRIMARY KEY,
    ligne_id            BIGINT NOT NULL REFERENCES lignes_demande_approvisionnement_vas(id) ON DELETE CASCADE,
    montant             NUMERIC(20, 2) NOT NULL CHECK (montant > 0),
    devise              VARCHAR(10) NOT NULL CHECK (devise IN ('USD', 'CDF')),
    date_paiement       DATE NOT NULL,
    mode_paiement       VARCHAR(40) NOT NULL CHECK (mode_paiement IN ('banque', 'transfert_interne', 'autre')),
    reference_paiement  VARCHAR(120),
    commentaire         TEXT,
    utilisateur_id      INT REFERENCES utilisateurs(id) ON DELETE SET NULL,
    cree_le             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    modifie_le          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paiements_recharge_ligne
    ON paiements_recharge (ligne_id, date_paiement DESC);

CREATE TABLE IF NOT EXISTS releves_soldes_vas (
    id              BIGSERIAL PRIMARY KEY,
    produit_id      INT NOT NULL,
    operateur       VARCHAR(120) NOT NULL,
    produit_libelle VARCHAR(200) NOT NULL,
    devise          VARCHAR(10) NOT NULL CHECK (devise IN ('USD', 'CDF')),
    solde           NUMERIC(20, 2) NOT NULL,
    releve_le       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    utilisateur_id  INT REFERENCES utilisateurs(id) ON DELETE SET NULL,
    commentaire     TEXT,
    cree_le         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_releves_soldes_vas_produit_devise
    ON releves_soldes_vas (produit_id, devise, releve_le DESC);

CREATE TABLE IF NOT EXISTS seuils_alerte_soldes_vas (
    id              BIGSERIAL PRIMARY KEY,
    produit_id      INT NOT NULL,
    operateur       VARCHAR(120) NOT NULL,
    produit_libelle VARCHAR(200) NOT NULL,
    devise          VARCHAR(10) NOT NULL CHECK (devise IN ('USD', 'CDF')),
    seuil_attention NUMERIC(20, 2) NOT NULL DEFAULT 0,
    seuil_critique  NUMERIC(20, 2) NOT NULL DEFAULT 0,
    modifie_par     INT REFERENCES utilisateurs(id) ON DELETE SET NULL,
    modifie_le      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT seuils_alerte_soldes_vas_uniq UNIQUE (produit_id, devise)
);
