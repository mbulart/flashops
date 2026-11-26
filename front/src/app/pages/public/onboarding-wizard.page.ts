import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  CandidatureDocument,
  CandidatureDraft,
  OnboardingOption,
  OnboardingReferentiels,
  PointVente,
} from '../../core/models/onboarding.models';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { OnboardingService } from '../../core/services/onboarding.service';
import { ToastService } from '../../core/services/toast.service';

const STORAGE_REFERENCE = 'flashops_onboarding_reference';
const STORAGE_TOKEN = 'flashops_onboarding_jeton';

@Component({
  selector: 'app-onboarding-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <main class="wizard-shell">
      <header>
        <a routerLink="/devenir-distributeur" class="brand" aria-label="Flash">
          <img [src]="logoUrl()" alt="Flash" class="brand-logo" />
        </a>
        <a routerLink="/devenir-distributeur/suivi" class="btn btn-outline-secondary btn-sm">Suivre un dossier</a>
      </header>

      <section class="wizard-card">
        <div class="wizard-title">
          <div><span class="text-muted small">Candidature distributeur</span><h1>{{ steps[step()].label }}</h1></div>
          <span class="small text-muted">Étape {{ step() + 1 }} / {{ steps.length }}</span>
        </div>
        <div class="progress mb-4" role="progressbar"><div class="progress-bar" [style.width.%]="progress()"></div></div>

        @if (loading()) {
          <div class="py-5 text-center"><span class="spinner-border spinner-border-sm me-2"></span>Chargement…</div>
        } @else {
          @switch (step()) {
            @case (0) {
              <div class="form-grid">
                <label>Adresse e-mail<input class="form-control form-control-sm" type="email" [(ngModel)]="draft.email" /></label>
                <label>Téléphone<input class="form-control form-control-sm" [(ngModel)]="draft.telephone" /></label>
              </div>
            }
            @case (1) {
              <div class="form-grid">
                <label>Nom<input class="form-control form-control-sm" [(ngModel)]="draft.representant.nom" /></label>
                <label>Prénom<input class="form-control form-control-sm" [(ngModel)]="draft.representant.prenom" /></label>
                <label>Téléphone<input class="form-control form-control-sm" [(ngModel)]="draft.representant.telephone" /></label>
                <label>E-mail<input class="form-control form-control-sm" type="email" [(ngModel)]="draft.representant.email" /></label>
                <label>Fonction<input class="form-control form-control-sm" [(ngModel)]="draft.representant.fonction" /></label>
                <label>Pièce d’identité<input class="form-control form-control-sm" [(ngModel)]="draft.representant.piece_identite" /></label>
              </div>
            }
            @case (2) {
              <div class="form-grid">
                <label>Raison sociale<input class="form-control form-control-sm" [(ngModel)]="draft.entreprise.raison_sociale" /></label>
                <label>Nom commercial<input class="form-control form-control-sm" [(ngModel)]="draft.entreprise.nom_commercial" /></label>
                <label>Forme juridique
                  <select class="form-select form-select-sm" [(ngModel)]="draft.entreprise.forme_juridique">
                    <option value="">Sélectionner</option>
                    @for (option of refs().formes_juridiques || []; track option.code) {
                      <option [value]="option.code">{{ option.libelle }}</option>
                    }
                  </select>
                </label>
                <label>RCCM<input class="form-control form-control-sm" [(ngModel)]="draft.entreprise.rccm" /></label>
                <label>ID national<input class="form-control form-control-sm" [(ngModel)]="draft.entreprise.id_nat" /></label>
                <label>NIF<input class="form-control form-control-sm" [(ngModel)]="draft.entreprise.nif" /></label>
                <label class="span-2">Adresse<input class="form-control form-control-sm" [(ngModel)]="draft.entreprise.adresse" /></label>
                <label>Ville<input class="form-control form-control-sm" [(ngModel)]="draft.entreprise.ville" /></label>
                <label>Province<input class="form-control form-control-sm" [(ngModel)]="draft.entreprise.province" /></label>
              </div>
            }
            @case (3) {
              @for (family of serviceFamilies(); track family.name) {
                <fieldset class="choice-group"><legend>{{ family.name }}</legend>
                  <div class="choice-grid">
                    @for (service of family.items; track service.code) {
                      <label class="form-check">
                        <input class="form-check-input" type="checkbox" [checked]="draft.services.includes(service.code)" (change)="toggleService(service.code, $any($event.target).checked)" />
                        <span class="form-check-label">{{ service.libelle }}</span>
                      </label>
                    }
                  </div>
                </fieldset>
              } @empty { <p class="text-muted">Aucun service disponible.</p> }
            }
            @case (4) {
              <div class="d-flex justify-content-between align-items-center mb-3">
                <p class="text-muted small mb-0">Indiquez au moins un emplacement envisagé.</p>
                <button class="btn btn-outline-dark btn-sm" (click)="addOutlet()"><i class="bi bi-plus-lg me-1"></i>Ajouter</button>
              </div>
              @for (outlet of draft.points_vente; track $index) {
                <div class="outlet">
                  <div class="form-grid">
                    <label>Nom<input class="form-control form-control-sm" [(ngModel)]="outlet.nom" /></label>
                    <label>Adresse<input class="form-control form-control-sm" [(ngModel)]="outlet.adresse" /></label>
                    <label>Ville<input class="form-control form-control-sm" [(ngModel)]="outlet.ville" /></label>
                    <label>Province<input class="form-control form-control-sm" [(ngModel)]="outlet.province" /></label>
                  </div>
                  <div class="d-flex justify-content-between mt-2">
                    <label class="form-check"><input type="radio" class="form-check-input" name="principal" [checked]="outlet.principal" (change)="setPrincipal($index)" /> Point principal</label>
                    <button class="btn btn-link btn-sm text-danger" (click)="removeOutlet($index)">Retirer</button>
                  </div>
                </div>
              }
            }
            @case (5) {
              <p class="text-muted small">Préparez les documents demandés. Ajoutez une note si nécessaire.</p>
              @for (doc of draft.documents; track doc.type_code) {
                <div class="document-row">
                  <div><strong>{{ doc.type_libelle }}</strong><small class="d-block text-muted">{{ doc.statut || 'À fournir' }}</small></div>
                  <input class="form-control form-control-sm" [(ngModel)]="doc.note" placeholder="Note (facultatif)" />
                </div>
              } @empty { <p class="text-muted">Aucun type de document n’est configuré.</p> }
            }
            @case (6) {
              <div class="recap">
                <div><span>Contact</span><strong>{{ draft.email || '—' }} · {{ draft.telephone || '—' }}</strong></div>
                <div><span>Représentant</span><strong>{{ draft.representant.prenom }} {{ draft.representant.nom }}</strong></div>
                <div><span>Entreprise</span><strong>{{ draft.entreprise.raison_sociale || '—' }}</strong></div>
                <div><span>Services</span><strong>{{ draft.services.length }}</strong></div>
                <div><span>Points de vente</span><strong>{{ draft.points_vente.length }}</strong></div>
                <div><span>Documents attendus</span><strong>{{ draft.documents.length }}</strong></div>
              </div>
              <div class="alert alert-warning mt-4 mb-0">Après soumission, votre dossier sera transmis pour traitement.</div>
            }
          }
        }

        <footer>
          <button class="btn btn-outline-secondary" [disabled]="step() === 0 || saving()" (click)="previous()">Précédent</button>
          @if (step() < steps.length - 1) {
            <button class="btn btn-primary" [disabled]="saving()" (click)="next()">{{ saving() ? 'Enregistrement…' : 'Continuer' }}</button>
          } @else {
            <button class="btn btn-primary" [disabled]="saving() || submitting()" (click)="submit()">{{ submitting() ? 'Envoi…' : 'Soumettre la candidature' }}</button>
          }
        </footer>
      </section>
    </main>
  `,
  styles: `
    :host { display:block; min-height:100vh; background:#f5f5f3; }
    .wizard-shell { max-width:900px; margin:auto; padding:1rem 1rem 4rem; }
    header { display:flex; justify-content:space-between; align-items:center; margin-bottom:2rem; }
    .brand { display:inline-flex; align-items:center; text-decoration:none; }
    .brand-logo { height:2.1rem; width:auto; display:block; object-fit:contain; }
    .wizard-card { background:var(--bs-body-bg); border:1px solid var(--bs-border-color); border-radius:1rem; padding:clamp(1.2rem,4vw,2.5rem); box-shadow:0 12px 35px rgba(0,0,0,.06); }
    .wizard-title, footer { display:flex; justify-content:space-between; align-items:center; gap:1rem; }
    h1 { font-size:1.55rem; margin:.15rem 0 0; }
    .progress { height:.3rem; }
    .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
    label { font-size:.82rem; font-weight:600; color:var(--bs-secondary-color); }
    label input, label select { margin-top:.3rem; }
    .span-2 { grid-column:span 2; }
    .choice-group { border:0; margin:0 0 1.25rem; padding:0; }
    legend { font-size:.9rem; font-weight:700; border-bottom:1px solid var(--bs-border-color); padding-bottom:.45rem; }
    .choice-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:.6rem; }
    .outlet { border:1px solid var(--bs-border-color); border-radius:.65rem; padding:1rem; margin-bottom:.75rem; }
    .document-row { display:grid; grid-template-columns:1fr 1fr; gap:1rem; align-items:center; border-bottom:1px solid var(--bs-border-color); padding:.8rem 0; }
    .recap { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
    .recap div { border:1px solid var(--bs-border-color); border-radius:.6rem; padding:.9rem; display:grid; }
    .recap span { color:var(--bs-secondary-color); font-size:.75rem; }
    footer { border-top:1px solid var(--bs-border-color); margin-top:2rem; padding-top:1.25rem; }
    @media(max-width:600px) { .form-grid,.choice-grid,.recap,.document-row { grid-template-columns:1fr; } .span-2{grid-column:auto;} }
  `,
})
export class OnboardingWizardPageComponent implements OnInit {
  private readonly service = inject(OnboardingService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly appSettings = inject(AppSettingsService);

  readonly logoUrl = computed(
    () => this.appSettings.settings().logo_light || '/branding/logo-light1.png'
  );

  readonly steps = [
    { label: 'Identification' }, { label: 'Représentant' }, { label: 'Entreprise' },
    { label: 'Services' }, { label: 'Points de vente' }, { label: 'Documents' },
    { label: 'Récapitulatif' },
  ];
  readonly step = signal(0);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly submitting = signal(false);
  readonly refs = signal<OnboardingReferentiels>({});
  readonly progress = computed(() => ((this.step() + 1) / this.steps.length) * 100);
  readonly serviceFamilies = computed(() => {
    const groups = new Map<string, OnboardingOption[]>();
    for (const item of this.refs().services || []) {
      const name = item.famille || 'Autres services';
      groups.set(name, [...(groups.get(name) || []), item]);
    }
    return [...groups.entries()].map(([name, items]) => ({ name, items }));
  });

  draft: CandidatureDraft = {
    email: '', telephone: '',
    representant: { nom: '', prenom: '', telephone: '', email: '', fonction: '', piece_identite: '' },
    entreprise: { raison_sociale: '', nom_commercial: '', forme_juridique: '', rccm: '', id_nat: '', nif: '', adresse: '', ville: '', province: '' },
    services: [], points_vente: [{ nom: '', adresse: '', ville: '', province: '', principal: true }],
    documents: [],
  };
  private draftId?: number | string;
  private token = '';

  async ngOnInit(): Promise<void> {
    try {
      const refs = await firstValueFrom(this.service.referentiels());
      this.refs.set(refs || {});
      this.draft.documents = (refs?.types_documents || []).map((item) => ({
        type_code: item.code, type_libelle: item.libelle, statut: 'À fournir', note: '',
      }));
    } catch {
      this.toast.error('Impossible de charger les informations du formulaire.');
    } finally {
      this.loading.set(false);
    }
  }

  toggleService(code: string, checked: boolean): void {
    this.draft.services = checked
      ? [...new Set([...this.draft.services, code])]
      : this.draft.services.filter((item) => item !== code);
  }

  addOutlet(): void {
    this.draft.points_vente.push({ nom: '', adresse: '', ville: '', province: '', principal: false });
  }

  removeOutlet(index: number): void {
    if (this.draft.points_vente.length === 1) return;
    const wasPrincipal = this.draft.points_vente[index].principal;
    this.draft.points_vente.splice(index, 1);
    if (wasPrincipal) this.draft.points_vente[0].principal = true;
  }

  setPrincipal(index: number): void {
    this.draft.points_vente.forEach((item, i) => (item.principal = i === index));
  }

  async next(): Promise<void> {
    if (!(await this.save())) return;
    this.step.update((value) => Math.min(value + 1, this.steps.length - 1));
  }

  async previous(): Promise<void> {
    await this.save();
    this.step.update((value) => Math.max(value - 1, 0));
  }

  async submit(): Promise<void> {
    if (!(await this.save()) || !this.draftId || !this.token) return;
    this.submitting.set(true);
    try {
      const result = await firstValueFrom(this.service.submit(this.draftId, this.token));
      this.persistAccess(result.reference, result.jeton || this.token);
      this.toast.success('Votre candidature a été soumise.');
      await this.router.navigate(['/devenir-distributeur/suivi'], {
        queryParams: { reference: result.reference, jeton: result.jeton || this.token },
      });
    } catch {
      this.toast.error('La candidature n’a pas pu être soumise.');
    } finally {
      this.submitting.set(false);
    }
  }

  private async save(): Promise<boolean> {
    this.saving.set(true);
    try {
      this.draft.email = this.draft.representant.email || this.draft.email;
      this.draft.telephone = this.draft.representant.telephone || this.draft.telephone;
      const result = this.draftId && this.token
        ? await firstValueFrom(this.service.updateDraft(this.draftId, this.draft, this.token))
        : await firstValueFrom(this.service.createDraft(this.draft));
      this.draftId = result.id;
      this.token = result.jeton || this.token;
      this.persistAccess(result.reference, this.token);
      return true;
    } catch {
      this.toast.error('Le brouillon n’a pas pu être enregistré.');
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  private persistAccess(reference?: string, token?: string): void {
    if (reference) localStorage.setItem(STORAGE_REFERENCE, reference);
    if (token) localStorage.setItem(STORAGE_TOKEN, token);
  }
}
