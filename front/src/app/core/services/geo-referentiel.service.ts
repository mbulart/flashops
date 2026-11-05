import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import {
  Commune,
  GeoSyncResult,
  Pays,
  Province,
  Territoire,
  Ville,
} from '../models/api.models';
import { RuntimeConfigService } from './runtime-config.service';

@Injectable({ providedIn: 'root' })
export class GeoReferentielService {
  private readonly http = inject(HttpClient);
  private readonly runtime = inject(RuntimeConfigService);

  private get geoUrl(): string {
    return `${this.runtime.apiUrl}/geo`;
  }

  private get adminSyncUrl(): string {
    return `${this.runtime.apiUrl}/auth/referentiels/geo/sync`;
  }

  private get adminSeedUrl(): string {
    return `${this.runtime.apiUrl}/auth/referentiels/geo/seed`;
  }

  listPays() {
    return this.http.get<{ data: Pays[] }>(`${this.geoUrl}/pays`).pipe(map((r) => r.data ?? []));
  }

  listProvinces(paysId: number) {
    const params = new HttpParams().set('pays_id', String(paysId));
    return this.http
      .get<{ data: Province[] }>(`${this.geoUrl}/provinces`, { params })
      .pipe(map((r) => r.data ?? []));
  }

  listVilles(provinceId: number) {
    const params = new HttpParams().set('province_id', String(provinceId));
    return this.http
      .get<{ data: Ville[] }>(`${this.geoUrl}/villes`, { params })
      .pipe(map((r) => r.data ?? []));
  }

  listTerritoires(provinceId: number) {
    const params = new HttpParams().set('province_id', String(provinceId));
    return this.http
      .get<{ data: Territoire[] }>(`${this.geoUrl}/territoires`, { params })
      .pipe(map((r) => r.data ?? []));
  }

  listCommunes(filters: { villeId?: number; territoireId?: number; provinceId?: number }) {
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
      .get<{ data: Commune[] }>(`${this.geoUrl}/communes`, { params })
      .pipe(map((r) => r.data ?? []));
  }

  syncPaysList() {
    return this.http
      .post<{ data: GeoSyncResult }>(`${this.adminSyncUrl}/pays`, {})
      .pipe(map((r) => r.data));
  }

  syncPaysHierarchy(codeIso: string) {
    return this.http
      .post<{ data: GeoSyncResult }>(`${this.adminSyncUrl}/pays/${encodeURIComponent(codeIso)}`, {})
      .pipe(map((r) => r.data));
  }

  seedLocalCountry(codeIso: string, force = false) {
    const params = force ? '?force=true' : '';
    return this.http
      .post<{ data: GeoSyncResult }>(
        `${this.adminSeedUrl}/local/${encodeURIComponent(codeIso)}${params}`,
        {}
      )
      .pipe(map((r) => r.data));
  }

  seedAllLocalMissing() {
    return this.http
      .post<{ data: GeoSyncResult }>(`${this.adminSeedUrl}/local`, {})
      .pipe(map((r) => r.data));
  }
}
