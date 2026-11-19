-- Code lisible, figé à la création : MOMO-2026-000007 ou TELCO-2026-000007.
-- L'identifiant technique reste id. Le code ne change pas si la date est modifiée ensuite.

ALTER TABLE demandes_approvisionnement_vas
  ADD COLUMN IF NOT EXISTS code VARCHAR(32);

UPDATE demandes_approvisionnement_vas
SET code = CASE WHEN lower(canal) = 'telco' THEN 'TELCO' ELSE 'MOMO' END
  || '-' || to_char(date_reference, 'YYYY')
  || '-' || lpad(id::text, 6, '0')
WHERE code IS NULL OR btrim(code) = '';

CREATE OR REPLACE FUNCTION flashops_demande_appro_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.code IS NULL OR btrim(NEW.code) = '' THEN
    NEW.code := CASE WHEN lower(coalesce(NEW.canal, 'momo')) = 'telco' THEN 'TELCO' ELSE 'MOMO' END
      || '-' || to_char(NEW.date_reference, 'YYYY')
      || '-' || lpad(NEW.id::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_demande_appro_code ON demandes_approvisionnement_vas;
CREATE TRIGGER trg_demande_appro_code
BEFORE INSERT ON demandes_approvisionnement_vas
FOR EACH ROW
EXECUTE PROCEDURE flashops_demande_appro_code();

ALTER TABLE demandes_approvisionnement_vas
  ALTER COLUMN code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_demandes_appro_vas_code
  ON demandes_approvisionnement_vas (code);

COMMENT ON COLUMN demandes_approvisionnement_vas.code IS
  'Référence imprimable : MOMO-AAAA-000000 ou TELCO-AAAA-000000.';
