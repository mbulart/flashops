import { HttpClient, HttpEventType, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, filter, map, tap } from 'rxjs';
import { GeoReferentielService } from './geo-referentiel.service';
import { Commune, Pays, Province, Territoire, Ville } from '../models/api.models';
import {
  PilotageAgence,
  PilotageAgent,
  PilotageAgenceClassementPage,
  PilotageAgenceFiche,
  PilotageAgenceGeoPoint,
  PilotageAgenceRank,
  PilotageCouloirClassementPage,
  PilotageCouloirRank,
  PilotageAgenceTransaction,
  PilotageAgenceTransactionsPage,
  PilotageAgenceScope,
  PilotageBundle,
  PilotageCouloir,
  PilotageCriteria,
  PilotageDomaine,
  PilotageExport,
  PilotageLigneExport,
  PilotageProduitsMensuelExport,
  PilotageProductMonthlyRow,
  PilotageFiltres,
  PilotageMeta,
  PilotageProductSlice,
  PilotageProductTimeseriesPoint,
  PilotageReseauRef,
} from '../models/pilotage.models';
import { RuntimeConfigService } from './runtime-config.service';
import { pilotageFilterProduitsByUiDomain } from '../../pages/pilotage/pilotage-filtres.config';

@Injectable({ providedIn: 'root' })
export class PilotageService {
  private readonly http = inject(HttpClient);
  private readonly runtime = inject(RuntimeConfigService);
  private readonly geo = inject(GeoReferentielService);

  private get baseUrl(): string {
    return `${this.runtime.apiUrl}/pilotage`;
  }

  loadMeta() {
    return this.http.get<{ data: PilotageMeta }>(`${this.baseUrl}/meta`).pipe(map((r) => r.data));
  }

  loadFiltres(domaine: PilotageDomaine) {
    const params = new HttpParams().set('domaine', domaine);
    return this.http
      .get<{ data: PilotageFiltres }>(`${this.baseUrl}/filtres`, { params })
      .pipe(map((r) => r.data));
  }

  searchAgences(q: string, limit = 20, scope?: PilotageAgenceScope) {
    let params = new HttpParams().set('q', q).set('limit', String(limit));
    params = this.appendAgenceScope(params, scope);
    return this.http
      .get<{ data: PilotageAgence[] }>(`${this.baseUrl}/agences/search`, { params })
      .pipe(map((r) => r.data ?? []));
  }

  searchAgents(q: string, agenceId: number | null, limit = 20, scope?: PilotageAgenceScope) {
    let params = new HttpParams().set('q', q).set('limit', String(limit));
    if (agenceId != null && agenceId > 0) {
      params = params.set('agence_id', String(agenceId));
    }
    params = this.appendAgenceScope(params, scope);
    return this.http
      .get<{ data: PilotageAgent[] }>(`${this.baseUrl}/agents/search`, { params })
      .pipe(map((r) => r.data ?? []));
  }

  listGeoPays() {
    return this.http.get<{ data: Pays[] }>(`${this.baseUrl}/geo/pays`).pipe(
      map((r) => r.data ?? []),
      catchError(() => this.geo.listPays())
    );
  }

  listGeoProvinces(paysId: number) {
    const params = new HttpParams().set('pays_id', String(paysId));
    return this.http
      .get<{ data: Province[] }>(`${this.baseUrl}/geo/provinces`, { params })
      .pipe(
        map((r) => r.data ?? []),
        catchError(() => this.geo.listProvinces(paysId))
      );
  }

  listGeoVillesByPays(paysId: number, regions: string[] = []) {
    let params = new HttpParams().set('pays_id', String(paysId));
    for (const region of regions) {
      if (region.trim()) {
        params = params.append('reseau_region', region.trim());
      }
    }
    return this.http
      .get<{ data: Ville[] }>(`${this.baseUrl}/geo/villes`, { params })
      .pipe(map((r) => r.data ?? []));
  }

  listGeoVilles(provinceId: number) {
    const params = new HttpParams().set('province_id', String(provinceId));
    return this.http
      .get<{ data: Ville[] }>(`${this.baseUrl}/geo/villes`, { params })
      .pipe(
        map((r) => r.data ?? []),
        catchError(() => this.geo.listVilles(provinceId))
      );
  }

