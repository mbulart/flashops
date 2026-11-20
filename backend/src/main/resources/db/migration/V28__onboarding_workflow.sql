-- Onboarding SAG + moteur de workflow générique (indépendant du métier candidature).

CREATE SCHEMA IF NOT EXISTS workflow;
CREATE SCHEMA IF NOT EXISTS onboarding;

-- ---------------------------------------------------------------------------
-- Permissions & rôle
-- ---------------------------------------------------------------------------
INSERT INTO permissions (code, libelle, module) VALUES
  ('onboarding.candidatures.lire', 'Onboarding — candidatures lecture', 'onboarding'),
  ('onboarding.candidatures.ecrire', 'Onboarding — candidatures écriture', 'onboarding'),
  ('onboarding.taches.lire', 'Onboarding — mes tâches', 'onboarding'),
  ('onboarding.taches.agir', 'Onboarding — agir sur une tâche', 'onboarding'),
  ('onboarding.admin', 'Onboarding — administration / référentiels', 'onboarding'),
  ('workflow.admin', 'Workflow — conception et publication', 'workflow'),
  ('workflow.lire', 'Workflow — consultation modèles', 'workflow')
ON CONFLICT (code) DO NOTHING;

INSERT INTO roles (code, libelle) VALUES
  ('ONBOARDING', 'Onboarding')
ON CONFLICT (code) DO NOTHING;

INSERT INTO roles_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'SUPER_ADMIN'
  AND (p.code LIKE 'onboarding.%' OR p.code LIKE 'workflow.%')
ON CONFLICT DO NOTHING;

INSERT INTO roles_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'auth.profil.lire',
  'onboarding.candidatures.lire',
  'onboarding.candidatures.ecrire',
  'onboarding.taches.lire',
  'onboarding.taches.agir',
  'onboarding.admin',
  'workflow.lire'
)
WHERE r.code = 'ONBOARDING'
ON CONFLICT DO NOTHING;

