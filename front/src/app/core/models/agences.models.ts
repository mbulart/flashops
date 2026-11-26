export interface AgenceAdmin {
  agenceId: number;
  code_agence: string;
  nom: string;
  categorie: string;
  pos_id: string;
  fp_agent: string;
  ville: string;
  commune: string;
  province: string;
  pays: string;
  adresse: string;
  latitude: number | null;
  longitude: number | null;
  regionId: number | null;
  zoneId: number | null;
  region: string;
  zone: string;
  responsable_zone: string;
  parentAgenceId: number | null;
  mere_code: string;
  mere_nom: string;
  premiere_transaction: string | null;
  derniere_transaction: string | null;
  /** Nouveau | Actif | Inactif */
  statut_activite: 'Nouveau' | 'Actif' | 'Inactif' | string;
}

export interface AgenceAdminPage {
  total: number;
  page: number;
  size: number;
  items: AgenceAdmin[];
}

export interface AgenceAdminInput {
  code_agence: string;
  nom: string;
  categorie?: string;
  pos_id?: string;
  fp_agent?: string;
  ville?: string;
  commune?: string;
  province?: string;
  pays?: string;
  adresse?: string;
  latitude?: number | null;
  longitude?: number | null;
  regionId?: number | null;
  zoneId?: number | null;
  parentAgenceId?: number | null;
}

export interface AgenceAdminFilters {
  q?: string;
  identifiant?: string;
  region_ids?: number[];
  zone_id?: number | null;
  ville?: string;
  commune?: string;
  province?: string;
  pays?: string;
  categories?: string[];
  activity_days?: number | null;
  /**
   * Âge mini de la dernière transaction (jours).
   * Presets : 3→[3,7), 7→[7,15), … ; autre valeur = au moins N jours.
   */
  inactive_since_days?: number | null;
  /** Nouveau | Actif | Inactif */
  statut_activite?: string[];
  from?: string;
  to?: string;
  parent_agence_id?: number | null;
  sans_coords?: boolean;
  page?: number;
  size?: number;
}

/** Catégories réseau Flash affichées par défaut dans le registre. */
export const DEFAULT_AGENCE_CATEGORIES = ['SAG WU', 'Franchise BGFI', 'CFC'] as const;
