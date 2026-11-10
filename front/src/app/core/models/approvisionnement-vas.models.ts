export type ApprovisionnementVasStatut =
  | 'brouillon'
  | 'soumise'
  | 'en_attente_validation'
  | 'validee'
  | 'en_attente_paiement'
  | 'partiellement_payee'
  | 'payee'
  | 'rejetee'
  | 'annulee';

export type ApprovisionnementVasModePaiement = 'banque' | 'transfert_interne' | 'autre';

export interface ApprovisionnementVasProduit {
  produit_id: number;
  operateur: string;
  produit_libelle: string;
  module: string;
  ecran: string;
  partenaire: string;
}

export interface ApprovisionnementVasPeriode {
  debut: string;
  fin: string;
}

export interface ApprovisionnementVasConsommationPeriode {
  periode: ApprovisionnementVasPeriode;
  depots: number;
  retraits: number;
  consommation: number;
}

export interface ApprovisionnementVasConsommation {
  date_reference: string;
  produit_id: number;
  operateur: string;
  produit_libelle: string;
  devise: string;
  j1: ApprovisionnementVasConsommationPeriode;
  j2: ApprovisionnementVasConsommationPeriode;
  moyenne: number;
}

export interface ApprovisionnementVasHistorique {
  id: number;
  demande_id: number;
  ancien_statut: string | null;
  nouveau_statut: string;
  utilisateur_id?: number | null;
  commentaire?: string | null;
  cree_le: string;
}

export interface ApprovisionnementVasPaiement {
  id: number;
  ligne_id: number;
  montant: number;
  devise: 'USD' | 'CDF';
  date_paiement: string;
  mode_paiement: ApprovisionnementVasModePaiement;
  reference_paiement?: string | null;
  commentaire?: string | null;
  utilisateur_id?: number | null;
  cree_le: string;
}

export interface ApprovisionnementVasPaiementInput {
  montant: number;
  devise: 'USD' | 'CDF';
  date_paiement: string;
  mode_paiement: ApprovisionnementVasModePaiement;
  reference_paiement?: string | null;
  commentaire?: string | null;
}

export interface ApprovisionnementVasLigne {
  id?: number;
  produit_id: number;
  operateur: string;
  produit_libelle: string;
  devise: 'USD' | 'CDF';
  date_reference: string;
  j1_debut: string;
  j1_fin: string;
  j2_debut: string;
  j2_fin: string;
  depots_j1: number;
  retraits_j1: number;
  consommation_j1: number;
  depots_j2: number;
  retraits_j2: number;
  consommation_j2: number;
  moyenne: number;
  libelle_solde: string;
  solde_08h: number | null;
  montant_propose: number | null;
  montant_valide: number | null;
  montant_paye: number | null;
  reste_a_payer?: number | null;
}

export interface ApprovisionnementVasDemande {
  id: number;
  date_reference: string;
  statut: ApprovisionnementVasStatut;
  commentaire?: string | null;
  motif_rejet?: string | null;
  cree_par?: number | null;
  cree_le: string;
  modifie_par?: number | null;
  modifie_le: string;
  soumise_par?: number | null;
  soumise_le?: string | null;
  validee_par?: number | null;
  validee_le?: string | null;
  rejetee_par?: number | null;
  rejetee_le?: string | null;
  en_retard?: boolean;
  delai_heures?: number;
  lignes: ApprovisionnementVasLigne[];
  historique?: ApprovisionnementVasHistorique[];
}

export interface ApprovisionnementVasDemandeListItem {
  id: number;
  date_reference: string;
  statut: ApprovisionnementVasStatut;
  nb_lignes: number;
  cree_le: string;
  soumise_le?: string | null;
  en_retard?: boolean;
  total_propose_usd?: number;
  total_propose_cdf?: number;
}

export interface ApprovisionnementVasLigneInput {
  produit_id: number;
  devise: 'USD' | 'CDF';
  libelle_solde?: string | null;
  solde_08h?: number | null;
  montant_propose?: number | null;
  montant_valide?: number | null;
}

export interface ApprovisionnementVasDemandeInput {
  date_reference: string;
  commentaire?: string | null;
  statut?: ApprovisionnementVasStatut;
  lignes: ApprovisionnementVasLigneInput[];
}

export interface ApprovisionnementVasDashboard {
  total_propose_usd: number;
  total_propose_cdf: number;
  total_valide_usd: number;
  total_valide_cdf: number;
  total_paye_usd: number;
  total_paye_cdf: number;
  nb_brouillon: number;
  nb_en_attente: number;
  nb_en_retard: number;
  nb_payees: number;
  delai_traitement_heures: number;
}

export interface ApprovisionnementVasSoldeAlerte {
  produit_id: number;
  operateur: string;
  produit_libelle: string;
  devise: 'USD' | 'CDF';
  solde: number;
  seuil_attention: number | null;
  seuil_critique: number | null;
  niveau: 'attention' | 'critique' | 'ok';
  releve_le: string;
}

export interface ApprovisionnementVasSeuil {
  id: number;
  produit_id: number;
  operateur: string;
  produit_libelle: string;
  devise: 'USD' | 'CDF';
  seuil_attention: number;
  seuil_critique: number;
  modifie_le: string;
}

export interface ApprovisionnementVasReleve {
  id: number;
  produit_id: number;
  operateur: string;
  produit_libelle: string;
  devise: 'USD' | 'CDF';
  solde: number;
  releve_le: string;
  utilisateur_id?: number | null;
  commentaire?: string | null;
  cree_le: string;
}

/** Ligne éditable du formulaire (calculs auto + saisie). */
export interface ApprovisionnementVasLigneForm {
  key: string;
  id?: number | null;
  produit_id: number | null;
  devise: 'USD' | 'CDF';
  operateur: string;
  produit_libelle: string;
  consommation_j1: number | null;
  consommation_j2: number | null;
  moyenne: number | null;
  j1_debut?: string;
  j1_fin?: string;
  j2_debut?: string;
  j2_fin?: string;
  libelle_solde: string;
  solde_08h: number | null;
  montant_propose: number | null;
  montant_valide: number | null;
  montant_paye: number | null;
  reste_a_payer: number | null;
  loading: boolean;
  error: string | null;
}
