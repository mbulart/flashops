-- Recalcule la moyenne VAS déjà enregistrée :
-- lundi / mardi → (J-1 + J-2) / 4 ; autres jours ouvrés → (J-1 + J-2) / 2.
-- ISODOW : 1 = lundi … 7 = dimanche.

UPDATE lignes_demande_approvisionnement_vas
SET moyenne = ROUND(
  (COALESCE(consommation_j1, 0) + COALESCE(consommation_j2, 0))
  / CASE
      WHEN EXTRACT(ISODOW FROM date_reference) IN (1, 2) THEN 4.0
      ELSE 2.0
    END,
  2
);
