-- Régions réseau, alignées sur reporting.regions / pilotage.dim_region (code + libellé).

CREATE TABLE IF NOT EXISTS regions (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(30)  NOT NULL UNIQUE,
    libelle     VARCHAR(120) NOT NULL,
    par_defaut  BOOLEAN      NOT NULL DEFAULT FALSE,
    actif       BOOLEAN      NOT NULL DEFAULT TRUE,
    cree_le     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    modifie_le  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO regions (code, libelle, par_defaut) VALUES
    ('KINSHASA',      'Kinshasa',                              FALSE),
    ('KATANGA',       'Katanga',                               FALSE),
    ('EST',           'Est',                                   FALSE),
    ('KONGO_CENTRAL', 'Kongo Central',                         FALSE),
    ('KIKWIT',        'Kikwit',                                FALSE),
    ('BAS_CONGO',     'Bas-Congo',                             FALSE),
    ('KIN_2',         'Kin 2 (région par défaut / hors réf.)', TRUE)
ON CONFLICT (code) DO UPDATE SET
    libelle = EXCLUDED.libelle,
    par_defaut = EXCLUDED.par_defaut,
    modifie_le = NOW();

ALTER TABLE zones
    ADD COLUMN IF NOT EXISTS region_id INT REFERENCES regions (id) ON DELETE RESTRICT;

UPDATE zones AS z
SET region_id = r.id
FROM regions AS r
WHERE z.region_id IS NULL
  AND btrim(z.region) <> ''
  AND (
    upper(btrim(z.region)) = upper(btrim(r.libelle))
    OR upper(regexp_replace(btrim(z.region), '[^A-Za-z0-9]+', '', 'g'))
       = upper(regexp_replace(r.code, '[^A-Za-z0-9]+', '', 'g'))
  );

UPDATE zones AS z
SET region = r.libelle
FROM regions AS r
WHERE z.region_id = r.id
  AND btrim(coalesce(z.region, '')) = '';

CREATE INDEX IF NOT EXISTS idx_zones_region ON zones (region_id);
