-- Région vide + zone connue : on recopie la région déjà portée par la zone.
-- Kin 1–4 → Kinshasa, KATANGA → Katanga, EST 1/2 → Est, KONGO CENTRAL → Kongo Central.
-- Une région déjà renseignée n'est pas écrasée. Sans zone, rien n'est inventé.

UPDATE pilotage.dim_agence AS d
SET region_id = z.region_id
FROM pilotage.dim_zone AS z
WHERE d.agence_id <> 0
  AND coalesce(d.region_id, 0) = 0
  AND d.zone_id = z.zone_id
  AND z.zone_id <> 0
  AND coalesce(z.region_id, 0) <> 0;
