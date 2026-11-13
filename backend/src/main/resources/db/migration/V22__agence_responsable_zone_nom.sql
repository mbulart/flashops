-- Fallback RZ quand l'agence n'a pas de zone (export / fiche).
-- Ne remplace pas le RZ dérivé de la zone quand zone_id est renseigné.
ALTER TABLE pilotage.dim_agence
    ADD COLUMN IF NOT EXISTS responsable_zone_nom text;
