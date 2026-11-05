-- Colonnes admin agences + permissions module.
ALTER TABLE pilotage.dim_agence
    ADD COLUMN IF NOT EXISTS adresse text,
    ADD COLUMN IF NOT EXISTS parent_agence_id integer;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'dim_agence_parent_agence_id_fkey'
    ) THEN
        ALTER TABLE pilotage.dim_agence
            ADD CONSTRAINT dim_agence_parent_agence_id_fkey
            FOREIGN KEY (parent_agence_id) REFERENCES pilotage.dim_agence (agence_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS dim_agence_parent_idx ON pilotage.dim_agence (parent_agence_id)
    WHERE parent_agence_id IS NOT NULL;

INSERT INTO permissions (code, libelle, module) VALUES
    ('agences.lire', 'Agences — lecture', 'agences'),
    ('agences.ecrire', 'Agences — écriture', 'agences')
ON CONFLICT (code) DO NOTHING;

INSERT INTO roles_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('agences.lire', 'agences.ecrire')
WHERE r.code = 'ADMIN'
ON CONFLICT DO NOTHING;

-- Tout rôle ayant déjà le dashboard peut lire les agences.
INSERT INTO roles_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, p_ag.id
FROM roles_permissions rp
JOIN permissions p_dash ON p_dash.id = rp.permission_id AND p_dash.code = 'dashboard.voir'
JOIN permissions p_ag ON p_ag.code = 'agences.lire'
ON CONFLICT DO NOTHING;
