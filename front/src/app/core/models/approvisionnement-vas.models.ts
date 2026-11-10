export type ApprovisionnementVasStatut =
  | 'brouillon'
  | 'soumise'
  | 'validee'
  | 'payee'
  | 'annulee';

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
  solde_08h: number | null;
  montant_propose: number | null;
  montant_valide: number | null;
  montant_paye: number | null;
}

export interface ApprovisionnementVasDemande {
  id: number;
  date_reference: string;
  statut: ApprovisionnementVasStatut;
  commentaire?: string | null;
  cree_par?: number | null;
  cree_le: string;
  modifie_le: string;
  lignes: ApprovisionnementVasLigne[];
}

export interface ApprovisionnementVasDemandeListItem {
  id: number;
  date_reference: string;
  statut: ApprovisionnementVasStatut;
  nb_lignes: number;
  cree_le: string;
}

export interface ApprovisionnementVasLigneInput {
  produit_id: number;
  devise: 'USD' | 'CDF';
  solde_08h?: number | null;
  montant_propose?: number | null;
  montant_valide?: number | null;
  montant_paye?: number | null;
}

export interface ApprovisionnementVasDemandeInput {
  date_reference: string;
  commentaire?: string | null;
  statut?: ApprovisionnementVasStatut;
  lignes: ApprovisionnementVasLigneInput[];
}

/** Ligne éditable du formulaire (calculs auto + saisie). */
export interface ApprovisionnementVasLigneForm {
  key: string;
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
  solde_08h: number | null;
  montant_propose: number | null;
  montant_valide: number | null;
  montant_paye: number | null;
  loading: boolean;
  error: string | null;
}
