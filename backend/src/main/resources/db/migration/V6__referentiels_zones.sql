-- Référentiels zones commerciales et responsables de zone (Flash OPS)

CREATE TABLE IF NOT EXISTS responsables_zone (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(40)  NOT NULL UNIQUE,
    nom         VARCHAR(120) NOT NULL,
    perimetre   VARCHAR(30)  NOT NULL,
    actif       BOOLEAN      NOT NULL DEFAULT TRUE,
    cree_le     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    modifie_le  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS zones (
    id                    SERIAL PRIMARY KEY,
    code                  VARCHAR(40)  NOT NULL UNIQUE,
    libelle               VARCHAR(120) NOT NULL,
    perimetre             VARCHAR(30)  NOT NULL,
    region                VARCHAR(80)  NOT NULL DEFAULT '',
    responsable_zone_id   INT          REFERENCES responsables_zone(id) ON DELETE SET NULL,
    nb_communes           INT          NOT NULL DEFAULT 0,
    nb_villes             INT          NOT NULL DEFAULT 0,
    actif                 BOOLEAN      NOT NULL DEFAULT TRUE,
    cree_le               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    modifie_le            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zones_responsable ON zones (responsable_zone_id);

INSERT INTO permissions (code, libelle, module) VALUES
    ('referentiels.zones.lire', 'Zones — lecture', 'referentiels'),
    ('referentiels.zones.ecrire', 'Zones — écriture', 'referentiels')
ON CONFLICT (code) DO NOTHING;

INSERT INTO roles_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.code = 'ADMIN' AND p.code IN ('referentiels.zones.lire', 'referentiels.zones.ecrire')
ON CONFLICT DO NOTHING;

INSERT INTO responsables_zone (code, nom, perimetre) VALUES
    ('BIENFAIT_S', 'BIENFAIT S', 'Intérieur'),
    ('FRANCIS_NKIE', 'FRANCIS NKIE', 'Intérieur'),
    ('JEAN_PAUL_I', 'JEAN PAUL I', 'Intérieur'),
    ('PATRICK_A', 'PATRICK A', 'Intérieur'),
    ('PRISCA', 'PRISCA', 'Kinshasa'),
    ('RICHARD_K', 'RICHARD K', 'Kinshasa'),
    ('RICHARD_M', 'RICHARD M', 'Kinshasa'),
    ('RICHARD_M_INTERIM', 'RICHARD M (interim)', 'Kinshasa')
ON CONFLICT (code) DO UPDATE SET
    nom = EXCLUDED.nom,
    perimetre = EXCLUDED.perimetre,
    modifie_le = NOW();

INSERT INTO zones (code, libelle, perimetre, region, responsable_zone_id, nb_communes, nb_villes, actif)
SELECT v.code, v.libelle, v.perimetre, v.region, rz.id, v.nb_communes, v.nb_villes, TRUE
FROM (VALUES
    ('EST_1', 'EST 1', 'Intérieur', 'Est', 'BIENFAIT_S', 0, 3),
    ('EST_2', 'EST 2', 'Intérieur', 'Est', 'JEAN_PAUL_I', 0, 3),
    ('KATANGA', 'KATANGA', 'Intérieur', 'Katanga', 'PATRICK_A', 0, 3),
    ('KONGO_CENTRAL', 'KONGO CENTRAL', 'Intérieur', 'Kongo Central', 'FRANCIS_NKIE', 0, 4),
    ('KIN_1', 'Kin 1', 'Kinshasa', 'Kinshasa', 'PRISCA', 4, 0),
    ('KIN_2', 'Kin 2', 'Kinshasa', 'Kinshasa', 'RICHARD_M', 6, 0),
    ('KIN_3', 'Kin 3', 'Kinshasa', 'Kinshasa', 'RICHARD_M_INTERIM', 6, 0),
    ('KIN_4', 'Kin 4', 'Kinshasa', 'Kinshasa', 'RICHARD_K', 9, 0)
) AS v(code, libelle, perimetre, region, rz_code, nb_communes, nb_villes)
JOIN responsables_zone rz ON rz.code = v.rz_code
ON CONFLICT (code) DO UPDATE SET
    libelle = EXCLUDED.libelle,
    perimetre = EXCLUDED.perimetre,
    region = EXCLUDED.region,
    responsable_zone_id = EXCLUDED.responsable_zone_id,
    nb_communes = EXCLUDED.nb_communes,
    nb_villes = EXCLUDED.nb_villes,
    actif = EXCLUDED.actif,
    modifie_le = NOW();
