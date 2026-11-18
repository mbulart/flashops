-- Sépare les demandes Mobile Money et TELCO sans toucher aux lignes déjà enregistrées.

ALTER TABLE demandes_approvisionnement_vas
  ADD COLUMN IF NOT EXISTS canal VARCHAR(10) NOT NULL DEFAULT 'momo';

ALTER TABLE demandes_approvisionnement_vas
  DROP CONSTRAINT IF EXISTS demandes_approvisionnement_vas_canal_chk;

ALTER TABLE demandes_approvisionnement_vas
  ADD CONSTRAINT demandes_approvisionnement_vas_canal_chk
  CHECK (canal IN ('momo', 'telco'));

CREATE INDEX IF NOT EXISTS idx_demandes_appro_vas_canal
  ON demandes_approvisionnement_vas (canal, date_reference DESC);