-- Compte métier demandé : a.mbelu@flash.one → permissions Onboarding (sans changer son rôle BGFI).
INSERT INTO utilisateurs_permissions (utilisateur_id, permission_id)
SELECT u.id, p.id
FROM utilisateurs u
CROSS JOIN permissions p
WHERE lower(u.courriel) = lower('a.mbelu@flash.one')
  AND p.code IN (
    'onboarding.candidatures.lire',
    'onboarding.candidatures.ecrire',
    'onboarding.taches.lire',
    'onboarding.taches.agir',
    'onboarding.admin',
    'workflow.lire'
  )
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Workflow générique
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workflow.definitions (
  id              BIGSERIAL PRIMARY KEY,
  code            VARCHAR(80) NOT NULL UNIQUE,
  nom             VARCHAR(200) NOT NULL,
  description     TEXT,
  domaine         VARCHAR(80) NOT NULL DEFAULT 'onboarding',
  type_dossier    VARCHAR(80) NOT NULL DEFAULT 'candidature_sag',
  statut          VARCHAR(20) NOT NULL DEFAULT 'brouillon'
                  CHECK (statut IN ('brouillon', 'actif', 'archive')),
  cree_par        INT REFERENCES utilisateurs(id),
  cree_le         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modifie_le      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow.versions (
  id              BIGSERIAL PRIMARY KEY,
  definition_id   BIGINT NOT NULL REFERENCES workflow.definitions(id) ON DELETE CASCADE,
  numero          INT NOT NULL,
  statut          VARCHAR(20) NOT NULL DEFAULT 'brouillon'
                  CHECK (statut IN ('brouillon', 'publie', 'archive')),
  publie_le       TIMESTAMPTZ,
  publie_par      INT REFERENCES utilisateurs(id),
  notes           TEXT,
  UNIQUE (definition_id, numero)
);

CREATE TABLE IF NOT EXISTS workflow.nodes (
  id              BIGSERIAL PRIMARY KEY,
  version_id      BIGINT NOT NULL REFERENCES workflow.versions(id) ON DELETE CASCADE,
  code            VARCHAR(80) NOT NULL,
  nom             VARCHAR(200) NOT NULL,
  description     TEXT,
  type_node       VARCHAR(40) NOT NULL
                  CHECK (type_node IN ('debut', 'etape', 'decision', 'attente', 'fin_ok', 'fin_ko')),
  ordre_affichage INT NOT NULL DEFAULT 0,
  delai_cible_heures INT,
  delai_max_heures   INT,
  visible_candidat BOOLEAN NOT NULL DEFAULT TRUE,
  libelle_candidat VARCHAR(200),
  UNIQUE (version_id, code)
);

CREATE TABLE IF NOT EXISTS workflow.actions (
  id              BIGSERIAL PRIMARY KEY,
  version_id      BIGINT NOT NULL REFERENCES workflow.versions(id) ON DELETE CASCADE,
  code            VARCHAR(80) NOT NULL,
  libelle         VARCHAR(200) NOT NULL,
  description     TEXT,
  type_action     VARCHAR(40) NOT NULL DEFAULT 'custom',
  commentaire_obligatoire BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (version_id, code)
);

CREATE TABLE IF NOT EXISTS workflow.transitions (
  id              BIGSERIAL PRIMARY KEY,
  version_id      BIGINT NOT NULL REFERENCES workflow.versions(id) ON DELETE CASCADE,
  code            VARCHAR(80) NOT NULL,
  node_source_id  BIGINT NOT NULL REFERENCES workflow.nodes(id) ON DELETE CASCADE,
  node_dest_id    BIGINT NOT NULL REFERENCES workflow.nodes(id) ON DELETE CASCADE,
  action_id       BIGINT REFERENCES workflow.actions(id) ON DELETE SET NULL,
  condition_json  JSONB,
  UNIQUE (version_id, code)
);

CREATE TABLE IF NOT EXISTS workflow.actor_rules (
  id              BIGSERIAL PRIMARY KEY,
  node_id         BIGINT NOT NULL REFERENCES workflow.nodes(id) ON DELETE CASCADE,
  mode_affectation VARCHAR(40) NOT NULL DEFAULT 'role'
                   CHECK (mode_affectation IN ('role', 'utilisateur', 'groupe', 'permission')),
  role_code       VARCHAR(30),
  permission_code VARCHAR(80),
  utilisateur_id  INT REFERENCES utilisateurs(id),
  mode_validation VARCHAR(40) NOT NULL DEFAULT 'un'
                   CHECK (mode_validation IN ('un', 'tous', 'minimum')),
  minimum_acteurs INT
);

CREATE TABLE IF NOT EXISTS workflow.instances (
  id              BIGSERIAL PRIMARY KEY,
  version_id      BIGINT NOT NULL REFERENCES workflow.versions(id),
  domaine         VARCHAR(80) NOT NULL,
  type_dossier    VARCHAR(80) NOT NULL,
  dossier_ref     VARCHAR(80) NOT NULL,
  dossier_id      BIGINT NOT NULL,
  node_actif_id   BIGINT REFERENCES workflow.nodes(id),
  statut          VARCHAR(40) NOT NULL DEFAULT 'en_cours'
                  CHECK (statut IN ('en_cours', 'en_attente', 'suspendu', 'termine_ok', 'termine_ko')),
  demarre_le      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  termine_le      TIMESTAMPTZ,
  UNIQUE (domaine, type_dossier, dossier_id)
);

CREATE TABLE IF NOT EXISTS workflow.tasks (
  id              BIGSERIAL PRIMARY KEY,
  instance_id     BIGINT NOT NULL REFERENCES workflow.instances(id) ON DELETE CASCADE,
  node_id         BIGINT NOT NULL REFERENCES workflow.nodes(id),
  statut          VARCHAR(40) NOT NULL DEFAULT 'ouverte'
                  CHECK (statut IN ('ouverte', 'en_cours', 'terminee', 'annulee')),
  priorite        SMALLINT NOT NULL DEFAULT 3,
  echeance_le     TIMESTAMPTZ,
  affecte_role    VARCHAR(30),
  affecte_utilisateur_id INT REFERENCES utilisateurs(id),
  cree_le         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  terminee_le     TIMESTAMPTZ,
  terminee_par    INT REFERENCES utilisateurs(id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_tasks_user_open
  ON workflow.tasks (affecte_utilisateur_id, statut);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_role_open
  ON workflow.tasks (affecte_role, statut);

CREATE TABLE IF NOT EXISTS workflow.action_logs (
  id              BIGSERIAL PRIMARY KEY,
  instance_id     BIGINT NOT NULL REFERENCES workflow.instances(id) ON DELETE CASCADE,
  task_id         BIGINT REFERENCES workflow.tasks(id) ON DELETE SET NULL,
  action_code     VARCHAR(80) NOT NULL,
  action_libelle  VARCHAR(200),
  node_avant_id   BIGINT,
  node_apres_id   BIGINT,
  utilisateur_id  INT REFERENCES utilisateurs(id),
  commentaire     TEXT,
  payload_json    JSONB,
  cree_le         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Onboarding — référentiels
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS onboarding.categories_distributeur (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(40) NOT NULL UNIQUE,
  libelle     VARCHAR(200) NOT NULL,
  actif       BOOLEAN NOT NULL DEFAULT TRUE,
  ordre       INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS onboarding.types_candidat (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(40) NOT NULL UNIQUE,
  libelle     VARCHAR(200) NOT NULL,
  actif       BOOLEAN NOT NULL DEFAULT TRUE,
  ordre       INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS onboarding.services (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(40) NOT NULL UNIQUE,
  libelle     VARCHAR(200) NOT NULL,
  famille     VARCHAR(80) NOT NULL,
  actif       BOOLEAN NOT NULL DEFAULT TRUE,
  ordre       INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS onboarding.types_document (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(40) NOT NULL UNIQUE,
  libelle     VARCHAR(200) NOT NULL,
  obligatoire BOOLEAN NOT NULL DEFAULT FALSE,
  portee      VARCHAR(40) NOT NULL DEFAULT 'dossier'
              CHECK (portee IN ('dossier', 'point_vente', 'representant')),
  actif       BOOLEAN NOT NULL DEFAULT TRUE,
  ordre       INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS onboarding.types_piece_identite (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(40) NOT NULL UNIQUE,
  libelle     VARCHAR(200) NOT NULL,
  actif       BOOLEAN NOT NULL DEFAULT TRUE
);

-- ---------------------------------------------------------------------------
-- Onboarding — candidatures
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS onboarding.candidatures (
  id                  BIGSERIAL PRIMARY KEY,
  reference           VARCHAR(40) NOT NULL UNIQUE,
  jeton_suivi         VARCHAR(64) NOT NULL UNIQUE,
  statut_admin        VARCHAR(40) NOT NULL DEFAULT 'brouillon'
                      CHECK (statut_admin IN (
                        'brouillon', 'soumise', 'en_cours', 'complement',
                        'approuvee', 'rejetee', 'suspendue', 'annulee'
                      )),
  categorie_id        INT REFERENCES onboarding.categories_distributeur(id),
  type_candidat_id    INT REFERENCES onboarding.types_candidat(id),
  province            VARCHAR(120),
  ville               VARCHAR(120),
  telephone           VARCHAR(40),
  email               VARCHAR(255),
  motif               TEXT,
  nb_points_vente     INT NOT NULL DEFAULT 1,
  raison_sociale      VARCHAR(255),
  nom_commercial      VARCHAR(255),
  forme_juridique     VARCHAR(120),
  rccm                VARCHAR(120),
  idnat               VARCHAR(120),
  numero_impot        VARCHAR(120),
  date_creation_ent   DATE,
  adresse_siege       TEXT,
  commune             VARCHAR(120),
  quartier            VARCHAR(120),
  secteur_activite    VARCHAR(200),
  description_activite TEXT,
  declaration_exactitude BOOLEAN NOT NULL DEFAULT FALSE,
  declaration_traitement BOOLEAN NOT NULL DEFAULT FALSE,
  declaration_conditions BOOLEAN NOT NULL DEFAULT FALSE,
  soumise_le          TIMESTAMPTZ,
  cree_le             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modifie_le          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onb_cand_statut ON onboarding.candidatures (statut_admin);
CREATE INDEX IF NOT EXISTS idx_onb_cand_email ON onboarding.candidatures (lower(email));

CREATE TABLE IF NOT EXISTS onboarding.representants (
  id                  BIGSERIAL PRIMARY KEY,
  candidature_id      BIGINT NOT NULL REFERENCES onboarding.candidatures(id) ON DELETE CASCADE,
  est_principal       BOOLEAN NOT NULL DEFAULT TRUE,
  nom                 VARCHAR(120) NOT NULL DEFAULT '',
  postnom             VARCHAR(120) NOT NULL DEFAULT '',
  prenom              VARCHAR(120) NOT NULL DEFAULT '',
  sexe                VARCHAR(20),
  date_naissance      DATE,
  nationalite         VARCHAR(80),
  telephone           VARCHAR(40),
  email               VARCHAR(255),
  adresse             TEXT,
  type_piece_id       INT REFERENCES onboarding.types_piece_identite(id),
  numero_piece        VARCHAR(80),
  piece_delivree_le   DATE,
  piece_expire_le     DATE
);

CREATE TABLE IF NOT EXISTS onboarding.points_vente (
  id                  BIGSERIAL PRIMARY KEY,
  candidature_id      BIGINT NOT NULL REFERENCES onboarding.candidatures(id) ON DELETE CASCADE,
  est_principal       BOOLEAN NOT NULL DEFAULT FALSE,
  nom_commercial      VARCHAR(200) NOT NULL,
  reference_interne   VARCHAR(40),
  adresse             TEXT,
  province            VARCHAR(120),
  ville               VARCHAR(120),
  commune             VARCHAR(120),
  quartier            VARCHAR(120),
  avenue              VARCHAR(120),
  numero              VARCHAR(40),
  telephone           VARCHAR(40),
  email               VARCHAR(255),
  latitude            NUMERIC(10, 7),
  longitude           NUMERIC(10, 7),
  date_ouverture      DATE,
  description_activite TEXT,
  ordre               INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS onboarding.candidature_services (
  candidature_id      BIGINT NOT NULL REFERENCES onboarding.candidatures(id) ON DELETE CASCADE,
  service_id          INT NOT NULL REFERENCES onboarding.services(id) ON DELETE CASCADE,
  PRIMARY KEY (candidature_id, service_id)
);

CREATE TABLE IF NOT EXISTS onboarding.point_vente_services (
  point_vente_id      BIGINT NOT NULL REFERENCES onboarding.points_vente(id) ON DELETE CASCADE,
  service_id          INT NOT NULL REFERENCES onboarding.services(id) ON DELETE CASCADE,
  PRIMARY KEY (point_vente_id, service_id)
);

CREATE TABLE IF NOT EXISTS onboarding.documents (
  id                  BIGSERIAL PRIMARY KEY,
  candidature_id      BIGINT NOT NULL REFERENCES onboarding.candidatures(id) ON DELETE CASCADE,
  point_vente_id      BIGINT REFERENCES onboarding.points_vente(id) ON DELETE CASCADE,
  type_document_id    INT NOT NULL REFERENCES onboarding.types_document(id),
  nom_fichier         VARCHAR(255) NOT NULL,
  chemin_stockage     VARCHAR(500) NOT NULL,
  content_type        VARCHAR(120),
  taille_octets       BIGINT,
  statut              VARCHAR(40) NOT NULL DEFAULT 'fourni'
                      CHECK (statut IN (
                        'non_fourni', 'fourni', 'en_verification',
                        'conforme', 'non_conforme', 'a_remplacer'
                      )),
  commentaire         TEXT,
  depose_par_public   BOOLEAN NOT NULL DEFAULT TRUE,
  depose_par_user_id  INT REFERENCES utilisateurs(id),
  cree_le             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS onboarding.evenements (
  id                  BIGSERIAL PRIMARY KEY,
  candidature_id      BIGINT NOT NULL REFERENCES onboarding.candidatures(id) ON DELETE CASCADE,
  type_evenement      VARCHAR(80) NOT NULL,
  message             TEXT,
  visible_candidat    BOOLEAN NOT NULL DEFAULT FALSE,
  utilisateur_id      INT REFERENCES utilisateurs(id),
  payload_json        JSONB,
  cree_le             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS onboarding.candidature_ref_seq START 1;

-- ---------------------------------------------------------------------------
-- Seeds référentiels
-- ---------------------------------------------------------------------------
INSERT INTO onboarding.categories_distributeur (code, libelle, ordre) VALUES
  ('DISTRIBUTEUR', 'Distributeur', 1),
  ('SOUS_AGENT', 'Sous-agent (SAG)', 2)
ON CONFLICT (code) DO NOTHING;

INSERT INTO onboarding.types_candidat (code, libelle, ordre) VALUES
  ('ENTREPRISE', 'Entreprise', 1),
  ('ETABLISSEMENT', 'Établissement', 2),
  ('PERSONNE_PHYSIQUE', 'Personne physique commerçante', 3)
ON CONFLICT (code) DO NOTHING;

INSERT INTO onboarding.types_piece_identite (code, libelle) VALUES
  ('CNI', 'Carte nationale d''identité'),
  ('PASSEPORT', 'Passeport'),
  ('PERMIS', 'Permis de conduire'),
  ('AUTRE', 'Autre')
ON CONFLICT (code) DO NOTHING;

INSERT INTO onboarding.services (code, libelle, famille, ordre) VALUES
  ('WU', 'Western Union', 'Messagerie financière', 1),
  ('FLASH_CASH', 'Flash Cash / Flash Transfer', 'Messagerie financière', 2),
  ('MONEYGRAM', 'MoneyGram', 'Messagerie financière', 3),
  ('RIA', 'RIA Money Transfer', 'Messagerie financière', 4),
  ('MUKURU', 'Mukuru', 'Messagerie financière', 5),
  ('AFRICELL', 'Africell', 'Télécommunications', 10),
  ('AIRTEL', 'Airtel', 'Télécommunications', 11),
  ('ORANGE', 'Orange', 'Télécommunications', 12),
  ('VODACOM', 'Vodacom', 'Télécommunications', 13),
  ('BLUESAT', 'Bluesat', 'Abonnements télévisuels', 20),
  ('CANAL_PLUS', 'Canal+', 'Abonnements télévisuels', 21),
  ('EASY_TV', 'Easy TV', 'Abonnements télévisuels', 22),
  ('STARTIMES', 'Startimes', 'Abonnements télévisuels', 23),
  ('MPESA', 'M-Pesa', 'Mobile Money', 30),
  ('ORANGE_MONEY', 'Orange Money', 'Mobile Money', 31)
ON CONFLICT (code) DO NOTHING;

INSERT INTO onboarding.types_document (code, libelle, obligatoire, portee, ordre) VALUES
  ('RCCM', 'RCCM', TRUE, 'dossier', 1),
  ('IDNAT', 'Identification nationale', TRUE, 'dossier', 2),
  ('NIF', 'Numéro d''impôt / justificatif', TRUE, 'dossier', 3),
  ('STATUTS', 'Statuts de l''entreprise', FALSE, 'dossier', 4),
  ('PIECE_RL', 'Pièce d''identité du représentant légal', TRUE, 'representant', 5),
  ('AUTRE', 'Document complémentaire', FALSE, 'dossier', 90),
  ('PV_DOC', 'Document point de vente', FALSE, 'point_vente', 100)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Workflow par défaut candidature SAG (version publiée)
-- ---------------------------------------------------------------------------
INSERT INTO workflow.definitions (code, nom, description, domaine, type_dossier, statut)
VALUES (
  'CANDIDATURE_SAG',
  'Instruction candidature SAG',
  'Parcours standard de traitement des candidatures distributeur / SAG.',
  'onboarding',
  'candidature_sag',
  'actif'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO workflow.versions (definition_id, numero, statut, publie_le, notes)
SELECT d.id, 1, 'publie', NOW(), 'Version initiale'
FROM workflow.definitions d
WHERE d.code = 'CANDIDATURE_SAG'
  AND NOT EXISTS (
    SELECT 1 FROM workflow.versions v WHERE v.definition_id = d.id AND v.numero = 1
  );

-- Nœuds
INSERT INTO workflow.nodes (version_id, code, nom, type_node, ordre_affichage, visible_candidat, libelle_candidat)
SELECT v.id, n.code, n.nom, n.type_node, n.ordre, n.visible, n.libelle_c
FROM workflow.definitions d
JOIN workflow.versions v ON v.definition_id = d.id AND v.numero = 1
CROSS JOIN (VALUES
  ('DEBUT', 'Début', 'debut', 0, FALSE, NULL),
  ('VERIF_DOCS', 'Vérification documentaire', 'etape', 10, TRUE, 'Vérification des documents'),
  ('CONTROLE', 'Contrôle dossier', 'etape', 20, TRUE, 'Analyse du dossier'),
  ('DECISION', 'Décision', 'decision', 30, TRUE, 'Décision en cours'),
  ('FIN_OK', 'Approuvée', 'fin_ok', 90, TRUE, 'Candidature approuvée'),
  ('FIN_KO', 'Rejetée', 'fin_ko', 91, TRUE, 'Candidature rejetée'),
  ('COMPLEMENT', 'Complément d''information', 'attente', 25, TRUE, 'Informations complémentaires demandées')
) AS n(code, nom, type_node, ordre, visible, libelle_c)
WHERE d.code = 'CANDIDATURE_SAG'
  AND NOT EXISTS (SELECT 1 FROM workflow.nodes x WHERE x.version_id = v.id AND x.code = n.code);

INSERT INTO workflow.actions (version_id, code, libelle, type_action, commentaire_obligatoire)
SELECT v.id, a.code, a.libelle, a.type_action, a.comm
FROM workflow.definitions d
JOIN workflow.versions v ON v.definition_id = d.id AND v.numero = 1
CROSS JOIN (VALUES
  ('SOUMETTRE', 'Soumettre', 'submit', FALSE),
  ('VALIDER_DOCS', 'Valider les documents', 'validate', FALSE),
  ('DEMANDER_COMPLEMENT', 'Demander un complément', 'request_info', TRUE),
  ('TRANSMETTRE', 'Transmettre au contrôle', 'forward', FALSE),
  ('APPROUVER', 'Approuver', 'approve', FALSE),
  ('REJETER', 'Rejeter', 'reject', TRUE),
  ('COMPLEMENT_RECU', 'Complément reçu', 'resume', FALSE)
) AS a(code, libelle, type_action, comm)
WHERE d.code = 'CANDIDATURE_SAG'
  AND NOT EXISTS (SELECT 1 FROM workflow.actions x WHERE x.version_id = v.id AND x.code = a.code);

-- Transitions
INSERT INTO workflow.transitions (version_id, code, node_source_id, node_dest_id, action_id)
SELECT v.id, t.code, ns.id, nd.id, ac.id
FROM workflow.definitions d
JOIN workflow.versions v ON v.definition_id = d.id AND v.numero = 1
JOIN workflow.nodes ns ON ns.version_id = v.id
JOIN workflow.nodes nd ON nd.version_id = v.id
JOIN workflow.actions ac ON ac.version_id = v.id
JOIN (VALUES
  ('T_SOUMETTRE', 'DEBUT', 'VERIF_DOCS', 'SOUMETTRE'),
  ('T_DOCS_OK', 'VERIF_DOCS', 'CONTROLE', 'VALIDER_DOCS'),
  ('T_DOCS_COMP', 'VERIF_DOCS', 'COMPLEMENT', 'DEMANDER_COMPLEMENT'),
  ('T_COMP_BACK', 'COMPLEMENT', 'VERIF_DOCS', 'COMPLEMENT_RECU'),
  ('T_CTRL', 'CONTROLE', 'DECISION', 'TRANSMETTRE'),
  ('T_OK', 'DECISION', 'FIN_OK', 'APPROUVER'),
  ('T_KO', 'DECISION', 'FIN_KO', 'REJETER')
) AS t(code, src, dst, act)
  ON ns.code = t.src AND nd.code = t.dst AND ac.code = t.act
WHERE d.code = 'CANDIDATURE_SAG'
  AND NOT EXISTS (SELECT 1 FROM workflow.transitions x WHERE x.version_id = v.id AND x.code = t.code);

-- Acteurs : étapes internes → rôle ONBOARDING (ou SUPER_ADMIN via permissions)
INSERT INTO workflow.actor_rules (node_id, mode_affectation, role_code, mode_validation)
SELECT n.id, 'role', 'ONBOARDING', 'un'
FROM workflow.definitions d
JOIN workflow.versions v ON v.definition_id = d.id AND v.numero = 1
JOIN workflow.nodes n ON n.version_id = v.id
WHERE d.code = 'CANDIDATURE_SAG'
  AND n.type_node IN ('etape', 'decision', 'attente')
  AND NOT EXISTS (SELECT 1 FROM workflow.actor_rules ar WHERE ar.node_id = n.id);

COMMENT ON SCHEMA workflow IS 'Moteur de workflow générique réutilisable';
COMMENT ON SCHEMA onboarding IS 'Candidatures distributeur / SAG Flash Services';