  listGeoTerritoires(provinceId: number) {
    const params = new HttpParams().set('province_id', String(provinceId));
    return this.http
      .get<{ data: Territoire[] }>(`${this.baseUrl}/geo/territoires`, { params })
      .pipe(
        map((r) => r.data ?? []),
        catchError(() => this.geo.listTerritoires(provinceId))
      );
  }

  listGeoCommunes(filters: { villeId?: number; territoireId?: number; provinceId?: number }) {
    let params = new HttpParams();
    if (filters.villeId != null) {
      params = params.set('ville_id', String(filters.villeId));
    }
    if (filters.territoireId != null) {
      params = params.set('territoire_id', String(filters.territoireId));
    }
    if (filters.provinceId != null) {
      params = params.set('province_id', String(filters.provinceId));
    }
    return this.http
      .get<{ data: Commune[] }>(`${this.baseUrl}/geo/communes`, { params })
      .pipe(
        map((r) => r.data ?? []),
        catchError(() => this.geo.listCommunes(filters))
      );
  }

  listCouloirs(domaine: PilotageDomaine) {
    const params = new HttpParams().set('domaine', domaine);
    return this.http
      .get<{ data: PilotageCouloir[] }>(`${this.baseUrl}/couloirs`, { params })
      .pipe(map((r) => r.data ?? []));
  }

  loadExport(criteria: PilotageCriteria, onProgress?: (ratio: number) => void) {
    const params = this.criteriaParams(criteria);
    return this.http
      .get<{ data: PilotageExport }>(`${this.baseUrl}/export`, {
        params,
        reportProgress: true,
        observe: 'events',
      })
      .pipe(
        tap((event) => {
          if (!onProgress || event.type !== HttpEventType.DownloadProgress) return;
          const total = event.total ?? 0;
          if (total > 0) {
            onProgress(Math.min(0.82, (event.loaded / total) * 0.82));
            return;
          }
          onProgress(Math.min(0.55, event.loaded / (event.loaded + 400_000)));
        }),
        filter((event): event is HttpResponse<{ data: PilotageExport }> => event.type === HttpEventType.Response),
        map((event) => normalizeExport(event.body!.data))
      );
  }

  loadProduitsMensuel(criteria: PilotageCriteria, onProgress?: (ratio: number) => void) {
    const params = this.criteriaParams(criteria);
    return this.http
      .get<{ data: PilotageProduitsMensuelExport }>(`${this.baseUrl}/export/produits-mensuel`, {
        params,
        reportProgress: true,
        observe: 'events',
      })
      .pipe(
        tap((event) => {
          if (!onProgress || event.type !== HttpEventType.DownloadProgress) return;
          const total = event.total ?? 0;
          if (total > 0) {
            onProgress(Math.min(0.82, (event.loaded / total) * 0.82));
            return;
          }
          onProgress(Math.min(0.55, event.loaded / (event.loaded + 120_000)));
        }),
        filter(
          (event): event is HttpResponse<{ data: PilotageProduitsMensuelExport }> =>
            event.type === HttpEventType.Response
        ),
        map((event) => normalizeProduitsMensuel(event.body!.data))
      );
  }

  listAllGeoAgences() {
    return this.http
      .get<{ data: PilotageAgenceGeoPoint[] }>(`${this.baseUrl}/agences/geo-all`)
      .pipe(map((r) => (r.data ?? []).map((g) => normalizeAgenceGeo(g))));
  }

  loadAgenceFiche(agenceId: number) {
    return this.http
      .get<{ data: PilotageAgenceFiche }>(`${this.baseUrl}/agences/${agenceId}`)
      .pipe(map((r) => normalizeAgenceFiche(r.data)));
  }

  loadAgenceTransactions(
    agenceId: number,
    criteria: PilotageCriteria,
    page: number,
    size: number,
    partyQuery = '',
    options?: { export?: boolean }
  ) {
    let params = this.criteriaParams(criteria).set('page', String(page)).set('size', String(size));
    const partie = partyQuery.trim();
    if (partie) {
      params = params.set('partie', partie);
    }
    if (options?.export) {
      params = params.set('export', 'true');
    }
    return this.http
      .get<{ data: PilotageAgenceTransactionsPage }>(`${this.baseUrl}/agences/${agenceId}/transactions`, { params })
      .pipe(map((r) => normalizeAgenceTransactions(r.data)));
  }

