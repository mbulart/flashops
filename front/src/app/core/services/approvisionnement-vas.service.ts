import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import {
  ApprovisionnementVasConsommation,
  ApprovisionnementVasDemande,
  ApprovisionnementVasDemandeInput,
  ApprovisionnementVasDemandeListItem,
  ApprovisionnementVasProduit,
} from '../models/approvisionnement-vas.models';
import { RuntimeConfigService } from './runtime-config.service';

@Injectable({ providedIn: 'root' })
export class ApprovisionnementVasService {
  private readonly http = inject(HttpClient);
  private readonly runtime = inject(RuntimeConfigService);

  private get baseUrl(): string {
    return `${this.runtime.apiUrl}/approvisionnement-vas`;
  }

  produits() {
    return this.http
      .get<{ data: ApprovisionnementVasProduit[] }>(`${this.baseUrl}/produits`)
      .pipe(map((r) => r.data ?? []));
  }

  calculerConsommation(produitId: number, devise: string, dateReference: string) {
    const params = new HttpParams()
      .set('produit_id', String(produitId))
      .set('devise', devise)
      .set('date_reference', dateReference);
    return this.http
      .get<{ data: ApprovisionnementVasConsommation }>(`${this.baseUrl}/consommations`, { params })
      .pipe(map((r) => r.data));
  }

  list(limit = 100) {
    return this.http
      .get<{ data: ApprovisionnementVasDemandeListItem[] }>(this.baseUrl, {
        params: new HttpParams().set('limit', String(limit)),
      })
      .pipe(map((r) => r.data ?? []));
  }

  get(id: number) {
    return this.http
      .get<{ data: ApprovisionnementVasDemande }>(`${this.baseUrl}/${id}`)
      .pipe(map((r) => r.data));
  }

  create(body: ApprovisionnementVasDemandeInput) {
    return this.http
      .post<{ data: ApprovisionnementVasDemande }>(this.baseUrl, body)
      .pipe(map((r) => r.data));
  }

  update(id: number, body: ApprovisionnementVasDemandeInput) {
    return this.http
      .put<{ data: ApprovisionnementVasDemande }>(`${this.baseUrl}/${id}`, body)
      .pipe(map((r) => r.data));
  }
}
