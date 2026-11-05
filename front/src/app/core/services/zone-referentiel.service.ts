import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import {
  RegionRef,
  RegionRefInput,
  ResponsableZoneInput,
  ResponsableZoneRef,
  ZoneRef,
  ZoneRefInput,
} from '../models/api.models';
import { RuntimeConfigService } from './runtime-config.service';

@Injectable({ providedIn: 'root' })
export class ZoneReferentielService {
  private readonly http = inject(HttpClient);
  private readonly runtime = inject(RuntimeConfigService);

  private get readUrl(): string {
    return `${this.runtime.apiUrl}/referentiels`;
  }

  private get writeUrl(): string {
    return `${this.runtime.apiUrl}/auth/referentiels`;
  }

  listResponsables() {
    return this.http
      .get<{ data: ResponsableZoneRef[] }>(`${this.readUrl}/responsables-zone`)
      .pipe(map((r) => r.data ?? []));
  }

  listRegions() {
    return this.http.get<{ data: RegionRef[] }>(`${this.readUrl}/regions`).pipe(map((r) => r.data ?? []));
  }

  listZones() {
    return this.http.get<{ data: ZoneRef[] }>(`${this.readUrl}/zones`).pipe(map((r) => r.data ?? []));
  }

  createResponsable(input: ResponsableZoneInput) {
    return this.http
      .post<{ data: ResponsableZoneRef }>(`${this.writeUrl}/responsables-zone`, input)
      .pipe(map((r) => r.data));
  }

  updateResponsable(id: number, input: ResponsableZoneInput) {
    return this.http
      .put<{ data: ResponsableZoneRef }>(`${this.writeUrl}/responsables-zone/${id}`, input)
      .pipe(map((r) => r.data));
  }

  deleteResponsable(id: number) {
    return this.http.delete<{ status: string }>(`${this.writeUrl}/responsables-zone/${id}`);
  }

  createRegion(input: RegionRefInput) {
    return this.http.post<{ data: RegionRef }>(`${this.writeUrl}/regions`, input).pipe(map((r) => r.data));
  }

  updateRegion(id: number, input: RegionRefInput) {
    return this.http.put<{ data: RegionRef }>(`${this.writeUrl}/regions/${id}`, input).pipe(map((r) => r.data));
  }

  deleteRegion(id: number) {
    return this.http.delete<{ status: string }>(`${this.writeUrl}/regions/${id}`);
  }

  createZone(input: ZoneRefInput) {
    return this.http.post<{ data: ZoneRef }>(`${this.writeUrl}/zones`, input).pipe(map((r) => r.data));
  }

  updateZone(id: number, input: ZoneRefInput) {
    return this.http.put<{ data: ZoneRef }>(`${this.writeUrl}/zones/${id}`, input).pipe(map((r) => r.data));
  }

  deleteZone(id: number) {
    return this.http.delete<{ status: string }>(`${this.writeUrl}/zones/${id}`);
  }
}
