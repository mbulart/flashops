import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, shareReplay } from 'rxjs';
import {
  Agency,
  AgencyGroup,
  AgencyFilters,
  AgencyUpdateInput,
  Agent,
  AgentFilters,
  Category,
  HealthResponse,
  Operation,
  Paginated,
  Product,
  ProductLine,
  Region,
  Zone,
  ZoneInput,
  ZoneManager,
  ZoneReferential,
  ZoneTerritory,
  Province,
  Ville,
  Commune,
  Quartier,
  IDDocumentType,
  ReportKPIs,
  DashboardBundle,
  ReportRankingItem,
  ReportSummaryItem,
  ReportTimeseriesPoint,
  GeoPointsResponse,
  ReportQueryFilters,
  SagGroup,
  Transaction,
  TransactionFilters,
  TransactionDuplicateFingerprintStats,
  TransactionDedupeResult,
  TxStatus,
  ImportBatchPreview,
} from '../models/api.models';
import { RuntimeConfigService } from './runtime-config.service';

type ListPayload<T> = Paginated<T> | { data: T[] };

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly runtime = inject(RuntimeConfigService);

  private get baseUrl(): string {
    return this.runtime.apiUrl;
  }

  private productLinesCache?: Observable<ProductLine[]>;
  private productsCache?: Observable<Product[]>;
  private operationsCache?: Observable<Operation[]>;
  private statusesCache?: Observable<TxStatus[]>;
  private categoriesCache?: Observable<Category[]>;
  private regionsCache?: Observable<Region[]>;
  private zonesCache?: Observable<Zone[]>;
  private idDocTypesCache?: Observable<IDDocumentType[]>;

  private reportParams(filters: ReportQueryFilters): HttpParams {
    let params = new HttpParams().set('from', filters.from).set('to', filters.to);
    if (filters.product_ids?.length) {
      params = params.set('product_ids', filters.product_ids.join(','));
    }
    if (filters.operation_id != null) params = params.set('operation_id', String(filters.operation_id));
    if (filters.category_id != null) params = params.set('category_id', String(filters.category_id));
    if (filters.agency_id != null) params = params.set('agency_id', String(filters.agency_id));
    if (filters.agent_id != null) params = params.set('agent_id', String(filters.agent_id));
    if (filters.status !== undefined && filters.status !== null && filters.status !== '') {
      params = params.set('status', String(filters.status));
    }
    if (filters.currency) params = params.set('currency', filters.currency);
    if (filters.city) params = params.set('city', filters.city);
    if (filters.commune) params = params.set('commune', filters.commune);
    if (filters.province) params = params.set('province', filters.province);
    if (filters.country) params = params.set('country', filters.country);
    if (filters.sag_group_id != null) params = params.set('sag_group_id', String(filters.sag_group_id));
    if (filters.corridor) params = params.set('corridor', filters.corridor);
    if (filters.group_by) params = params.set('group_by', filters.group_by);
    if (filters.granularity) params = params.set('granularity', filters.granularity);
    if (filters.entity) params = params.set('entity', filters.entity);
    if (filters.period) params = params.set('period', filters.period);
    if (filters.metric) params = params.set('metric', filters.metric);
    return params;
  }

  health(): Observable<HealthResponse> {
    return this.http.get<HealthResponse>(`${this.baseUrl}/health`);
  }

  getProductLines(): Observable<ProductLine[]> {
    if (!this.productLinesCache) {
      this.productLinesCache = this.http
        .get<{ data: ProductLine[] }>(`${this.baseUrl}/product-lines`)
        .pipe(map((r) => r.data), shareReplay({ bufferSize: 1, refCount: false }));
    }
    return this.productLinesCache;
  }

  getProducts(active = true): Observable<Product[]> {
    if (!this.productsCache) {
      const params = new HttpParams().set('active', String(active));
      this.productsCache = this.http
        .get<{ data: Product[] }>(`${this.baseUrl}/products`, { params })
        .pipe(map((r) => r.data), shareReplay({ bufferSize: 1, refCount: false }));
    }
    return this.productsCache;
  }

  getOperations(): Observable<Operation[]> {
    if (!this.operationsCache) {
      this.operationsCache = this.http
        .get<{ data: Operation[] }>(`${this.baseUrl}/operations`)
        .pipe(map((r) => r.data), shareReplay({ bufferSize: 1, refCount: false }));
    }
    return this.operationsCache;
  }

  getStatuses(): Observable<TxStatus[]> {
    if (!this.statusesCache) {
      this.statusesCache = this.http
        .get<{ data: TxStatus[] }>(`${this.baseUrl}/statuses`)
        .pipe(map((r) => r.data), shareReplay({ bufferSize: 1, refCount: false }));
    }
    return this.statusesCache;
  }

  getCategories(active = true): Observable<Category[]> {
    if (!this.categoriesCache) {
      const params = new HttpParams().set('active', String(active)).set('limit', '200');
      this.categoriesCache = this.http
        .get<Paginated<Category>>(`${this.baseUrl}/categories`, { params })
        .pipe(map((r) => r.data), shareReplay({ bufferSize: 1, refCount: false }));
    }
    return this.categoriesCache;
  }

  getRegions(): Observable<Region[]> {
    if (!this.regionsCache) {
      this.regionsCache = this.http
        .get<{ data: Region[] }>(`${this.baseUrl}/regions`)
        .pipe(map((r) => r.data), shareReplay({ bufferSize: 1, refCount: false }));
    }
    return this.regionsCache;
  }

  getZones(): Observable<Zone[]> {
    if (!this.zonesCache) {
      this.zonesCache = this.http
        .get<{ data: Zone[] }>(`${this.baseUrl}/zones`)
        .pipe(map((r) => r.data), shareReplay({ bufferSize: 1, refCount: false }));
    }
    return this.zonesCache;
  }

  invalidateZonesCache(): void {
    this.zonesCache = undefined;
  }

  createZone(body: ZoneInput): Observable<Zone> {
    return this.http.post<{ data: Zone }>(`${this.baseUrl}/zones`, body).pipe(
      map((r) => {
        this.invalidateZonesCache();
        return r.data;
      })
    );
  }

  updateZone(id: number, body: ZoneInput): Observable<Zone> {
    return this.http.put<{ data: Zone }>(`${this.baseUrl}/zones/${id}`, body).pipe(
      map((r) => {
        this.invalidateZonesCache();
        return r.data;
      })
    );
  }

  getZoneManagers(): Observable<ZoneManager[]> {
    return this.http
      .get<{ data: ZoneManager[] }>(`${this.baseUrl}/zone-managers`)
      .pipe(map((r) => r.data ?? []));
  }

  getZonesReferential(): Observable<ZoneReferential[]> {
    return this.http
      .get<{ data: ZoneReferential[] }>(`${this.baseUrl}/zones/referential`)
      .pipe(map((r) => r.data ?? []));
  }

  getZoneTerritories(): Observable<ZoneTerritory[]> {
    return this.http
      .get<{ data: ZoneTerritory[] }>(`${this.baseUrl}/zone-territories`)
      .pipe(map((r) => r.data ?? []));
  }

  getProvinces(paysId: number): Observable<Province[]> {
    const params = new HttpParams().set('pays_id', String(paysId));
    return this.http
      .get<{ data: Province[] }>(`${this.baseUrl}/geo/provinces`, { params })
      .pipe(map((r) => r.data ?? []));
  }

  getVilles(provinceId: number): Observable<Ville[]> {
    const params = new HttpParams().set('province_id', String(provinceId));
    return this.http
      .get<{ data: Ville[] }>(`${this.baseUrl}/geo/villes`, { params })
      .pipe(map((r) => r.data ?? []));
  }

  getCommunes(villeId: number): Observable<Commune[]> {
    const params = new HttpParams().set('ville_id', String(villeId));
    return this.http
      .get<{ data: Commune[] }>(`${this.baseUrl}/geo/communes`, { params })
      .pipe(map((r) => r.data ?? []));
  }

  getQuartiers(communeId: number): Observable<Quartier[]> {
    const params = new HttpParams().set('commune_id', String(communeId));
    return this.http
      .get<{ data: Quartier[] }>(`${this.baseUrl}/geo/quartiers`, { params })
      .pipe(map((r) => r.data ?? []));
  }

  getIDDocumentTypes(): Observable<IDDocumentType[]> {
    if (!this.idDocTypesCache) {
      this.idDocTypesCache = this.http
        .get<{ data: IDDocumentType[] }>(`${this.baseUrl}/id-document-types`)
        .pipe(map((r) => r.data ?? []), shareReplay({ bufferSize: 1, refCount: false }));
    }
    return this.idDocTypesCache;
  }

  getCurrencies(): Observable<string[]> {
    return this.http
      .get<{ data: string[] }>(`${this.baseUrl}/currencies`)
      .pipe(map((r) => r.data ?? []));
  }

  getSagGroups(page = 1, limit = 50): Observable<Paginated<SagGroup>> {
    const params = new HttpParams().set('page', String(page)).set('limit', String(limit));
    return this.http.get<Paginated<SagGroup>>(`${this.baseUrl}/sag-groups`, { params });
  }

  getAgencyCities(): Observable<string[]> {
    return this.http
      .get<{ data: string[] | null }>(`${this.baseUrl}/agencies/cities`)
      .pipe(map((r) => r.data ?? []));
  }

  getAgencyProvinces(): Observable<string[]> {
    return this.http
      .get<{ data: string[] | null }>(`${this.baseUrl}/agencies/provinces`)
      .pipe(map((r) => r.data ?? []));
  }

  getAgencyCommunes(): Observable<string[]> {
    return this.http
      .get<{ data: string[] | null }>(`${this.baseUrl}/agencies/communes`)
      .pipe(map((r) => r.data ?? []));
  }

  getAgencyCountries(): Observable<string[]> {
    return this.http
      .get<{ data: string[] | null }>(`${this.baseUrl}/agencies/countries`)
      .pipe(map((r) => r.data ?? []));
  }

  getAgencies(filters: AgencyFilters = {}): Observable<Paginated<Agency>> {
    let params = new HttpParams();
    if (filters.active !== undefined) params = params.set('active', String(filters.active));
    if (filters.limit) params = params.set('limit', String(filters.limit));
    if (filters.page) params = params.set('page', String(filters.page));
    if (filters.search) params = params.set('search', filters.search);
    if (filters.category_id) params = params.set('category_id', String(filters.category_id));
    if (filters.region_id) params = params.set('region_id', String(filters.region_id));
    if (filters.provider) params = params.set('provider', filters.provider);
    if (filters.group_canonical === false) params = params.set('group_canonical', 'false');
    return this.http.get<Paginated<Agency>>(`${this.baseUrl}/agencies`, { params });
  }

  getAgencyMembers(id: number): Observable<AgencyGroup> {
    return this.http
      .get<{ data: AgencyGroup }>(`${this.baseUrl}/agencies/${id}/members`)
      .pipe(map((r) => r.data));
  }

  updateAgency(id: number, body: AgencyUpdateInput): Observable<Agency> {
    return this.http
      .patch<{ data: Agency }>(`${this.baseUrl}/agencies/${id}`, body)
      .pipe(map((r) => r.data));
  }

  getAgencyProviders(): Observable<string[]> {
    return this.http
      .get<{ data: string[] | null }>(`${this.baseUrl}/agencies/providers`)
      .pipe(map((r) => r.data ?? []));
  }

  getAgents(filters: AgentFilters = {}): Observable<Paginated<Agent>> {
    let params = new HttpParams();
    if (filters.active !== undefined) params = params.set('active', String(filters.active));
    if (filters.limit) params = params.set('limit', String(filters.limit));
    if (filters.page) params = params.set('page', String(filters.page));
    if (filters.search) params = params.set('search', filters.search);
    if (filters.agency_id) params = params.set('agency_id', String(filters.agency_id));
    return this.http.get<Paginated<Agent>>(`${this.baseUrl}/agents`, { params });
  }

  getTransactions(filters: TransactionFilters = {}): Observable<Paginated<Transaction>> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http.get<Paginated<Transaction>>(`${this.baseUrl}/transactions`, { params });
  }

  getTransactionDuplicateFingerprintStats(to?: string): Observable<TransactionDuplicateFingerprintStats> {
    let params = new HttpParams();
    if (to) params = params.set('to', to);
    return this.http.get<TransactionDuplicateFingerprintStats>(
      `${this.baseUrl}/transactions/duplicate-fingerprint-stats`,
      { params }
    );
  }

  dedupeTransactionFingerprints(to?: string): Observable<TransactionDedupeResult> {
    return this.http.post<TransactionDedupeResult>(`${this.baseUrl}/transactions/dedupe-fingerprints`, {
      to: to ?? undefined,
    });
  }

  rebuildTransactionMonthAnalytics(to?: string): Observable<TransactionDedupeResult> {
    return this.http.post<TransactionDedupeResult>(`${this.baseUrl}/transactions/rebuild-month-analytics`, {
      to: to ?? undefined,
    });
  }

  getReportSummary(
    from: string,
    to: string,
    groupBy: string,
    productId?: number,
    categoryId?: number,
    extra?: Partial<ReportQueryFilters>
  ): Observable<{ data: ReportSummaryItem[] }> {
    const params = this.reportParams({
      from,
      to,
      group_by: groupBy,
      product_ids: productId ? [productId] : extra?.product_ids,
      category_id: categoryId ?? extra?.category_id,
      operation_id: extra?.operation_id,
      agency_id: extra?.agency_id,
      agent_id: extra?.agent_id,
      status: extra?.status,
      currency: extra?.currency,
      city: extra?.city,
      commune: extra?.commune,
      province: extra?.province,
      country: extra?.country,
      sag_group_id: extra?.sag_group_id,
    });
    return this.http.get<{ data: ReportSummaryItem[] }>(`${this.baseUrl}/reports/summary`, { params });
  }

  getReportDashboardBundle(
    from: string,
    to: string,
    granularity: string,
    extra?: Partial<ReportQueryFilters>
  ): Observable<DashboardBundle> {
    const params = this.reportParams({
      from,
      to,
      granularity,
      product_ids: extra?.product_ids,
      category_id: extra?.category_id,
      operation_id: extra?.operation_id,
      agency_id: extra?.agency_id,
      agent_id: extra?.agent_id,
      status: extra?.status,
      currency: extra?.currency,
      city: extra?.city,
      commune: extra?.commune,
      province: extra?.province,
      country: extra?.country,
      sag_group_id: extra?.sag_group_id,
    });
    return this.http
      .get<{ data: DashboardBundle }>(`${this.baseUrl}/reports/dashboard-bundle`, { params })
      .pipe(map((r) => r.data));
  }

  getReportKPIs(from: string, to: string, extra?: Partial<ReportQueryFilters>): Observable<ReportKPIs> {
    const params = this.reportParams({
      from,
      to,
      product_ids: extra?.product_ids,
      category_id: extra?.category_id,
      operation_id: extra?.operation_id,
      agency_id: extra?.agency_id,
      agent_id: extra?.agent_id,
      status: extra?.status,
      currency: extra?.currency,
      city: extra?.city,
      commune: extra?.commune,
      province: extra?.province,
      country: extra?.country,
      sag_group_id: extra?.sag_group_id,
    });
    return this.http
      .get<{ data: ReportKPIs }>(`${this.baseUrl}/reports/kpis`, { params })
      .pipe(map((r) => r.data));
  }

  getReportRankings(
    entity: string,
    period: string,
    metric: string,
    extra?: Partial<ReportQueryFilters> & {
      sort?: 'asc' | 'desc';
      page?: number;
      limit?: number;
      search?: string;
    }
  ): Observable<{
    data: ReportRankingItem[];
    pagination?: { page: number; limit: number; total: number; has_more: boolean };
  }> {
    let params = new HttpParams().set('entity', entity).set('period', period).set('metric', metric);
    if (extra?.from) params = params.set('from', extra.from);
    if (extra?.to) params = params.set('to', extra.to);
    if (extra?.product_ids?.length) params = params.set('product_ids', extra.product_ids.join(','));
    if (extra?.operation_id != null) params = params.set('operation_id', String(extra.operation_id));
    if (extra?.category_id != null) params = params.set('category_id', String(extra.category_id));
    if (extra?.agency_id != null) params = params.set('agency_id', String(extra.agency_id));
    if (extra?.agent_id != null) params = params.set('agent_id', String(extra.agent_id));
    if (extra?.status !== undefined && extra.status !== null && extra.status !== '') {
      params = params.set('status', String(extra.status));
    }
    if (extra?.currency) params = params.set('currency', extra.currency);
    if (extra?.city) params = params.set('city', extra.city);
    if (extra?.commune) params = params.set('commune', extra.commune);
    if (extra?.province) params = params.set('province', extra.province);
    if (extra?.country) params = params.set('country', extra.country);
    if (extra?.sag_group_id != null) params = params.set('sag_group_id', String(extra.sag_group_id));
    if (extra?.corridor) params = params.set('corridor', extra.corridor);
    if (extra?.sort) params = params.set('sort', extra.sort);
    if (extra?.page) params = params.set('page', String(extra.page));
    if (extra?.limit) params = params.set('limit', String(extra.limit));
    if (extra?.search) params = params.set('search', extra.search);
    return this.http.get<{
      data: ReportRankingItem[];
      pagination?: { page: number; limit: number; total: number; has_more: boolean };
    }>(`${this.baseUrl}/reports/rankings`, { params });
  }

  getReportTimeseries(
    from: string,
    to: string,
    granularity: string,
    productId?: number,
    categoryId?: number,
    extra?: Partial<ReportQueryFilters>
  ): Observable<{ data: ReportTimeseriesPoint[] }> {
    const params = this.reportParams({
      from,
      to,
      granularity,
      group_by: extra?.group_by,
      product_ids: productId ? [productId] : extra?.product_ids,
      category_id: categoryId ?? extra?.category_id,
      operation_id: extra?.operation_id,
      agency_id: extra?.agency_id,
      agent_id: extra?.agent_id,
      status: extra?.status,
      currency: extra?.currency,
      city: extra?.city,
      commune: extra?.commune,
      province: extra?.province,
      country: extra?.country,
      sag_group_id: extra?.sag_group_id,
    });
    return this.http.get<{ data: ReportTimeseriesPoint[] }>(`${this.baseUrl}/reports/timeseries`, { params });
  }

  getReportGeoPoints(from: string, to: string, extra?: Partial<ReportQueryFilters>): Observable<GeoPointsResponse> {
    const params = this.reportParams({
      from,
      to,
      product_ids: extra?.product_ids,
      category_id: extra?.category_id,
      operation_id: extra?.operation_id,
      agency_id: extra?.agency_id,
      agent_id: extra?.agent_id,
      status: extra?.status,
      currency: extra?.currency,
      city: extra?.city,
      commune: extra?.commune,
      province: extra?.province,
      country: extra?.country,
      sag_group_id: extra?.sag_group_id,
    });
    return this.http.get<GeoPointsResponse>(`${this.baseUrl}/reports/geo-points`, { params });
  }

  clearReferentialCache(): void {
    this.productLinesCache = undefined;
    this.productsCache = undefined;
    this.operationsCache = undefined;
    this.statusesCache = undefined;
    this.categoriesCache = undefined;
    this.regionsCache = undefined;
  }

  getImportBatchPreview(from: string, to: string, includeAggregates: boolean): Observable<ImportBatchPreview> {
    let params = new HttpParams().set('from', from).set('to', to);
    if (includeAggregates) params = params.set('include_aggregates', '1');
    return this.http
      .get<{ data: ImportBatchPreview }>(`${this.baseUrl}/imports/batch/preview`, { params })
      .pipe(map((r) => r.data));
  }
}
