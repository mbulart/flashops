-- Contrat d'agence : actif par défaut, resilie pour les sorties 2026.
-- Le statut d'activité (Nouveau / Actif / Inactif) reste calculé sur les transactions.

ALTER TABLE pilotage.dim_agence
    ADD COLUMN IF NOT EXISTS contrat_statut varchar(20) NOT NULL DEFAULT 'actif',
    ADD COLUMN IF NOT EXISTS resiliation_mois text,
    ADD COLUMN IF NOT EXISTS caution_statut text,
    ADD COLUMN IF NOT EXISTS resiliation_commentaire text;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'dim_agence_contrat_statut_chk'
    ) THEN
        ALTER TABLE pilotage.dim_agence
            ADD CONSTRAINT dim_agence_contrat_statut_chk
            CHECK (contrat_statut IN ('actif', 'resilie'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS dim_agence_contrat_resilie_idx
    ON pilotage.dim_agence (agence_id)
    WHERE contrat_statut = 'resilie';

-- 47 agences déjà dans le registre, rapprochées par FP.
UPDATE pilotage.dim_agence AS d
SET contrat_statut = 'resilie',
    resiliation_mois = v.mois,
    caution_statut = v.caution,
    resiliation_commentaire = v.commentaire
FROM (
    VALUES
        (3195, 'Mars', 'Payé', 'RAS'),
        (4514, 'Mars', 'Payé', 'RAS'),
        (3549, 'Février', 'Payé', 'RAS'),
        (30, 'Février', 'Payé', 'RAS'),
        (4293, 'Février', 'Payé', 'RAS'),
        (1031, 'Janvier', 'Payé', 'RAS'),
        (133, 'Février', 'Payé', 'RAS'),
        (2966, 'Mars', 'Payé', 'RAS'),
        (3387, 'Mars', 'Payé', 'RAS'),
        (3328, 'Mars', 'Payé', 'RAS'),
        (79, 'Mars', 'Payé', 'RAS'),
        (34, 'Avril', 'Payé', 'RAS'),
        (4769, 'Avril', 'Payé', 'RAS'),
        (3441, 'Mai', 'Payé', 'RAS'),
        (2888, 'Mai', 'Non payé', 'En attente de SAG'),
        (1861, 'Mai', 'Payé', 'RAS'),
        (1128, 'Juin', 'Payé', 'RAS'),
        (2313, 'Juillet', 'Payé', 'RAS'),
        (127, 'Juillet', 'Payé', 'RAS'),
        (3037, 'Juillet', 'Payé', 'RAS'),
        (5197, 'Août', 'Payé', 'RAS'),
        (4043, 'Octobre', 'Payé', 'RAS'),
        (915, 'Octobre', 'Payé', 'RAS'),
        (4609, 'Octobre', 'Payé', 'RAS'),
        (289, 'Décembre', 'Payé', 'RAS'),
        (4177, 'Janvier', 'Payé', NULL),
        (3009, 'Février', 'Payé', NULL),
        (794, 'Février', 'Payé', NULL),
        (2163, 'Mars', 'Payé', NULL),
        (3902, 'Avril', 'Payé', NULL),
        (2576, 'Avril', 'Payé', NULL),
        (5184, 'Mai', 'Payé', NULL),
        (3859, 'Juin', 'Payé', NULL),
        (3941, 'Juin-Juillet', 'Payé', NULL),
        (4575, 'Juin-Juillet', 'Payé', NULL),
        (674, 'Juin-Juillet', 'Payé', NULL),
        (3955, 'Août', 'Payé', NULL),
        (4254, 'Août', 'Payé', NULL),
        (4771, 'Août', 'Payé', NULL),
        (4417, 'Septembre', 'Payé', NULL),
        (1762, 'Septembre', 'Payé', NULL),
        (689, 'Septembre', 'Payé', NULL),
        (97, 'Octobre', 'Payé', NULL),
        (638, 'Octobre', 'Non payé', 'En attente du retour du marketing'),
        (2379, 'Octobre', 'Non payé', 'En attente du retour du marketing'),
        (808, 'Novembre', 'Non payé', 'En attente du retour du CSC'),
        (1180, 'Novembre', 'Non payé', 'En attente du retour du CSC')
) AS v(agence_id, mois, caution, commentaire)
WHERE d.agence_id = v.agence_id;

-- 28 établissements absents du registre. Kinshasa et Est n'ont pas une zone unique :
-- on pose la région et le nom du RZ, sans inventer Kin 1/2/3/4 ni EST 1/2/3.
INSERT INTO pilotage.dim_agence (
    agence_id, code_agence, nom, categorie, pos_id, province, region_id, zone_id,
    responsable_zone_nom, contrat_statut, resiliation_mois, caution_statut, resiliation_commentaire
)
SELECT nextval('pilotage.dim_agence_agence_id_seq'),
       v.code_agence, v.nom, v.categorie, v.pos_id, v.province, v.region_id, v.zone_id,
       v.rz, 'resilie', v.mois, v.caution, v.commentaire
FROM (
    VALUES
        ('FP110508'::text, 'Ets BENEL'::text, NULL::text, 'FP110508'::text, 'Kinshasa'::text, 1, NULL::integer, 'Richard MABI'::text, 'Janvier'::text, 'Payé'::text, 'RAS'::text),
        ('RES-PILIPILI', 'PILIPILI', NULL, NULL, 'Kongo Centrale', 4, 8, 'Francis Nkie', 'Mars', 'Payé', 'RAS'),
        ('FP107882', 'GHEMIK SERVICES', NULL, 'FP107882', 'Kinshasa', 1, NULL, 'Prisca SEMBULA', 'Avril', 'Payé', 'RAS'),
        ('FP106223', 'VITE VITE EXPRESS', NULL, 'FP106223', 'Kongo Centrale', 4, 8, 'Francis Nkie', 'Avril', 'Payé', 'RAS'),
        ('FP104673', 'NK SHOP', NULL, 'FP104673', 'Kinshasa', 1, NULL, 'Richard Kamanampata', 'Mai', 'Payé', 'RAS'),
        ('FP108136', 'VM TRADING', NULL, 'FP108136', 'Kinshasa', 1, NULL, 'Richard MABI', 'Mai', 'Payé', 'RAS'),
        ('RES-AIGLE-BUNIA', 'AIGLE DE BUNIA', NULL, NULL, 'Est', 3, NULL, 'Bienfait Sheira', 'Juin', 'Payé', 'RAS'),
        ('RES-LA-PROVIDE', 'LA PROVIDE', NULL, NULL, 'Kongo Centrale', 4, 8, 'Francis Nkie', 'Juillet', 'Payé', 'RAS'),
        ('FP103288', 'JOB-PICMAS', NULL, 'FP103288', 'Kinshasa', 1, NULL, 'Richard MABI', 'Juillet', 'Payé', 'RAS'),
        ('RES-CONGO-SERVICE', 'CONGO -SERVICE', NULL, NULL, 'Katanga', 2, 5, 'Patrick Asombolotsha', 'Juillet', 'Payé', 'RAS'),
        ('FP106094', 'HOREB', NULL, 'FP106094', 'Kinshasa', 1, NULL, 'Richard MABI', 'Septembre', 'Payé', 'RAS'),
        ('FP96820', 'SHOP FREDERICK', NULL, 'FP96820', 'Kinshasa', 1, NULL, 'Richard MABI', 'Décembre', 'Payé', 'RAS'),
        ('FP113048', 'EMMANUEL MACARA', 'SAG WU', 'FP113048', 'Katanga', 2, 5, 'Patrick Asombolotsha', 'Février', 'Payé', NULL),
        ('FP97750', 'MINAS GROUP', 'SAG WU', 'FP97750', 'Est', 3, NULL, 'Bienfait Sheira', 'Mars', 'Payé', NULL),
        ('FP20277', 'PAM BUSINES', 'SAG WU', 'FP20277', 'Katanga', 2, 5, 'Patrick Asombolotsha', 'Avril', 'Payé', NULL),
        ('FP11016', 'EMPIRE CORPORATION', 'SAG WU', 'FP11016', 'Kinshasa', 1, NULL, 'Richard MABI', 'Avril', 'Payé', NULL),
        ('RES-FINCA', 'FINCA', 'SAG WU', NULL, 'Kinshasa', 1, NULL, 'Richard MABI', 'Avril', 'Payé', 'Dépôt bancaire (voir le COO)'),
        ('FP113588', 'MTN SERVICE', 'SAG WU', 'FP113588', 'Kinshasa', 1, NULL, 'Richard MABI', 'Avril', 'Payé', NULL),
        ('FP112998', 'TEAM SYNERGIE', 'SAG WU', 'FP112998', 'Kinshasa', 1, NULL, 'Richard MABI', 'Mai', 'Payé', NULL),
        ('FP113778', 'FULANGENGE', 'SAG WU', 'FP113778', 'Katanga', 2, 5, 'Patrick Asombolotsha', 'Juin', 'Payé', NULL),
        ('FP113470', 'DONDWA FINANCES', 'SAG WU', 'FP113470', 'Kinshasa', 1, NULL, 'Richard Kamanampata', 'Juin-Juillet', 'Payé', NULL),
        ('FP110984', 'KANEGAMBA', 'SAG WU', 'FP110984', 'Est', 3, NULL, 'Jean paul imani', 'Juillet', 'Payé', NULL),
        ('FP98218', 'NOTEZ BIEN', 'SAG WU', 'FP98218', 'Est', 3, NULL, 'Bienfait Sheira', 'Août', 'Payé', NULL),
        ('FP111067', 'TFB GLOBAL SARL', 'SAG WU', 'FP111067', 'Kinshasa', 1, NULL, 'Richard Kamanampata', 'Août', 'Payé', NULL),
        ('FP112632', 'ALPHA ET OMEGA', 'SAG WU', 'FP112632', 'Kinshasa', 1, NULL, 'Richard MABI', 'Août', 'Payé', NULL),
        ('FP114989', 'GENERAL MARTINS', 'SAG WU', 'FP114989', 'Kinshasa', 1, NULL, 'Prisca SEMBULA', 'Septembre', 'Payé', NULL),
        ('FP105871', 'MM', 'SAG WU', 'FP105871', 'Kinshasa', 1, NULL, 'Prisca SEMBULA', 'Octobre', 'Non payé', 'En attente du retour de la finance'),
        ('FP1104035', 'SLM', 'SAG WU', 'FP1104035', 'Kinshasa', 1, NULL, 'Richard MABI', 'Octobre', 'Payé', NULL)
) AS v(code_agence, nom, categorie, pos_id, province, region_id, zone_id, rz, mois, caution, commentaire)
WHERE NOT EXISTS (
    SELECT 1
    FROM pilotage.dim_agence AS d
    WHERE upper(btrim(d.code_agence)) = upper(v.code_agence)
       OR (v.pos_id IS NOT NULL AND upper(btrim(coalesce(d.pos_id, ''))) = upper(v.pos_id))
);
