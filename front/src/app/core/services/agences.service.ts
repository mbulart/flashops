import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import {
  AgenceAdmin,
  AgenceAdminFilters,
  AgenceAdminInput,
  AgenceAdminPage,
} from '../models/agences.models';
import { RuntimeConfigService } from './runtime-config.service';

@Injectable({ providedIn: 'root' })
export class AgencesService {
  private readonly http = inject(HttpClient);
  private readonly runtime = inject(RuntimeConfigService);

  private get baseUrl(): string {
    return `${this.runtime.apiUrl}/agences`;
  }

  list(filters: AgenceAdminFilters) {
    return this.http
      .get<{ data: AgenceAdminPage }>(this.baseUrl, { params: this.toParams(filters) })
      .pipe(map((r) => r.data));
  }

  export(filters: AgenceAdminFilters) {
    const { page: _p, size: _s, ...rest } = filters;
    return this.http
      .get<{ data: AgenceAdmin[] }>(`${this.baseUrl}/export`, { params: this.toParams(rest) })
      .pipe(map((r) => r.data ?? []));
  }

  categories() {
    return this.http
      .get<{ data: string[] }>(`${this.baseUrl}/categories`)
      .pipe(map((r) => r.data ?? []));
  }

  get(id: number) {
    return this.http.get<{ data: AgenceAdmin }>(`${this.baseUrl}/${id}`).pipe(map((r) => r.data));
  }

  create(body: AgenceAdminInput) {
    return this.http.post<{ data: AgenceAdmin }>(this.baseUrl, body).pipe(map((r) => r.data));
  }

  update(id: number, body: AgenceAdminInput) {
    return this.http.put<{ data: AgenceAdmin }>(`${this.baseUrl}/${id}`, body).pipe(map((r) => r.data));
  }

  private toParams(filters: AgenceAdminFilters): HttpParams {
    let params = new HttpParams();
    const set = (key: string, value: string | number | boolean | null | undefined) => {
      if (value === null || value === undefined || value === '') return;
      params = params.set(key, String(value));
    };
    set('q', filters.q);
    set('identifiant', filters.identifiant);
    set('region_id', filters.region_id);
    set('zone_id', filters.zone_id);
    set('ville', filters.ville);
    set('commune', filters.commune);
    set('province', filters.province);
    set('pays', filters.pays);
    set('categorie', filters.categorie);
    set('activity_days', filters.activity_days);
    for (const s of filters.statut_activite ?? []) {
      if (s) params = params.append('statut_activite', s);
    }
    set('from', filters.from);
    set('to', filters.to);
    set('parent_agence_id', filters.parent_agence_id);
    if (filters.sans_coords) set('sans_coords', true);
    set('page', filters.page ?? 1);
    set('size', filters.size ?? 25);
    return params;
  }
}
