import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Candidature } from '../../core/models/onboarding.models';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { OnboardingService } from '../../core/services/onboarding.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-onboarding-suivi',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <main class="track-shell">
      <header>
        <a routerLink="/devenir-distributeur" class="brand" aria-label="Flash OPS">
          <img [src]="logoUrl()" alt="Flash" class="brand-logo" />
          <span class="brand-name">FLASH OPS</span>
        </a>
      </header>
      <section class="track-card">
        <div class="track-title">
          <span class="text-muted small">Candidature distributeur</span>
          <h1>Suivre ma candidature</h1>
        </div>
        <form class="lookup" (ngSubmit)="search()">
          <label>
            Référence
            <input class="form-control form-control-sm" name="reference" [(ngModel)]="reference" required />
          </label>
          <label>
            Jeton de suivi
            <input class="form-control form-control-sm" name="jeton" [(ngModel)]="jeton" required />
          </label>
          <button class="btn btn-primary btn-sm" [disabled]="loading()">{{ loading() ? 'Recherche…' : 'Consulter' }}</button>
        </form>

        @if (candidature(); as item) {
          <div class="result">
            <div class="result-head">
              <div>
                <span>Référence</span>
                <strong>{{ item.reference }}</strong>
              </div>
              <span class="status-pill">{{ pretty(item.statut, 'En traitement') }}</span>
            </div>
            <div class="progress-block">
              <div class="progress-meta">
                <span>{{ item.etape || 'Traitement du dossier' }}</span>
                <span>{{ item.progression || 0 }} %</span>
              </div>
              <div
                class="progress"
                role="progressbar"
                [attr.aria-valuenow]="item.progression || 0"
                aria-valuemin="0"
                aria-valuemax="100"
                [attr.aria-label]="item.etape || 'Traitement du dossier'"
              >
                <div class="progress-bar" [style.width.%]="item.progression || 0"></div>
              </div>
            </div>
            <div class="details">
              <div><span>Entreprise</span><strong>{{ item.entreprise?.raison_sociale || '—' }}</strong></div>
              <div><span>Soumise le</span><strong>{{ (item.soumis_le | date:'dd/MM/yyyy HH:mm') || '—' }}</strong></div>
            </div>
            <h3>Documents</h3>
            <div class="document-list">
              @for (doc of item.documents || []; track doc.id || doc.type_code) {
                <div>
                  <span>{{ doc.type_libelle || doc.type_code }}</span>
                  <small [class.is-ok]="isProvided(doc.statut)">{{ pretty(doc.statut, 'À fournir') }}</small>
                </div>
              } @empty { <p class="text-muted small mb-0">Aucun document renseigné.</p> }
            </div>
          </div>
        }
      </section>
    </main>
  `,
  styles: `
    :host { display:block; min-height:100vh; background:#f5f5f3; }
    .track-shell { max-width:860px; margin:auto; padding:.75rem .75rem 2rem; }
    header { margin-bottom:.75rem; }
    .brand { display:inline-flex; align-items:center; gap:.55rem; text-decoration:none; color:#191919; }
    .brand-logo { height:1.85rem; width:auto; display:block; object-fit:contain; }
    .brand-name { font-size:.92rem; font-weight:800; letter-spacing:.06em; line-height:1; }
    .track-card { background:var(--bs-body-bg); border:1px solid var(--bs-border-color); border-radius:.85rem; padding:1rem 1.1rem; box-shadow:0 8px 24px rgba(0,0,0,.05); }
    h1 { font-size:1.25rem; margin:.1rem 0 0; }
    .lookup { display:grid; grid-template-columns:1fr 1fr auto; gap:.55rem .75rem; align-items:end; margin-top:.85rem; }
    label { font-size:.78rem; font-weight:600; color:var(--bs-secondary-color); }
    label input { margin-top:.2rem; }
    .result { border-top:1px solid var(--bs-border-color); margin-top:.9rem; padding-top:.85rem; }
    .result-head { display:flex; justify-content:space-between; align-items:flex-start; gap:.75rem; }
    .result-head span, .details span { color:var(--bs-secondary-color); font-size:.72rem; }
    .result-head strong { display:block; font-size:1.05rem; margin-top:.1rem; }
    .status-pill { background:#fff4c2; color:#6b5600; border-radius:999px; padding:.22rem .6rem; font-size:.72rem; font-weight:700; white-space:nowrap; }
    .progress-block { margin:.75rem 0 .15rem; }
    .progress-meta { display:flex; justify-content:space-between; gap:.75rem; font-size:.78rem; margin-bottom:.35rem; }
    .progress { height:.3rem; background:#f0e7b0; border-radius:999px; overflow:hidden; }
    .progress-bar { background:#ffd500 !important; transition:width .35s ease; }
    .details { display:grid; grid-template-columns:1fr 1fr; gap:.55rem; margin:.75rem 0; }
    .details div { border:1px solid var(--bs-border-color); border-radius:.5rem; padding:.55rem .7rem; display:grid; }
    h3 { font-size:.85rem; font-weight:700; margin:.15rem 0 .1rem; }
    .document-list div { display:flex; justify-content:space-between; align-items:center; gap:.75rem; padding:.45rem 0; border-bottom:1px solid var(--bs-border-color); }
    .document-list span { font-size:.85rem; }
    .document-list small { color:var(--bs-secondary-color); font-size:.75rem; }
    .document-list small.is-ok { color:#146c36; font-weight:600; }
    @media (prefers-reduced-motion: reduce) { .progress-bar { transition:none; } }
    @media (max-width:650px) {
      .lookup, .details { grid-template-columns:1fr; }
      .lookup button { width:100%; }
    }
  `,
})
export class OnboardingSuiviPageComponent implements OnInit {
  private readonly service = inject(OnboardingService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly appSettings = inject(AppSettingsService);
  readonly logoUrl = computed(
    () => this.appSettings.settings().logo_light || '/branding/logo-light1.png'
  );
  readonly loading = signal(false);
  readonly candidature = signal<Candidature | null>(null);
  reference = '';
  jeton = '';

  ngOnInit(): void {
    this.reference = this.route.snapshot.queryParamMap.get('reference') || '';
    this.jeton = this.route.snapshot.queryParamMap.get('jeton') || '';
    if (this.reference && this.jeton) void this.search();
  }

  pretty(value: string | null | undefined, fallback: string): string {
    const raw = (value || '').trim();
    if (!raw) return fallback;
    const text = raw.replace(/[_-]+/g, ' ').toLocaleLowerCase('fr-FR');
    return text.charAt(0).toLocaleUpperCase('fr-FR') + text.slice(1);
  }

  isProvided(statut: string | null | undefined): boolean {
    const key = (statut || '').trim().toLocaleLowerCase('fr-FR');
    return key === 'fourni' || key === 'valide' || key === 'validé';
  }

  async search(): Promise<void> {
    if (!this.reference.trim() || !this.jeton.trim()) return;
    this.loading.set(true);
    try {
      const result = await firstValueFrom(this.service.track(this.reference.trim(), this.jeton.trim()));
      this.candidature.set(result);
    } catch {
      this.candidature.set(null);
      this.toast.error('Candidature introuvable ou jeton invalide.');
    } finally {
      this.loading.set(false);
    }
  }
}
