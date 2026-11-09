-- Taux de change système (USD → CDF) pour les futurs calculs multi-modules.
ALTER TABLE parametres_application
  ADD COLUMN IF NOT EXISTS taux_change_usd_cdf numeric(18, 6) NOT NULL DEFAULT 0;

COMMENT ON COLUMN parametres_application.taux_change_usd_cdf IS
  'Taux système : 1 USD = N CDF. Utilisé par les modules pour convertir les montants.';
