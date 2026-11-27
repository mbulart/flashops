-- Nom commercial, distinct du nom abrégé du point de vente.
-- Renseigné à part, à partir de l'opérateur le plus fréquent des 30 dernières opérations.

ALTER TABLE pilotage.dim_agence
    ADD COLUMN IF NOT EXISTS nom_commercial text;
