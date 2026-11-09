export interface Role {
  id: number;
  code: string;
  label: string;
}

export interface Permission {
  id: number;
  code: string;
  label: string;
  module: string;
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  permissions?: Permission[];
  permission_codes: string[];
  is_active?: boolean;
  region_id?: number | null;
  zone_id?: number | null;
  agence_id?: number | null;
  responsable_zone_id?: number | null;
  allowed_agence_ids?: number[];
  allowed_zone_ids?: number[];
  last_login_at?: string;
  created_at?: string;
  has_profile_photo?: boolean;
  profile_photo_updated_at?: string | null;
}

export interface AdminRole extends Role {
  permissions: Permission[];
}

export interface PublicAppSettings {
  app_name: string;
  app_short_name: string;
  app_url: string;
  logo_light: string;
  logo_dark: string;
  favicon: string;
  default_language: string;
  timezone?: string;
}

export interface AppSettings extends PublicAppSettings {
  timezone: string;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password?: string;
  smtp_password_configured: boolean;
  smtp_encryption: 'none' | 'tls' | 'ssl';
  smtp_from_email: string;
  smtp_from_name: string;
  smtp_test_to: string;
  /** 1 USD = N CDF — utilisé par les modules pour les conversions. */
  taux_change_usd_cdf: number;
}

export interface ScheduledReport {
  id: number;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  recipients: string;
  currency: string;
  is_active: boolean;
  last_sent_at?: string | null;
  next_run_at: string;
  created_at?: string;
  updated_at?: string;
}

export interface ScheduledReportInput {
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  recipients: string;
  currency: string;
  is_active: boolean;
}

export interface ReportRecipient {
  id: number;
  email: string;
  full_name: string;
}

export interface ReportEmailAttachment {
  filename: string;
  content_type: string;
  data_base64: string;
}

export interface ReportShareInput {
  report_type: 'commercial' | 'reporting' | 'document';
  month?: string;
  from?: string;
  to?: string;
  currency?: string;
  subject?: string;
  to_user_id?: number;
  cc_all_users?: boolean;
  message?: string;
  section?: string;
  attachments?: ReportEmailAttachment[];
}

export interface ReportShareResult {
  to: string;
  cc: string[];
  recipients: number;
  status: string;
}

export interface DocumentShareInput {
  to_user_id?: number;
  cc_all_users?: boolean;
  subject?: string;
  message?: string;
  attachments: ReportEmailAttachment[];
}

export interface AdminUserInput {
  email: string;
  full_name: string;
  role_id: number;
  is_active: boolean;
  password?: string;
  permission_ids?: number[];
  region_id?: number | null;
  zone_id?: number | null;
  agence_id?: number | null;
  responsable_zone_id?: number | null;
}

export interface UserActionSummary {
  id: number;
  action_code: string;
  module: string;
  label: string;
  user: { id: number; email: string; full_name: string } | null;
  created_at: string;
}

export interface UserActionDetail extends UserActionSummary {
  details: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
}

