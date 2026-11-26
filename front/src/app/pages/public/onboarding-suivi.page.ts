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
        <a routerLink="/devenir-distributeur" class="brand" aria-label="Flash">
          <img [src]="logoUrl()" alt="Flash" class="brand-logo" />
        </a>
      </header>
      <section class="track-card">
        <div class="mb-4"><h1>Suivre ma candidature</h1></div>
        <form class="lookup" (ngSubmit)="search()">
          <label>Référence<input class="form-control form-control-sm" name="reference" [(ngModel)]="reference" required /></label>
          <label>Jeton de suivi<input class="form-control form-control-sm" name="jeton" [(ngModel)]="jeton" required /></label>
          <button class="btn btn-primary btn-sm" [disabled]="loading()">{{ loading() ? 'Recherche…' : 'Consulter' }}</button>
        </form>

        @if (candidature(); as item) {
          <div class="result">
            <div class="d-flex justify-content-between align-items-start gap-3">
              <div><small class="text-muted">Référence</small><h2>{{ item.reference }}</h2></div>
              <span class="badge text-bg-warning">{{ item.statut || 'En traitement' }}</span>
            </div>
            <div class="mt-4">
              <div class="d-flex justify-content-between small mb-1"><span>{{ item.etape || 'Traitement du dossier' }}</span><span>{{ item.progression || 0 }} %</span></div>
              <div class="progress"><div class="progress-bar" [style.width.%]="item.progression || 0"></div></div>
            </div>
            <div class="details">
              <div><span>Entreprise</span><strong>{{ item.entreprise?.raison_sociale || '—' }}</strong></div>
              <div><span>Soumise le</span><strong>{{ (item.soumis_le | date:'dd/MM/yyyy HH:mm') || '—' }}</strong></div>
            </div>
            <h3>Documents</h3>
            <div class="document-list">
              @for (doc of item.documents || []; track doc.id || doc.type_code) {
                <div><span>{{ doc.type_libelle || doc.type_code }}</span><small>{{ doc.statut || 'À fournir' }}</small></div>
              } @empty { <p class="text-muted small mb-0">Aucun document renseigné.</p> }
            </div>
          </div>
        }
      </section>
    </main>
  `,
  styles: `
    :host{display:block;min-height:100vh;background:#f5f5f3}.track-shell{max-width:850px;margin:auto;padding:1rem 1rem 4rem}
    header{margin-bottom:2rem}.brand{display:inline-flex;align-items:center;text-decoration:none}
    .brand-logo{height:2.1rem;width:auto;display:block;object-fit:contain}
    .track-card{background:var(--bs-body-bg);border:1px solid var(--bs-border-color);border-radius:1rem;padding:clamp(1.2rem,4vw,2.5rem);box-shadow:0 12px 35px rgba(0,0,0,.06)}
    h1{font-size:1.65rem}.lookup{display:grid;grid-template-columns:1fr 1fr auto;gap:1rem;align-items:end}
    label{font-size:.8rem;font-weight:600;color:var(--bs-secondary-color)}label input{margin-top:.3rem}
    .result{border-top:1px solid var(--bs-border-color);margin-top:2rem;padding-top:2rem}.result h2{font-size:1.2rem;margin:.2rem 0}
    .details{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin:1.5rem 0}.details div{display:grid;border:1px solid var(--bs-border-color);border-radius:.5rem;padding:.8rem}
    .details span,.document-list small{color:var(--bs-secondary-color);font-size:.75rem}h3{font-size:.95rem}
    .document-list div{display:flex;justify-content:space-between;padding:.65rem 0;border-bottom:1px solid var(--bs-border-color)}
    @media(max-width:650px){.lookup,.details{grid-template-columns:1fr}.lookup button{width:100%}}
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
    this.reference = this.route.snapshot.queryParamMap.get('reference') || localStorage.getItem('flashops_onboarding_reference') || '';
    this.jeton = this.route.snapshot.queryParamMap.get('jeton') || localStorage.getItem('flashops_onboarding_jeton') || '';
    if (this.reference && this.jeton) void this.search();
  }

  async search(): Promise<void> {
    if (!this.reference.trim() || !this.jeton.trim()) return;
    this.loading.set(true);
    try {
      const result = await firstValueFrom(this.service.track(this.reference.trim(), this.jeton.trim()));
      this.candidature.set(result);
      localStorage.setItem('flashops_onboarding_reference', this.reference.trim());
      localStorage.setItem('flashops_onboarding_jeton', this.jeton.trim());
    } catch {
      this.candidature.set(null);
      this.toast.error('Candidature introuvable ou jeton invalide.');
    } finally {
      this.loading.set(false);
    }
  }
}
