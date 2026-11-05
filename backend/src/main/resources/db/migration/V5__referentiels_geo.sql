-- Référentiels géographiques (noms en français, lien GeoNames)

CREATE TABLE IF NOT EXISTS pays (
    id              SMALLSERIAL PRIMARY KEY,
    code_iso        VARCHAR(2)   NOT NULL UNIQUE,
    libelle         VARCHAR(200) NOT NULL,
    libelle_fr      VARCHAR(200),
    libelle_defaut  VARCHAR(200),
    geoname_id      BIGINT UNIQUE,
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    source          VARCHAR(20)  NOT NULL DEFAULT 'seed',
    actif           BOOLEAN      NOT NULL DEFAULT TRUE,
    cree_le         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    modifie_le      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS provinces (
    id              SMALLSERIAL PRIMARY KEY,
    pays_id         SMALLINT     NOT NULL REFERENCES pays(id) ON DELETE CASCADE,
    code            VARCHAR(30)  NOT NULL,
    libelle         VARCHAR(200) NOT NULL,
    libelle_fr      VARCHAR(200),
    libelle_defaut  VARCHAR(200),
    geoname_id      BIGINT UNIQUE,
    ordre_tri       SMALLINT     NOT NULL DEFAULT 0,
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    source          VARCHAR(20)  NOT NULL DEFAULT 'seed',
    actif           BOOLEAN      NOT NULL DEFAULT TRUE,
    cree_le         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    modifie_le      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (pays_id, code)
);

CREATE TABLE IF NOT EXISTS villes (
    id              SMALLSERIAL PRIMARY KEY,
    province_id     SMALLINT     NOT NULL REFERENCES provinces(id) ON DELETE CASCADE,
    code            VARCHAR(40)  NOT NULL,
    libelle         VARCHAR(200) NOT NULL,
    libelle_fr      VARCHAR(200),
    libelle_defaut  VARCHAR(200),
    geoname_id      BIGINT UNIQUE,
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    source          VARCHAR(20)  NOT NULL DEFAULT 'seed',
    actif           BOOLEAN      NOT NULL DEFAULT TRUE,
    cree_le         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    modifie_le      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (province_id, code)
);

CREATE TABLE IF NOT EXISTS territoires (
    id              SMALLSERIAL PRIMARY KEY,
    province_id     SMALLINT     NOT NULL REFERENCES provinces(id) ON DELETE CASCADE,
    code            VARCHAR(40)  NOT NULL,
    libelle         VARCHAR(200) NOT NULL,
    libelle_fr      VARCHAR(200),
    libelle_defaut  VARCHAR(200),
    geoname_id      BIGINT UNIQUE,
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    source          VARCHAR(20)  NOT NULL DEFAULT 'seed',
    actif           BOOLEAN      NOT NULL DEFAULT TRUE,
    cree_le         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    modifie_le      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (province_id, code)
);

CREATE TABLE IF NOT EXISTS communes (
    id              SERIAL PRIMARY KEY,
    ville_id        SMALLINT     REFERENCES villes(id) ON DELETE CASCADE,
    territoire_id   SMALLINT     REFERENCES territoires(id) ON DELETE CASCADE,
    code            VARCHAR(50)  NOT NULL,
    libelle         VARCHAR(200) NOT NULL,
    libelle_fr      VARCHAR(200),
    libelle_defaut  VARCHAR(200),
    geoname_id      BIGINT UNIQUE,
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    source          VARCHAR(20)  NOT NULL DEFAULT 'seed',
    actif           BOOLEAN      NOT NULL DEFAULT TRUE,
    cree_le         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    modifie_le      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT communes_parent_chk CHECK (
        (ville_id IS NOT NULL AND territoire_id IS NULL)
        OR (ville_id IS NULL AND territoire_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_communes_ville_code ON communes (ville_id, code) WHERE ville_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_communes_territoire_code ON communes (territoire_id, code) WHERE territoire_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_provinces_pays ON provinces (pays_id);
CREATE INDEX IF NOT EXISTS idx_villes_province ON villes (province_id);
CREATE INDEX IF NOT EXISTS idx_territoires_province ON territoires (province_id);
CREATE INDEX IF NOT EXISTS idx_communes_ville ON communes (ville_id);
CREATE INDEX IF NOT EXISTS idx_communes_territoire ON communes (territoire_id);

INSERT INTO permissions (code, libelle, module) VALUES
    ('referentiels.geo.lire', 'Référentiels géo — lecture', 'referentiels'),
    ('referentiels.geo.synchroniser', 'Référentiels géo — synchronisation', 'referentiels')
ON CONFLICT (code) DO NOTHING;

INSERT INTO roles_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.code = 'ADMIN' AND p.code IN ('referentiels.geo.lire', 'referentiels.geo.synchroniser')
ON CONFLICT DO NOTHING;