export interface PagedUserActions {
  items: UserActionSummary[];
  total: number;
  page: number;
  page_size: number;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

export interface AccessToken {
  id: number;
  name: string;
  token_prefix: string;
  role: Role;
  is_active: boolean;
  created_by?: number | null;
  last_used_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AccessTokenInput {
  name: string;
  role_id: number;
  is_active: boolean;
}

export interface AccessTokenCreateResult {
  token: AccessToken;
  plain_token: string;
}

export interface Paginated<T> {
  data: T[];
  facets?: TransactionFacet[];
  pagination: {
    page?: number;
    limit: number;
    total?: number;
    next_cursor?: string;
    has_more: boolean;
  };
}

export interface HealthResponse {
  status: string;
  transactions?: number;
  error?: string;
}

export interface ProductLine {
  id: number;
  code: string;
  label: string;
  is_active: boolean;
}

export interface Product {
  id: number;
  code: string;
  label: string;
  line_code?: string;
  is_active: boolean;
}

export interface Operation {
  id: number;
  code: string;
  label: string;
}

export interface TxStatus {
  id: number;
  code: string;
  label: string;
  is_success: boolean;
}

export interface Category {
  id: number;
  code: string;
  label: string;
  is_active: boolean;
}

export interface Region {
  id: number;
  code: string;
  label: string;
  is_default?: boolean;
}

export interface SagGroup {
  id: number;
  code: string;
  label: string;
}

export interface PublicAgencyGeo {
  id: number;
  code_agence: string;
  name: string;
  category_label?: string;
  commune?: string;
  city?: string;
  province?: string;
  country?: string;
  region_label?: string;
  zone_label?: string;
  zone_manager_name?: string;
  provider?: string;
  is_active: boolean;
  last_seen_at?: string;
  latitude: string;
  longitude: string;
}

export interface Agency {
  id: number;
  code_agence: string;
  name: string;
  category_id?: number | null;
  category_code?: string;
  category_label?: string;
  flash_id?: string;
  sag_wu_label?: string;
  external_id?: number;
  short_name?: string;
  wu_pos_usd?: string;
  wu_pos_cdf?: string;
  mg_account?: string;
  address?: string;
  commune?: string;
  city?: string;
  province?: string;
  country?: string;
  provider?: string;
  phone1?: string;
  phone2?: string;
  latitude?: string;
  longitude?: string;
  opened_at?: string;
  closed_at?: string;
  region?: Region;
  zone?: Zone;
  sag_group?: SagGroup;
  is_active: boolean;
  last_seen_at?: string;
  tx_count_total: number;
  member_count?: number;
  alias_codes?: string[];
}

export interface AgencyGroup {
  canonical_id: number;
  members: Agency[];
}

export interface Zone {
  id: number;
  code: string;
  label: string;
  region_id?: number | null;
  manager_name?: string | null;
  is_active?: boolean;
}

export interface ZoneInput {
  code: string;
  label: string;
  region_id?: number | null;
  manager_name?: string | null;
  is_active?: boolean;
}

export interface RegionRef {
  id: number;
  code: string;
  libelle: string;
  par_defaut: boolean;
  actif: boolean;
}

export interface RegionRefInput {
  code: string;
  libelle: string;
  par_defaut: boolean;
  actif: boolean;
}

export interface ResponsableZoneRef {
  id: number;
  code: string;
  nom: string;
  perimetre: string;
  actif: boolean;
  zone_libelle?: string | null;
}

export interface ResponsableZoneInput {
  code: string;
  nom: string;
  perimetre: string;
  actif: boolean;
}

export interface ZoneRef {
  id: number;
  code: string;
  libelle: string;
  perimetre: string;
  region: string;
  region_id?: number | null;
  region_code?: string | null;
  responsable_zone_id?: number | null;
  responsable_nom?: string | null;
  nb_communes: number;
  nb_villes: number;
  actif: boolean;
}

export interface ZoneRefInput {
  code: string;
  libelle: string;
  perimetre: string;
  region: string;
  region_id?: number | null;
  responsable_zone_id?: number | null;
  nb_communes: number;
  nb_villes: number;
  actif: boolean;
}

export interface ZoneManager {
  id: number;
  code: string;
  full_name: string;
  scope: string;
  is_active: boolean;
  zone_labels: string[];
}

export interface ZoneReferential {
  id: number;
  code: string;
  label: string;
  scope?: string | null;
  region_id?: number | null;
  region_code?: string | null;
  region_label?: string | null;
  manager_id?: number | null;
  manager_name?: string | null;
  commune_count: number;
  ville_count: number;
  is_active: boolean;
}

export interface ZoneTerritory {
  zone_code: string;
  zone_label: string;
  scope?: string | null;
  geo_type: 'commune' | 'ville';
  geo_label: string;
  geo_code: string;
}

export interface Pays {
  id: number;
  code_iso: string;
  libelle: string;
  libelle_fr?: string | null;
  geoname_id?: number | null;
  actif: boolean;
}

export interface Province {
  id: number;
  pays_id: number;
  code: string;
  libelle: string;
  libelle_fr?: string | null;
  geoname_id?: number | null;
  ordre_tri?: number;
  actif: boolean;
  /** @deprecated utiliser libelle */
  label?: string;
}

export interface Ville {
  id: number;
  province_id: number;
  code: string;
  libelle: string;
  libelle_fr?: string | null;
  geoname_id?: number | null;
  actif: boolean;
  /** @deprecated utiliser libelle */
  label?: string;
}

export interface Territoire {
  id: number;
  province_id: number;
  code: string;
  libelle: string;
  libelle_fr?: string | null;
  geoname_id?: number | null;
  actif: boolean;
}

export interface Commune {
  id: number;
  ville_id?: number | null;
  territoire_id?: number | null;
  province_id?: number | null;
  code: string;
  libelle: string;
  libelle_fr?: string | null;
  geoname_id?: number | null;
  actif: boolean;
  /** @deprecated utiliser libelle */
  label?: string;
}

export interface GeoSyncResult {
  skipped: boolean;
  pays: number;
  provinces: number;
  villes: number;
  territoires: number;
  communes: number;
  status: string;
}

export interface Quartier {
  id: number;
  commune_id: number;
  code: string;
  label: string;
}

export interface IDDocumentType {
  id: number;
  code: string;
  label: string;
  description?: string | null;
}

export interface Agent {
  id: number;
  name: string;
  fp_agent_id?: string;
  agency_id?: number;
  agency_code?: string;
  agency_name?: string;
  is_active: boolean;
  last_seen_at?: string;
}

export interface Transaction {
  id: number;
  transaction_at: string;
  product_code: string;
  product_label: string;
  operation_code: string;
  status_code: string;
  is_success: boolean;
  amount: number;
  currency: string;
  agency_code: string;
  agency_name: string;
  agent_name?: string;
  category_code?: string;
  external_ref?: string;
  external_ref_secondary?: string;
}

export interface TransactionFacet {
  dimension: 'product' | 'operation' | 'category' | 'status';
  code: string;
  label: string;
  count: number;
}

export interface ReportSummaryItem {
  group_key: string;
  group_label: string;
  currency: string;
  tx_count: number;
  tx_success: number;
  amount_sum: number;
  commission_sum?: number;
}

export interface ReportRankingItem {
  id?: number;
  entity_type: string;
  code: string;
  label: string;
  currency?: string;
  tx_count: number;
  volume: number;
  last_seen_at?: string;
}

export interface ReportTimeseriesPoint {
  period: string;
  currency: string;
  tx_count: number;
  tx_success: number;
  amount_sum: number;
  series_key?: string;
  series_label?: string;
}

export interface ReportQueryFilters {
  from: string;
  to: string;
  product_ids?: number[];
  operation_id?: number | null;
  category_id?: number | null;
  agency_id?: number | null;
  agent_id?: number | null;
  status?: number | 'success' | 'failed' | '';
  currency?: string;
  city?: string;
  commune?: string;
  province?: string;
  country?: string;
  sag_group_id?: number | null;
  corridor?: string;
  group_by?: string;
  granularity?: string;
  entity?: string;
  period?: string;
  metric?: string;
}

export interface GeoPoint {
  agency_id: number;
  code: string;
  label: string;
  city?: string;
  commune?: string;
  address?: string;
  lat: number;
  lng: number;
  tx_count: number;
  volume: number;
  currency: string;
  /** Carte présence : vert si dans le résultat, rouge si sans opération. */
  presence?: 'present' | 'missing';
}

export interface GeoPointsResponse {
  data: GeoPoint[];
  geocoded: number;
  total_agencies_in_scope: number;
  from: string;
  to: string;
}

export interface ReportKPIs {
  currency: string;
  tx_count: number;
  amount_sum: number;
  ticket_moyen: number;
  prev_amount: number;
  mom_growth_pct: number | null;
  yoy_amount: number;
  yoy_growth_pct: number | null;
}

export interface DashboardBundle {
  from: string;
  to: string;
  summary_product: ReportSummaryItem[];
  summary_network: ReportSummaryItem[];
  timeseries: ReportTimeseriesPoint[];
  heatmap_days: ReportTimeseriesPoint[];
  product_monthly: ReportTimeseriesPoint[];
  kpis?: ReportKPIs | null;
  geo_points: GeoPoint[];
  geo_geocoded: number;
  geo_total_in_scope: number;
  agency_rankings: ReportRankingItem[];
  agency_ranking_total: number;
  city_rankings: ReportRankingItem[];
  city_ranking_total: number;
  commune_rankings: ReportRankingItem[];
  commune_ranking_total: number;
  province_rankings: ReportRankingItem[];
  province_ranking_total: number;
  sag_rankings: ReportRankingItem[];
  sag_ranking_total: number;
  corridor_rankings: ReportRankingItem[];
  corridor_ranking_total: number;
}

export interface TransactionFilters {
  from?: string;
  to?: string;
  product_id?: string;
  operation_id?: number;
  category_id?: number;
  agency_id?: number;
  include_linked?: boolean;
  agent_id?: number;
  status_id?: number;
  status_success?: boolean;
  currency?: string;
  sort_dir?: 'asc' | 'desc';
  include_total?: boolean;
  include_facets?: boolean;
  duplicate_fingerprints_only?: boolean;
  limit?: number;
  cursor?: string;
}

export interface TransactionDuplicateFingerprintStats {
  from: string;
  to: string;
  duplicate_rows: number;
  duplicate_fingerprints: number;
}

export interface TransactionDedupeResult {
  from: string;
  to: string;
  deleted_rows: number;
  analytics?: { fact_rows: number; corridor_rows: number; duration_ms: number };
  analytics_error?: string;
}

export interface AgencyFilters {
  active?: boolean;
  limit?: number;
  page?: number;
  search?: string;
  category_id?: number;
  region_id?: number;
  provider?: string;
  group_canonical?: boolean;
}

export interface AgencyUpdateInput {
  name: string;
  category_id?: number | null;
  region_id?: number | null;
  zone_id?: number | null;
  is_active?: boolean;
  flash_id?: string | null;
  short_name?: string | null;
  sag_wu_label?: string | null;
  wu_pos_usd?: string | null;
  wu_pos_cdf?: string | null;
  mg_account?: string | null;
  address?: string | null;
  commune?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  provider?: string | null;
  phone1?: string | null;
  phone2?: string | null;
  latitude?: string | null;
  longitude?: string | null;
}

export interface AgentFilters {
  active?: boolean;
  limit?: number;
  page?: number;
  search?: string;
  agency_id?: number;
}

export interface ImportBatchPreview {
  data_dir: string;
  from: string;
  to: string;
  include_aggregates: boolean;
  total_files: number;
  already_imported: number;
  to_process: number;
  sample_paths: string[];
}

export interface ImportBatchCreatedRequest {
  from: string;
  to: string;
  analytics_from?: string;
  analytics_to?: string;
  force?: boolean;
  include_aggregates?: boolean;
  no_dedup?: boolean;
  delete_csv?: boolean;
}
