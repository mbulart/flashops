-- Taux de change système (USD → FCN) pour conversions multi-modules / KPI Pilotage.
ALTER TABLE parametres_application
  ADD COLUMN IF NOT EXISTS taux_change_usd_fcn numeric(18, 6) NOT NULL DEFAULT 1000;

COMMENT ON COLUMN parametres_application.taux_change_usd_fcn IS
  'Taux système : 1 USD = N FCN. Utilisé pour convertir les montants FCN en USD.';