  loadClassementAgences(
    criteria: PilotageCriteria,
    ordre: 'top' | 'pire' = 'top',
    page = 1,
    size = 10,
    tri: 'montant' | 'volume' = 'montant'
  ) {
    const params = this.criteriaParams(criteria)
      .set('ordre', ordre)
      .set('tri', tri)
      .set('page', String(page))
      .set('size', String(size));
    return this.http
      .get<{ data: PilotageAgenceClassementPage }>(`${this.baseUrl}/agences/classement`, { params })
      .pipe(map((r) => normalizeAgenceClassement(r.data)));
  }

  loadClassementCouloirs(
    criteria: PilotageCriteria,
    ordre: 'top' | 'pire' = 'top',
    page = 1,
    size = 10
  ) {
    const params = this.criteriaParams(criteria)
      .set('ordre', ordre)
      .set('page', String(page))
      .set('size', String(size));
    return this.http
      .get<{ data: PilotageCouloirClassementPage }>(`${this.baseUrl}/couloirs/classement`, { params })
      .pipe(map((r) => normalizeCouloirClassement(r.data)));
  }

  loadBundle(criteria: PilotageCriteria) {
    const params = this.criteriaParams(criteria);
    return this.http
      .get<{ data: PilotageBundle }>(`${this.baseUrl}/bundle`, { params })
      .pipe(map((r) => normalizeBundle(r.data, criteria.domaines?.length ? criteria.domaines : [criteria.domaine])));
  }

  private criteriaParams(criteria: PilotageCriteria): HttpParams {
    const domaines = criteria.domaines?.length ? criteria.domaines : [criteria.domaine];
    const devises =
      criteria.devises?.length > 0
        ? criteria.devises
        : criteria.devise
          ? [criteria.devise]
          : [];
    let params = new HttpParams().set('from', criteria.from).set('to', criteria.to);
    for (const domaine of domaines) {
      params = params.append('domaine', domaine);
    }
    for (const devise of devises) {
      params = params.append('devise', devise);
    }

    for (const id of criteria.produitIds) {
      params = params.append('produit_id', String(id));
    }
    if (criteria.ecran?.trim() && criteria.produitIds.length === 0 && domaines.length === 1) {
      const ecranId = criteria.ecran.trim();
      let raw = ecranId;
      if (domaines[0] === 'transfert') {
        raw = ecranId === 'envois' ? 'Envois' : ecranId === 'retraits' ? 'Retraits' : ecranId;
      } else if (domaines[0] === 'monnaie') {
        if (ecranId === 'cashin') raw = 'Cashin';
        else if (ecranId === 'cashout') raw = 'Cashout';
        else if (ecranId === 'transfert_fonds') raw = 'TransfertFond';
        else if (ecranId === 'mobile_money') raw = 'MobileMoney';
      } else {
        raw = '';
      }
      if (raw) {
        params = params.set('ecran', raw);
      }
    }
    for (const s of criteria.statutUniformes) {
      params = params.append('statut_uniforme', s);
    }
    for (const cat of criteria.categories) {
      params = params.append('categorie', cat);
    }
    for (const id of criteria.agenceIds) {
      params = params.append('agence_id', String(id));
    }
    for (const id of criteria.agentIds) {
      params = params.append('agent_id', String(id));
    }
    for (const id of criteria.typeOperationIds) {
      params = params.append('type_operation_id', String(id));
    }
    if (criteria.jourFiltre) {
      params = params.set('jour_filtre', criteria.jourFiltre);
    }
    for (const code of criteria.couloirCodes) {
      params = params.append('couloir', code);
    }
    for (const region of criteria.reseauRegions ?? []) {
      if (region.trim()) {
        params = params.append('reseau_region', region.trim());
      }
    }
    for (const id of criteria.zoneIds ?? []) {
      params = params.append('zone_id', String(id));
    }
    if (criteria.paysId != null && criteria.paysId > 0) {
      params = params.set('pays_id', String(criteria.paysId));
    }
    if (criteria.provinceId != null && criteria.provinceId > 0) {
      params = params.set('province_id', String(criteria.provinceId));
    }
    for (const id of criteria.villeIds ?? []) {
      params = params.append('ville_id', String(id));
    }
    if (criteria.territoireId != null && criteria.territoireId > 0) {
      params = params.set('territoire_id', String(criteria.territoireId));
    }
    for (const id of criteria.communeIds ?? []) {
      params = params.append('commune_id', String(id));
    }
    return params;
  }

