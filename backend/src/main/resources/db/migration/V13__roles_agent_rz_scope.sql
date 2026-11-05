-- Rôles AGENT / RZ + rattachement utilisateur (agence ou responsable de zone)

INSERT INTO roles (code, libelle) VALUES
    ('AGENT', 'Agent'),
    ('RZ', 'Responsable de zone')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE utilisateurs
    ADD COLUMN IF NOT EXISTS agence_id integer,
    ADD COLUMN IF NOT EXISTS responsable_zone_id integer;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'utilisateurs_agence_id_fkey'
    ) THEN
        ALTER TABLE utilisateurs
            ADD CONSTRAINT utilisateurs_agence_id_fkey
            FOREIGN KEY (agence_id) REFERENCES pilotage.dim_agence (agence_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'utilisateurs_responsable_zone_id_fkey'
    ) THEN
        ALTER TABLE utilisateurs
            ADD CONSTRAINT utilisateurs_responsable_zone_id_fkey
            FOREIGN KEY (responsable_zone_id) REFERENCES responsables_zone (id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_utilisateurs_agence
    ON utilisateurs (agence_id)
    WHERE agence_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_utilisateurs_responsable_zone
    ON utilisateurs (responsable_zone_id)
    WHERE responsable_zone_id IS NOT NULL;

-- Permissions de base : lecture dashboard + agences + geo (comme les rôles métier lecture)
INSERT INTO roles_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'auth.profil.lire',
    'dashboard.voir',
    'agences.lire',
    'referentiels.geo.lire',
    'referentiels.zones.lire'
)
WHERE r.code IN ('AGENT', 'RZ')
ON CONFLICT DO NOTHING;
