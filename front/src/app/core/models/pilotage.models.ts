/** Domaine métier pilotage — ne jamais agréger deux domaines entre eux. */
export type PilotageDomaine = 'transfert' | 'monnaie' | 'service';

export type PilotageJourFiltre = '' | 'hors_weekend' | 'feries' | 'par_mois';

export interface PilotageDomaineOption {
  code: PilotageDomaine;
  label: string;
}

export interface PilotageMeta {
  domaines: PilotageDomaineOption[];
  devises: string[];
  dataFrom: string | null;
  dataTo: string | null;
  pilotageSchemaReady: boolean;
}

export interface PilotageProduit {
  produitId: number;
  module: string;
  produit: string;
  ecran: string;
  partenaire?: string;
}

export interface PilotageTypeOperation {
  typeOperationId: number;
  libelle: string;
}

export interface PilotageFiltres {
  produits: PilotageProduit[];
  categories: string[];
  typesOperation: PilotageTypeOperation[];
}

export interface PilotageAgence {
  agenceId: number;
  codeAgence: string;
  nom: string | null;
  categorie: string | null;
  pos_id?: string | null;
  fp_agent?: string | null;
}

export interface PilotageAgent {
  agentId: number;
  nom: string;
}

/** Périmètre agence (geo + RZ) — paramètres optionnels des recherches agence/agent. */
export interface PilotageAgenceScope {
  reseauRegions?: string[];
  zoneIds?: number[];
  paysId?: number | null;
  provinceId?: number | null;
  villeIds?: number[];
  territoireId?: number | null;
  communeIds?: number[];
}

export interface PilotageReseauRef {
  id: number;
  code: string;
  libelle: string;
}

/** Couloir origine → destination (code = « pays_origine_id|pays_destination_id »). */
export interface PilotageCouloir {
  code: string;
  label: string;
}

export interface PilotageLocationLabels {
  pays?: string;
  province?: string;
  ville?: string;
  territoire?: string;
  commune?: string;
  region?: string;
  zone?: string;
}

/** Critères validés au clic « Appliquer » (dates en YYYY-MM-DD). */
export interface PilotageCriteria {
  /** Premier domaine, conservé pour l’affichage d’un seul métier. */
  domaine: PilotageDomaine;
  domaines: PilotageDomaine[];
  devise: string;
  from: string;
  to: string;
  produitIds: number[];
  /** Libellés choisis dans la liste (pas le détail sens / partenaire). */
  produitLabels: string[];
  partenaire: string;
  modePaiement: '' | 'cash' | 'momo';
  sousProduit: string;
  ecran: string;
  statutUniformes: string[];
  categories: string[];
  agenceIds: number[];
  agentIds: number[];
  typeOperationIds: number[];
  jourFiltre: PilotageJourFiltre;
  paysId: number | null;
  provinceId: number | null;
  villeIds: number[];
  territoireId: number | null;
  communeIds: number[];
  reseauRegions: string[];
  zoneIds: number[];
  couloirCodes: string[];
  locationLabels: PilotageLocationLabels;
}

export interface PilotageKpiBlock {
  volume: number;
  montant: number;
  ticketMoyen: number;
  volumeSucces: number;
  momMontantPct: number | null;
  yoyMontantPct: number | null;
  compareMois: string;
  commission: number;
  commissionFcn: number;
  commissionAgent: number;
  commissionFcnAgent: number;
}

export interface PilotageTimeseriesPoint {
  jour: string;
  volume: number;
  montant: number;
}

export interface PilotageProductSlice {
  produitId: number;
  module: string;
  produit: string;
  ecran: string;
  partenaire?: string;
  volume: number;
  montant: number;
}

/** Série journalière d’un produit (vue Courbes). */
export interface PilotageProductTimeseriesPoint {
  jour: string;
  produitId: number;
  module: string;
  produit: string;
  ecran: string;
  partenaire?: string;
  volume: number;
  montant: number;
}

export interface PilotageLigneExport {
  agence: string;
  codeAgence: string;
  posId: string;
  nom: string;
  expediteur: string;
  beneficiaire: string;
  telephone: string;
  telephoneExpediteur: string;
  numero: string;
  jour: string;
  montant: number;
  statut: string;
}

export interface PilotageExport {
  agencies: PilotageAgenceRank[];
  lignes: PilotageLigneExport[];
  lignesTronquees: boolean;
  lignesLimite: number;
}

export interface PilotageProductMonthlyRow {
  mois: string;
  produitId: number;
  module: string;
  produit: string;
  ecran: string;
  partenaire?: string;
  volume: number;
  montant: number;
}

export interface PilotageProduitsMensuelExport {
  from: string;
  to: string;
  domaine: string;
  devise: string;
  rows: PilotageProductMonthlyRow[];
}

export interface PilotageAgenceRank {
  agenceId: number;
  codeAgence: string;
  nom: string;
  categorie: string;
  posId: string;
  region: string;
  zone: string;
  volume: number;
  montant: number;
  commission: number;
  commissionFcn: number;
  commissionAgent: number;
  commissionFcnAgent: number;
}

export interface PilotageAgenceClassementPage {
  total: number;
  page: number;
  size: number;
  items: PilotageAgenceRank[];
}

export interface PilotageAgenceFiche {
  agenceId: number;
  codeAgence: string;
  nom: string;
  categorie: string;
  posId: string;
  region: string;
  zone: string;
  ville: string;
  commune: string;
  province: string;
  pays: string;
  latitude: number | null;
  longitude: number | null;
}

export interface PilotageAgenceTransaction {
  operationId: number;
  jour: string;
  heure: string;
  produit: string;
  ecran: string;
  expediteur: string;
  beneficiaire: string;
  statut: string;
  montant: number;
}

export interface PilotageAgenceTransactionsPage {
  total: number;
  page: number;
  size: number;
  moyenne: number;
  lignes: PilotageAgenceTransaction[];
}

export interface PilotageAgenceGeoPoint {
  agenceId: number;
  codeAgence: string;
  nom: string;
  latitude: number;
  longitude: number;
  volume: number;
  montant: number;
}

export interface PilotageBundle {
  from: string;
  to: string;
  domaine: PilotageDomaine;
  devise: string;
  kpis: PilotageKpiBlock;
  timeseries: PilotageTimeseriesPoint[];
  products: PilotageProductSlice[];
  productTimeseries: PilotageProductTimeseriesPoint[];
  agencies: PilotageAgenceRank[];
  geoPoints: PilotageAgenceGeoPoint[];
  couloirIgnored: boolean;
}
