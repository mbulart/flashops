-- Champs exposés par le client Angular mais absents du schéma onboarding initial.

CREATE TABLE IF NOT EXISTS onboarding.formes_juridiques (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(40) NOT NULL UNIQUE,
  libelle     VARCHAR(200) NOT NULL,
  actif       BOOLEAN NOT NULL DEFAULT TRUE,
  ordre       INT NOT NULL DEFAULT 0
);

ALTER TABLE onboarding.representants
  ADD COLUMN IF NOT EXISTS fonction VARCHAR(120);

INSERT INTO onboarding.formes_juridiques (code, libelle, ordre) VALUES
  ('SARL', 'SARL', 1),
  ('SA', 'SA', 2),
  ('SAS', 'SAS', 3),
  ('SNC', 'SNC', 4),
  ('ETABLISSEMENT', 'Établissement', 5),
  ('ENTREPRISE_INDIVIDUELLE', 'Entreprise individuelle', 6),
  ('AUTRE', 'Autre', 90)
ON CONFLICT (code) DO NOTHING;