  listReseauRegions() {
    return this.http
      .get<{ data: PilotageReseauRef[] }>(`${this.baseUrl}/reseau/regions`)
      .pipe(map((r) => r.data ?? []));
  }

  listReseauZones(reseauRegions: string[] = []) {
    let params = new HttpParams();
    for (const region of reseauRegions) {
      if (region.trim()) {
        params = params.append('reseau_region', region.trim());
      }
    }
    return this.http
      .get<{ data: PilotageReseauRef[] }>(`${this.baseUrl}/reseau/zones`, { params })
      .pipe(map((r) => r.data ?? []));
  }

  private appendAgenceScope(params: HttpParams, scope?: PilotageAgenceScope): HttpParams {
    if (!scope) {
      return params;
    }
    const set = (key: string, value: number | null | undefined) => {
      if (value != null && value > 0) {
        params = params.set(key, String(value));
      }
      return params;
    };
    for (const region of scope.reseauRegions ?? []) {
      if (region.trim()) {
        params = params.append('reseau_region', region.trim());
      }
    }
    for (const id of scope.zoneIds ?? []) {
      params = params.append('zone_id', String(id));
    }
    params = set('pays_id', scope.paysId);
    params = set('province_id', scope.provinceId);
    for (const id of scope.villeIds ?? []) {
      params = params.append('ville_id', String(id));
    }
    params = set('territoire_id', scope.territoireId);
    for (const id of scope.communeIds ?? []) {
      params = params.append('commune_id', String(id));
    }
    return params;
  }
}

function normalizeBundle(raw: PilotageBundle, domaines: PilotageDomaine[]): PilotageBundle {
  const k = raw.kpis as PilotageBundle['kpis'] & {
    ticket_moyen?: number;
    volume_succes?: number;
    mom_montant_pct?: number | null;
    yoy_montant_pct?: number | null;
    compare_mois?: string;
    commission_fcn?: number;
    commission_agent?: number;
    commission_fcn_agent?: number;
  };
  return {
    ...raw,
    kpis: {
      volume: Number(k.volume ?? 0),
      montant: Number(k.montant ?? 0),
      ticketMoyen: Number(k.ticketMoyen ?? k.ticket_moyen ?? 0),
      volumeSucces: Number(k.volumeSucces ?? k.volume_succes ?? 0),
      momMontantPct: k.momMontantPct ?? k.mom_montant_pct ?? null,
      yoyMontantPct: k.yoyMontantPct ?? k.yoy_montant_pct ?? null,
      compareMois: k.compareMois ?? k.compare_mois ?? '',
      commission: Number(k.commission ?? 0),
      commissionFcn: Number(k.commissionFcn ?? k.commission_fcn ?? 0),
      commissionAgent: Number(k.commissionAgent ?? k.commission_agent ?? 0),
      commissionFcnAgent: Number(k.commissionFcnAgent ?? k.commission_fcn_agent ?? 0),
    },
    timeseries: (raw.timeseries ?? []).map((p) => ({
      jour: p.jour,
      volume: Number(p.volume ?? 0),
      montant: Number(p.montant ?? 0),
    })),
    products: (() => {
      const rows = (raw.products ?? []).map((p) => ({
        produitId: Number((p as PilotageProductSlice & { produit_id?: number }).produit_id ?? p.produitId),
        module: p.module,
        produit: p.produit,
        ecran: p.ecran,
        partenaire: (p as PilotageProductSlice & { partenaire?: string }).partenaire ?? '',
        volume: Number(p.volume ?? 0),
        montant: Number(p.montant ?? 0),
      }));
      return domaines.includes('transfert') && !domaines.includes('monnaie')
        ? pilotageFilterProduitsByUiDomain('transfert', rows)
        : rows;
    })(),
    productTimeseries: (() => {
      const rawSeries =
        raw.productTimeseries ??
        (raw as PilotageBundle & { product_timeseries?: PilotageProductTimeseriesPoint[] }).product_timeseries ??
        [];
      const rows = rawSeries.map((p) => {
        const row = p as PilotageProductTimeseriesPoint & { produit_id?: number };
        return {
          jour: row.jour ?? '',
          produitId: Number(row.produitId ?? row.produit_id ?? 0),
          module: row.module ?? '',
          produit: row.produit ?? '',
          ecran: row.ecran ?? '',
          partenaire: row.partenaire ?? '',
          volume: Number(row.volume ?? 0),
          montant: Number(row.montant ?? 0),
        };
      });
      return domaines.includes('transfert') && !domaines.includes('monnaie')
        ? rows.filter((r) => pilotageFilterProduitsByUiDomain('transfert', [r]).length > 0)
        : rows;
    })(),
    agencies: (raw.agencies ?? []).map((a) => normalizeAgenceRank(a)),
    geoPoints: (raw.geoPoints ?? (raw as PilotageBundle & { geo_points?: PilotageAgenceGeoPoint[] }).geo_points ?? []).map(
      (g) => normalizeAgenceGeo(g)
    ),
    couloirIgnored: Boolean(raw.couloirIgnored),
  };
}

