-- POS métier : identifiants Flash (FP…) dans pilotage.dim_agence.pos_id pour la recherche agence.
UPDATE pilotage.dim_agence AS d
SET pos_id = btrim(d.fp_agent)
WHERE btrim(coalesce(d.fp_agent, '')) ~* '^FP'
  AND btrim(coalesce(d.pos_id, '')) !~* '^FP';
