import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import {
  Candidature,
  CandidatureDocument,
  CandidatureDraft,
  CandidaturePage,
  GeoLieu,
  OnboardingFilters,
  OnboardingReferentiels,
  OnboardingTask,
  TaskActionInput,
  WorkflowDefinition,
} from '../models/onboarding.models';
import { RuntimeConfigService } from './runtime-config.service';

type Envelope<T> = T | { data: T };

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private readonly http = inject(HttpClient);
  private readonly runtime = inject(RuntimeConfigService);

  private get publicUrl(): string {
    return `${this.runtime.apiUrl}/public/onboarding`;
  }

  private get onboardingUrl(): string {
    return `${this.runtime.apiUrl}/onboarding`;
  }

  private get workflowUrl(): string {
    return `${this.runtime.apiUrl}/workflow`;
  }

  provinces() {
    return this.http
      .get<Envelope<GeoLieu[]>>(`${this.publicUrl}/geo/provinces`)
      .pipe(map((value) => this.unwrap(value) ?? []));
  }

  villes(provinceId: number) {
    const params = new HttpParams().set('province_id', String(provinceId));
    return this.http
      .get<Envelope<GeoLieu[]>>(`${this.publicUrl}/geo/villes`, { params })
      .pipe(map((value) => this.unwrap(value) ?? []));
  }

  communes(villeId: number) {
    const params = new HttpParams().set('ville_id', String(villeId));
    return this.http
      .get<Envelope<GeoLieu[]>>(`${this.publicUrl}/geo/communes`, { params })
      .pipe(map((value) => this.unwrap(value) ?? []));
  }

  referentiels() {
    return this.http
      .get<Envelope<OnboardingReferentiels>>(`${this.publicUrl}/referentiels`)
      .pipe(map((value) => this.unwrap(value)));
  }

  captchaUrl(): string {
    return `${this.publicUrl}/captcha`;
  }

  verifyCaptcha(payload: string) {
    return this.http
      .post<Envelope<{ grant: string }>>(`${this.publicUrl}/captcha/valider`, { payload })
      .pipe(map((value) => this.unwrap(value).grant));
  }

  createDraft(body: CandidatureDraft, grant: string) {
    return this.http
      .post<Envelope<Candidature>>(`${this.publicUrl}/candidatures`, body, {
        headers: { 'X-Onboarding-Grant': grant },
      })
      .pipe(map((value) => this.unwrap(value)));
  }

  updateDraft(id: number | string, body: CandidatureDraft, jeton: string, grant: string) {
    const params = new HttpParams().set('jeton', jeton);
    return this.http
      .put<Envelope<Candidature>>(`${this.publicUrl}/candidatures/${id}`, body, {
        params,
        headers: { 'X-Candidature-Jeton': jeton, 'X-Onboarding-Grant': grant },
      })
      .pipe(map((value) => this.unwrap(value)));
  }

  submit(id: number | string, jeton: string, grant: string) {
    const params = new HttpParams().set('jeton', jeton);
    return this.http
      .post<Envelope<Candidature>>(
        `${this.publicUrl}/candidatures/${id}/soumettre`,
        { jeton },
        { params, headers: { 'X-Candidature-Jeton': jeton, 'X-Onboarding-Grant': grant } }
      )
      .pipe(map((value) => this.unwrap(value)));
  }

  uploadDocument(id: number | string, typeCode: string, file: File, jeton: string, grant: string) {
    const body = new FormData();
    body.append('file', file, file.name);
    const params = new HttpParams().set('jeton', jeton);
    return this.http
      .post<Envelope<CandidatureDocument>>(
        `${this.publicUrl}/candidatures/${id}/documents/${typeCode}`,
        body,
        { params, headers: { 'X-Candidature-Jeton': jeton, 'X-Onboarding-Grant': grant } }
      )
      .pipe(map((value) => this.unwrap(value)));
  }

  deleteDocument(id: number | string, typeCode: string, jeton: string, grant: string) {
    const params = new HttpParams().set('jeton', jeton);
    return this.http.delete<{ ok?: boolean }>(
      `${this.publicUrl}/candidatures/${id}/documents/${typeCode}`,
      { params, headers: { 'X-Candidature-Jeton': jeton, 'X-Onboarding-Grant': grant } }
    );
  }

  downloadDocument(id: number | string, typeCode: string, jeton: string) {
    const params = new HttpParams().set('jeton', jeton);
    return this.http.get(
      `${this.publicUrl}/candidatures/${id}/documents/${typeCode}/fichier`,
      { params, headers: { 'X-Candidature-Jeton': jeton }, responseType: 'blob' }
    );
  }

  track(reference: string, jeton: string) {
    const params = new HttpParams().set('reference', reference).set('jeton', jeton);
    return this.http
      .get<Envelope<Candidature>>(`${this.publicUrl}/suivi`, { params })
      .pipe(map((value) => this.unwrap(value)));
  }

  listCandidatures(filters: OnboardingFilters = {}) {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
    });
    return this.http
      .get<Envelope<CandidaturePage | Candidature[]>>(`${this.onboardingUrl}/candidatures`, { params })
      .pipe(
        map((value) => this.unwrap(value)),
        map((value) =>
          Array.isArray(value) ? { items: value, total: value.length } : value
        )
      );
  }

  getCandidature(id: number | string) {
    return this.http
      .get<Envelope<Candidature>>(`${this.onboardingUrl}/candidatures/${id}`)
      .pipe(map((value) => this.unwrap(value)));
  }

  deleteCandidature(id: number | string) {
    return this.http.delete<{ ok?: boolean }>(`${this.onboardingUrl}/candidatures/${id}`);
  }

  listTasks() {
    return this.http
      .get<Envelope<OnboardingTask[]>>(`${this.onboardingUrl}/taches`)
      .pipe(map((value) => this.unwrap(value)));
  }

  actOnTask(id: number | string, body: TaskActionInput) {
    return this.http
      .post<Envelope<OnboardingTask>>(`${this.onboardingUrl}/taches/${id}/actions`, body)
      .pipe(map((value) => this.unwrap(value)));
  }

  listWorkflows() {
    return this.http
      .get<Envelope<WorkflowDefinition[]>>(`${this.workflowUrl}/definitions`)
      .pipe(map((value) => this.unwrap(value)));
  }

  updateWorkflow(id: number | string, body: Partial<WorkflowDefinition>) {
    return this.http
      .put<Envelope<WorkflowDefinition>>(`${this.workflowUrl}/definitions/${id}`, body)
      .pipe(map((value) => this.unwrap(value)));
  }

  private unwrap<T>(value: Envelope<T>): T {
    return typeof value === 'object' && value !== null && 'data' in value
      ? (value as { data: T }).data
      : (value as T);
  }
}