function normalizeAgenceGeo(raw: PilotageAgenceGeoPoint): PilotageAgenceGeoPoint {
  const row = raw as PilotageAgenceGeoPoint & {
    agence_id?: number;
    code_agence?: string;
  };
  return {
    agenceId: Number(row.agenceId ?? row.agence_id ?? 0),
    codeAgence: row.codeAgence ?? row.code_agence ?? '',
    nom: row.nom ?? '',
    latitude: Number(row.latitude ?? 0),
    longitude: Number(row.longitude ?? 0),
    volume: Number(row.volume ?? 0),
    montant: Number(row.montant ?? 0),
  };
}

function normalizeAgenceFiche(raw: PilotageAgenceFiche): PilotageAgenceFiche {
  const row = raw as PilotageAgenceFiche & { agence_id?: number; code_agence?: string; pos_id?: string };
  const lat = numberOrNull(row.latitude);
  const lng = numberOrNull(row.longitude);
  return {
    agenceId: Number(row.agenceId ?? row.agence_id ?? 0),
    codeAgence: row.codeAgence ?? row.code_agence ?? '',
    nom: row.nom ?? '',
    categorie: row.categorie ?? '',
    posId: row.posId ?? row.pos_id ?? '',
    region: row.region ?? '',
    zone: row.zone ?? '',
    ville: row.ville ?? '',
    commune: row.commune ?? '',
    province: row.province ?? '',
    pays: row.pays ?? '',
    latitude: lat,
    longitude: lng,
  };
}

