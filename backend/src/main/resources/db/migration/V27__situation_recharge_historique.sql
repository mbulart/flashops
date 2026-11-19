-- Situation de la recharge (commentaire par ligne) + historique, MOMO et TELCO.

ALTER TABLE lignes_demande_approvisionnement_vas
  ADD COLUMN IF NOT EXISTS situation_recharge TEXT;

COMMENT ON COLUMN lignes_demande_approvisionnement_vas.situation_recharge IS
  'Situation de la recharge (commentaire courant de la ligne).';

CREATE TABLE IF NOT EXISTS historique_situation_recharge_vas (
    id              BIGSERIAL PRIMARY KEY,
    demande_id      BIGINT NOT NULL REFERENCES demandes_approvisionnement_vas(id) ON DELETE CASCADE,
    ligne_id        BIGINT REFERENCES lignes_demande_approvisionnement_vas(id) ON DELETE SET NULL,
    produit_id      INT NOT NULL,
    operateur       VARCHAR(120) NOT NULL,
    produit_libelle VARCHAR(200) NOT NULL,
    devise          VARCHAR(10) NOT NULL,
    texte           TEXT NOT NULL,
    utilisateur_id  INT REFERENCES utilisateurs(id) ON DELETE SET NULL,
    cree_le         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hist_situation_demande
  ON historique_situation_recharge_vas (demande_id, cree_le DESC);

CREATE INDEX IF NOT EXISTS idx_hist_situation_produit
  ON historique_situation_recharge_vas (demande_id, produit_id, devise, cree_le DESC);

COMMENT ON TABLE historique_situation_recharge_vas IS
  'Historique des situations de recharge saisies sur les lignes Approvisionnement VAS.';
