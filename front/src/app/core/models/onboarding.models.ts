export interface OnboardingOption {
  id?: number | string;
  code: string;
  libelle: string;
  famille?: string;
  description?: string;
  obligatoire?: boolean;
  actif?: boolean;
}

export interface OnboardingReferentiels {
  services?: OnboardingOption[];
  types_documents?: OnboardingOption[];
  formes_juridiques?: OnboardingOption[];
  provinces?: OnboardingOption[];
  [key: string]: OnboardingOption[] | undefined;
}

export interface Representant {
  nom: string;
  prenom: string;
  telephone: string;
  email: string;
  fonction?: string;
  piece_identite?: string;
}

export interface Entreprise {
  raison_sociale: string;
  nom_commercial?: string;
  forme_juridique?: string;
  rccm?: string;
  id_nat?: string;
  nif?: string;
  adresse?: string;
  ville?: string;
  province?: string;
  commune?: string;
}

export interface PointVente {
  id?: number | string;
  nom: string;
  adresse: string;
  ville?: string;
  province?: string;
  commune?: string;
  telephone?: string;
  principal: boolean;
}

export interface CandidatureDocument {
  id?: number | string;
  type_code: string;
  type_libelle?: string;
  nom_fichier?: string;
  statut?: string;
  note?: string;
  url?: string;
  content_type?: string;
  a_fichier?: boolean;
}

export interface GeoLieu {
  id: number;
  libelle: string;
}

export interface WorkflowAction {
  code: string;
  libelle: string;
  commentaire_requis?: boolean;
}

export interface WorkflowHistorique {
  id?: number | string;
  etape?: string;
  statut?: string;
  action?: string;
  commentaire?: string;
  acteur?: string;
  date?: string;
}

export interface Candidature {
  id?: number | string;
  reference?: string;
  jeton?: string;
  statut?: string;
  etape?: string;
  progression?: number;
  email?: string;
  telephone?: string;
  representant: Representant;
  entreprise: Entreprise;
  services: string[];
  points_vente: PointVente[];
  documents: CandidatureDocument[];
  workflow_historique?: WorkflowHistorique[];
  actions_disponibles?: WorkflowAction[];
  cree_le?: string;
  modifie_le?: string;
  soumis_le?: string;
}

export type CandidatureDraft = Omit<
  Candidature,
  'id' | 'reference' | 'jeton' | 'statut' | 'workflow_historique' | 'actions_disponibles'
>;

export interface CandidaturePage {
  items: Candidature[];
  total: number;
  page?: number;
  size?: number;
}

export interface OnboardingFilters {
  q?: string;
  statut?: string;
  page?: number;
  size?: number;
}

export interface OnboardingTask {
  id: number | string;
  candidature_id?: number | string;
  reference?: string;
  libelle?: string;
  etape?: string;
  statut?: string;
  assignee?: string;
  echeance?: string;
  actions_disponibles?: WorkflowAction[];
}

export interface TaskActionInput {
  action: string;
  commentaire?: string;
}

export interface WorkflowNode {
  id?: number | string;
  code: string;
  libelle: string;
  type?: string;
}

export interface WorkflowDefinition {
  id: number | string;
  code: string;
  libelle: string;
  version?: number;
  statut?: string;
  nodes?: WorkflowNode[];
  updated_at?: string;
}