function normalizeAgenceTransactions(raw: PilotageAgenceTransactionsPage): PilotageAgenceTransactionsPage {
  const page = raw as PilotageAgenceTransactionsPage & { montant_total?: number };
  return {
    total: Number(raw?.total ?? 0),
    page: Number(raw?.page ?? 1),
    size: Number(raw?.size ?? 10),
    moyenne: Number(raw?.moyenne ?? 0),
    montantTotal: Number(page?.montantTotal ?? page?.montant_total ?? 0),
    lignes: (raw?.lignes ?? []).map((line) => {
      const row = line as PilotageAgenceTransaction & { operation_id?: number };
      return {
        operationId: Number(row.operationId ?? row.operation_id ?? 0),
        jour: row.jour ?? '',
        heure: row.heure ?? '',
        produit: row.produit ?? '',
        ecran: row.ecran ?? '',
        operateur: row.operateur ?? '',
        expediteur: row.expediteur ?? '',
        beneficiaire: row.beneficiaire ?? '',
        statut: row.statut ?? '',
        montant: Number(row.montant ?? 0),
      };
    }),
  };
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeAgenceRank(a: PilotageAgenceRank): PilotageAgenceRank {
  const row = a as PilotageAgenceRank & {
    agence_id?: number;
    code_agence?: string;
    pos_id?: string;
    commission_fcn?: number;
    commission_agent?: number;
    commission_fcn_agent?: number;
  };
  return {
    agenceId: Number(row.agenceId ?? row.agence_id ?? 0),
    codeAgence: row.codeAgence ?? row.code_agence ?? '',
    nom: row.nom ?? '',
    categorie: row.categorie ?? '',
    posId: row.posId ?? row.pos_id ?? '',
    region: row.region ?? '',
    zone: row.zone ?? '',
    volume: Number(row.volume ?? 0),
    montant: Number(row.montant ?? 0),
    commission: Number(row.commission ?? 0),
    commissionFcn: Number(row.commissionFcn ?? row.commission_fcn ?? 0),
    commissionAgent: Number(row.commissionAgent ?? row.commission_agent ?? 0),
    commissionFcnAgent: Number(row.commissionFcnAgent ?? row.commission_fcn_agent ?? 0),
  };
}

function normalizeAgenceClassement(raw: PilotageAgenceClassementPage | null | undefined): PilotageAgenceClassementPage {
  return {
    total: Number(raw?.total ?? 0),
    page: Number(raw?.page ?? 1),
    size: Number(raw?.size ?? 10),
    items: (raw?.items ?? []).map((row) => normalizeAgenceRank(row)),
  };
}

function normalizeCouloirRank(row: PilotageCouloirRank): PilotageCouloirRank {
  return {
    code: row.code ?? '',
    label: row.label ?? '',
    volume: Number(row.volume ?? 0),
    montant: Number(row.montant ?? 0),
  };
}

function normalizeCouloirClassement(
  raw: PilotageCouloirClassementPage | null | undefined
): PilotageCouloirClassementPage {
  return {
    total: Number(raw?.total ?? 0),
    page: Number(raw?.page ?? 1),
    size: Number(raw?.size ?? 10),
    items: (raw?.items ?? []).map((row) => normalizeCouloirRank(row)),
  };
}

function normalizeProduitsMensuel(raw: PilotageProduitsMensuelExport): PilotageProduitsMensuelExport {
  const rows = (raw.rows ?? []).map((row) => {
    const item = row as PilotageProductMonthlyRow & { produit_id?: number };
    return {
      mois: item.mois ?? '',
      produitId: Number(item.produitId ?? item.produit_id ?? 0),
      module: item.module ?? '',
      produit: item.produit ?? '',
      ecran: item.ecran ?? '',
      partenaire: item.partenaire ?? '',
      volume: Number(item.volume ?? 0),
      montant: Number(item.montant ?? 0),
    };
  });
  return {
    from: raw.from,
    to: raw.to,
    domaine: raw.domaine,
    devise: raw.devise,
    rows,
  };
}

function normalizeExport(raw: PilotageExport): PilotageExport {
  const agencies = (raw.agencies ?? []).map((a) => normalizeAgenceRank(a));
  const lignes = (raw.lignes ?? []).map((line) => {
    const row = line as PilotageLigneExport & {
      code_agence?: string;
      pos_id?: string;
      telephone_expediteur?: string;
    };
    return {
      agence: row.agence ?? '',
      codeAgence: row.codeAgence ?? row.code_agence ?? '',
      posId: row.posId ?? row.pos_id ?? '',
      nom: row.nom ?? '',
      expediteur: row.expediteur ?? '',
      beneficiaire: row.beneficiaire ?? '',
      telephone: row.telephone ?? '',
      telephoneExpediteur: row.telephoneExpediteur ?? row.telephone_expediteur ?? '',
      numero: row.numero ?? '',
      jour: row.jour ?? '',
      montant: Number(row.montant ?? 0),
      statut: row.statut ?? '',
    };
  });
  const extra = raw as PilotageExport & { lignes_tronquees?: boolean; lignes_limite?: number };
  return {
    agencies,
    lignes,
    lignesTronquees: Boolean(raw.lignesTronquees ?? extra.lignes_tronquees),
    lignesLimite: Number(raw.lignesLimite ?? extra.lignes_limite ?? lignes.length),
  };
}
