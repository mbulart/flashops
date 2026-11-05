import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { PublicAgenceGeo } from '../models/public-agences.models';
import { RuntimeConfigService } from './runtime-config.service';

@Injectable({ providedIn: 'root' })
export class PublicAgencesService {
  private readonly http = inject(HttpClient);
  private readonly runtime = inject(RuntimeConfigService);

  listLocated() {
    return this.http
      .get<{ data: PublicAgenceGeo[] }>(`${this.runtime.apiUrl}/public/agences`)
      .pipe(map((r) => r.data ?? []));
  }
}
