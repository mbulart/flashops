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
  derniere_transaction: string | null;
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
  region_id?: number | null;
  zone_id?: number | null;
  ville?: string;
  commune?: string;
  province?: string;
  pays?: string;
  categorie?: string;
  activity_days?: number | null;
  from?: string;
  to?: string;
  parent_agence_id?: number | null;
  sans_coords?: boolean;
  page?: number;
  size?: number;
}
