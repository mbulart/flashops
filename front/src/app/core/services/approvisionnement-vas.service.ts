import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import {
  ApprovisionnementVasConsommation,
  ApprovisionnementVasDashboard,
  ApprovisionnementVasDemande,
  ApprovisionnementVasDemandeInput,
  ApprovisionnementVasDemandeListItem,
  ApprovisionnementVasPaiement,
  ApprovisionnementVasPaiementInput,
  ApprovisionnementVasProduit,
  ApprovisionnementVasReleve,
  ApprovisionnementVasSeuil,
  ApprovisionnementVasSoldeAlerte,
  ApprovisionnementVasStatut,
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

  dashboard() {
    return this.http
      .get<{ data: ApprovisionnementVasDashboard }>(`${this.baseUrl}/dashboard`)
      .pipe(map((r) => r.data));
  }

  list(limit = 100, statut?: string) {
    let params = new HttpParams().set('limit', String(limit));
    if (statut) params = params.set('statut', statut);
    return this.http
      .get<{ data: ApprovisionnementVasDemandeListItem[] }>(this.baseUrl, { params })
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

  transition(id: number, statut: ApprovisionnementVasStatut, commentaire?: string, motifRejet?: string) {
    return this.http
      .post<{ data: ApprovisionnementVasDemande }>(`${this.baseUrl}/${id}/transition`, {
        statut,
        commentaire: commentaire ?? null,
        motif_rejet: motifRejet ?? null,
      })
      .pipe(map((r) => r.data));
  }

  paiementsDemande(id: number) {
    return this.http
      .get<{ data: ApprovisionnementVasPaiement[] }>(`${this.baseUrl}/${id}/paiements`)
      .pipe(map((r) => r.data ?? []));
  }

  paiementsLigne(ligneId: number) {
    return this.http
      .get<{ data: ApprovisionnementVasPaiement[] }>(`${this.baseUrl}/lignes/${ligneId}/paiements`)
      .pipe(map((r) => r.data ?? []));
  }

  createPaiement(ligneId: number, body: ApprovisionnementVasPaiementInput) {
    return this.http
      .post<{ data: ApprovisionnementVasPaiement }>(`${this.baseUrl}/lignes/${ligneId}/paiements`, body)
      .pipe(map((r) => r.data));
  }

  soldes() {
    return this.http
      .get<{ data: ApprovisionnementVasReleve[] }>(`${this.baseUrl}/soldes`)
      .pipe(map((r) => r.data ?? []));
  }

  createSolde(body: {
    produit_id: number;
    devise: string;
    solde: number;
    commentaire?: string | null;
  }) {
    return this.http
      .post<{ data: ApprovisionnementVasReleve }>(`${this.baseUrl}/soldes`, body)
      .pipe(map((r) => r.data));
  }

  alertesSoldes() {
    return this.http
      .get<{ data: ApprovisionnementVasSoldeAlerte[] }>(`${this.baseUrl}/soldes/alertes`)
      .pipe(map((r) => r.data ?? []));
  }

  seuils() {
    return this.http
      .get<{ data: ApprovisionnementVasSeuil[] }>(`${this.baseUrl}/seuils`)
      .pipe(map((r) => r.data ?? []));
  }

  upsertSeuil(body: {
    produit_id: number;
    devise: string;
    seuil_attention: number;
    seuil_critique: number;
  }) {
    return this.http
      .put<{ data: ApprovisionnementVasSeuil }>(`${this.baseUrl}/seuils`, body)
      .pipe(map((r) => r.data));
  }
}
